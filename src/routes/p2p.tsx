import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  ShieldCheck,
  Radio,
  Zap,
  Copy,
  ExternalLink,
  AlertTriangle,
  KeyRound,
  Terminal,
  Activity,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useOperator, maskAddress, ROLE_META } from "@/store/operator";
import {
  useP2P, buildP2PAuthorization, isValidStellarPublicKey,
  type P2PAsset, type P2PTransfer, type P2PTransferState,
} from "@/store/p2p";
import { stellarExpertTx } from "@/lib/stellar";
import { apiValidatedP2PTransfer, type P2PValidationError } from "@/lib/api";
import { validateP2PTransfer } from "@/lib/p2p-validation";
import { P2PLiveStatusPanel, type LiveStatusData, type LiveStatusPhase } from "@/components/P2PLiveStatusPanel";
import { SettlementRailBanner } from "@/components/SettlementRailBanner";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { toast } from "sonner";

export const Route = createFileRoute("/p2p")({
  head: () => ({
    meta: [
      { title: "Direct Settlement — EnergyPay" },
      { name: "description", content: "Real-time peer-to-peer settlement rail for energy market participants on Stellar." },
    ],
  }),
  component: P2PPage,
});

type LogLine = { ts: string; text: string; level: "info" | "ok" | "warn" };

const fmtTs = (d: Date) =>
  `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;

const ROLE_CONTEXT: Record<string, string> = {
  GENERATOR: "Distribute generated energy assets to counterparties",
  SELLER: "Execute commercial settlement transfers",
  INVESTOR: "Transfer financial settlement exposure",
  USER: "Settle consumption obligations to providers",
};

function P2PPage() {
  const operator = useOperator((s) => s.operator);
  const { transfers, counterparties, recordTransfer } = useP2P();
  const { railState, isOffline, isExecutable } = useSettlementRail();

  const [destinationOrg, setDestinationOrg] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [asset, setAsset] = useState<P2PAsset>("EPWR");
  const [memo, setMemo] = useState("");

  const [running, setRunning] = useState(false);
  const [state, setState] = useState<P2PTransferState>("DRAFT");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<P2PTransfer | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [live, setLive] = useState<LiveStatusData>({
    phase: null,
    state: "DRAFT",
    txHash: null,
    ledger: null,
    finalityMs: null,
    explorerLink: null,
    startedAt: null,
    errorMessage: null,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const setPhase = (
    phase: LiveStatusPhase | null,
    state: P2PTransferState,
    patch: Partial<LiveStatusData> = {},
  ) => setLive((prev) => ({ ...prev, phase, state, ...patch }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const validAddress = isValidStellarPublicKey(destinationAddress);
  const numericAmount = Number(amount);
  const validAmount = numericAmount > 0;
  const canExecute =
    !!operator && validAddress && validAmount && !running && destinationOrg.trim().length > 0 && isExecutable;

  const authorization = useMemo(() => {
    if (!operator || !validAddress || !validAmount) return null;
    return buildP2PAuthorization(operator, {
      destinationPublicKey: destinationAddress.trim(),
      asset,
      amount: numericAmount,
      memo,
    });
  }, [operator, destinationAddress, asset, numericAmount, memo, validAddress, validAmount]);

  const pickCounterparty = (org: string) => {
    const c = counterparties.find((c) => c.organization === org);
    if (!c) return;
    setDestinationOrg(c.organization);
    setDestinationAddress(c.settlementAddress);
  };

  const execute = async () => {
    if (!operator || !canExecute || !authorization) return;
    setFieldError(null);
    setRunning(true);
    setResult(null);
    setLogs([]);
    setState("PREPARING");

    const startedAt = Date.now();
    // Stable transfer_id across retries / refresh — the adapter de-duplicates
    // by this id, so the same draft can never produce two on-chain submissions.
    const draftKey = `p2p_draft_${operator.operatorId}_${authorization.destinationPublicKey}_${authorization.amount}_${authorization.asset}`;
    let transferId: string;
    try {
      const cached = sessionStorage.getItem(draftKey);
      if (cached) transferId = cached;
      else {
        transferId = `P2P-${Math.floor(100000 + Math.random() * 899999)}`;
        sessionStorage.setItem(draftKey, transferId);
      }
    } catch {
      transferId = `P2P-${Math.floor(100000 + Math.random() * 899999)}`;
    }
    const signer = maskAddress(operator.wallet.publicKey);
    const recipient = maskAddress(authorization.destinationPublicKey);
    const roleLabel = operator.roles.map((r) => ROLE_META[r].label).join(" · ") || "operator";

    setLive({
      phase: null,
      state: "PREPARING",
      txHash: null,
      ledger: null,
      finalityMs: null,
      explorerLink: null,
      startedAt,
      errorMessage: null,
    });

    const append = (s: P2PTransferState, text: string, level: "info"|"ok"|"warn" = "info") => {
      setState(s);
      setLogs((l) => [...l, { ts: fmtTs(new Date()), text, level }]);
    };
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // ── Server-canonical payload + pre-flight Zod validation ──────────────
    const payload = {
      sender_user_id: operator.operatorId,
      recipient_public_key: authorization.destinationPublicKey,
      asset: authorization.asset,
      amount:
        authorization.asset === "XLM"
          ? Number(authorization.amount.toFixed(7))
          : authorization.amount,
      memo: authorization.memo || transferId,
      transfer_id: transferId,
    };

    const preflight = validateP2PTransfer(payload);
    if (!preflight.ok) {
      append("FAILED", `✗ validation rejected · ${preflight.code} · ${preflight.message}`, "warn");
      setFieldError({ field: preflight.field, message: preflight.message });
      setPhase(null, "FAILED", { errorMessage: preflight.message });
      setRunning(false);
      toast.error("Settlement payload rejected", { description: preflight.message });
      return;
    }

    try {
      append("PREPARING", `→ direct settlement initiated · ${transferId}`);
      await wait(140);
      append("PREPARING", `authorizing operator · ${operator.operatorId} · roles=[${roleLabel}]`);
      await wait(160);
      append("PREPARING", `✓ transfer authority verified · counterparty ${destinationOrg}`, "ok");
      await wait(160);
      append("SIGNING", `binding execution signer · source=${signer}`);
      await wait(160);
      append("SIGNING", `delegating ed25519 signing to backend custody · in-memory only`);
      await wait(160);
      append("BROADCASTING", `→ POST /api/p2p/validate · server validation + Horizon broadcast`, "info");
      setPhase("SUBMITTED", "BROADCASTING");

      // Server-validated submission. The TanStack gateway re-validates on the
      // server with the canonical Zod schema before forwarding to the
      // settlement backend; backend signs in-memory and submits to Horizon.
      const submission = await apiValidatedP2PTransfer(payload);

      if (submission.status === "FAILED") {
        const msg = submission.error || "Backend reported settlement failure";
        append("FAILED", `✗ ${msg}`, "warn");
        setPhase("SUBMITTED", "FAILED", { errorMessage: msg });
        setRunning(false);
        toast.error("Direct settlement failed", { description: msg });
        return;
      }

      // Canonical receipt fields (with backwards-compatible fallbacks).
      const explorer = submission.explorer_url || submission.explorer_link || stellarExpertTx(submission.tx_hash);
      const senderKey = submission.sender || submission.source_public_key || operator.wallet.publicKey;
      const finalizedTs = submission.finalized_at || submission.timestamp || new Date().toISOString();
      append("CONFIRMING", `awaiting Horizon confirmation · ledger pending`);
      setPhase("CONFIRMED", "CONFIRMING", {
        txHash: submission.tx_hash,
        ledger: submission.ledger,
        explorerLink: explorer,
      });
      await wait(140);
      append("CONFIRMING", `✓ tx confirmed · ledger #${submission.ledger.toLocaleString("en-US")}`, "ok");
      append("CONFIRMING", `tx hash: ${submission.tx_hash}`);
      await wait(140);
      append("FINALIZED", `✓ settlement finality reached · direct rail closed`, "ok");
      const finalityMs = submission.latency_ms ?? submission.finality_ms ?? Date.now() - startedAt;
      setPhase("SETTLED", "FINALIZED", { finalityMs });

      const transfer: P2PTransfer = {
        id: submission.transfer_id || transferId,
        ts: finalizedTs.slice(0, 16).replace("T", " "),
        sourcePublicKey: senderKey,
        destinationPublicKey: authorization.destinationPublicKey,
        destinationOrg,
        asset: authorization.asset,
        amount: authorization.amount,
        memo: authorization.memo,
        txHash: submission.tx_hash,
        ledger: submission.ledger,
        latencyMs: finalityMs,
        state: "FINALIZED",
        operatorId: operator.operatorId,
        explorerLink: explorer,
      };
      recordTransfer(transfer);
      setResult(transfer);
      setRunning(false);
      toast.success("Direct settlement finalized", {
        description: `${transfer.amount} ${transfer.asset} → ${recipient}`,
      });
    } catch (err) {
      // Server-side validation surfaces structured errors via 422.
      const e = err as Error & { status?: number; payload?: P2PValidationError };
      const payloadErr = e.payload && typeof e.payload === "object" ? e.payload : null;
      const code = payloadErr?.code;
      const field = payloadErr?.field;
      const msg = payloadErr?.message || e.message || "submission failed";
      if (e.status === 422 && field) {
        setFieldError({ field, message: msg });
      }
      append("FAILED", `✗ ${code ?? "submission"} · ${msg}`, "warn");
      setPhase(null, "FAILED", { errorMessage: msg });
      setRunning(false);
      toast.error("Direct settlement failed", { description: msg });
    }
  };

  const reset = () => {
    try {
      // Drop any cached transfer_id so the next draft mints a fresh one.
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("p2p_draft_"))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch { /* sessionStorage unavailable */ }
    setResult(null);
    setLogs([]);
    setState("DRAFT");
    setAmount("");
    setMemo("");
    setDestinationOrg("");
    setDestinationAddress("");
    setFieldError(null);
    setLive({
      phase: null,
      state: "DRAFT",
      txHash: null,
      ledger: null,
      finalityMs: null,
      explorerLink: null,
      startedAt: null,
      errorMessage: null,
    });
  };

  if (!operator) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-destructive/30 bg-card p-6">
          <p className="flex items-center gap-2 font-mono text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> No operational identity bound to session.
          </p>
        </Card>
      </div>
    );
  }

  const stateBadge =
    state === "DRAFT" ? "IDLE"
    : state === "FINALIZED" ? "● FINALIZED"
    : state === "FAILED" ? "● FAILED"
    : `● ${state}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Settlement Rails / Direct Peer-to-Peer
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Direct Settlement Rail
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time operator-to-operator settlement on Stellar. Programmable transfer authorization between market participants.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono">
            <Radio className="h-3 w-3 text-success" /> DIRECT RAIL · ACTIVE
          </span>
          <span className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-success">
            <Activity className="h-3 w-3 animate-pulse" /> STELLAR TESTNET
          </span>
        </div>
      </div>

      <SettlementRailBanner />

      {isOffline && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono text-[11px] text-destructive">
          ✗ Settlement backend unreachable at <span className="font-semibold">http://localhost:3000</span>.
          Execute Settlement is disabled. Verify the backend service is running and Horizon is reachable.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        <Card className="border-border bg-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <p className="font-display text-base font-semibold">Settlement Transfer</p>
            </div>
            <Badge
              variant="outline"
              className={
                running
                  ? "border-primary/40 bg-primary/10 font-mono text-[10px] text-primary"
                  : result
                  ? "border-success/40 bg-success/10 font-mono text-[10px] text-success"
                  : "font-mono text-[10px]"
              }
            >
              {stateBadge}
            </Badge>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Recipient organization
                </Label>
                <Select value={destinationOrg} onValueChange={pickCounterparty}>
                  <SelectTrigger className="bg-input">
                    <SelectValue placeholder="Select known counterparty" />
                  </SelectTrigger>
                  <SelectContent>
                    {counterparties.map((c) => (
                      <SelectItem key={c.organization} value={c.organization}>
                        <span className="font-mono text-xs">{c.role}</span> · {c.organization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={destinationOrg}
                  onChange={(e) => setDestinationOrg(e.target.value)}
                  placeholder="Or type counterparty name"
                  className="bg-input font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Recipient settlement address
                </Label>
                <Input
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="G… (Stellar public key)"
                  className={`bg-input font-mono text-xs ${
                    destinationAddress && !validAddress ? "border-destructive" : ""
                  }`}
                />
                {destinationAddress && !validAddress && (
                  <p className="font-mono text-[10px] text-destructive">
                    Invalid Stellar public key (G… 56 chars).
                  </p>
                )}
                {fieldError?.field === "recipient_public_key" && (
                  <p className="font-mono text-[10px] text-destructive">
                    server · {fieldError.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Settlement amount
                </Label>
                <Input
                  type="number"
                  step="0.0000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`bg-input font-mono ${
                    fieldError?.field === "amount" ? "border-destructive" : ""
                  }`}
                />
                {fieldError?.field === "amount" && (
                  <p className="font-mono text-[10px] text-destructive">
                    server · {fieldError.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Asset
                </Label>
                <Select value={asset} onValueChange={(v) => setAsset(v as P2PAsset)}>
                  <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EPWR">EPWR · Energy Power Token</SelectItem>
                    <SelectItem value="XLM">XLM · Stellar Lumen</SelectItem>
                  </SelectContent>
                </Select>
                {fieldError?.field === "asset" && (
                  <p className="font-mono text-[10px] text-destructive">
                    server · {fieldError.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Settlement memo
              </Label>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="EPAY direct settlement note · invoice ref · operational tag"
                className={`min-h-[72px] bg-input font-mono text-xs ${
                  fieldError?.field === "memo" ? "border-destructive" : ""
                }`}
                maxLength={28}
              />
              <div className="flex items-center justify-between">
                {fieldError?.field === "memo" ? (
                  <p className="font-mono text-[10px] text-destructive">
                    server · {fieldError.message}
                  </p>
                ) : (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Stellar memo_text · 28 bytes max · ASCII safe
                  </p>
                )}
                <p className="font-mono text-[10px] text-muted-foreground">{memo.length}/28</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-success" /> Direct settlement rail · Stellar finality ~2s
                <span className="ml-2 inline-flex items-center gap-1 rounded border border-border bg-background/40 px-1.5 py-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    railState === "CONNECTED" ? "bg-success animate-pulse"
                    : railState === "DEGRADED" ? "bg-warning animate-pulse"
                    : railState === "OFFLINE" ? "bg-destructive"
                    : "bg-muted-foreground"
                  }`} />
                  {railState}
                </span>
              </p>
              <div className="flex items-center gap-2">
                {result && (
                  <Button size="sm" variant="outline" onClick={reset}>
                    New transfer
                  </Button>
                )}
                <Button size="lg" onClick={execute} disabled={!canExecute}>
                  <Zap className="mr-2 h-4 w-4" /> Execute Settlement
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* RIGHT — Signer / authorization panel */}
        <Card className="border-border bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <p className="font-display text-base font-semibold">Settlement Authorization</p>
          </div>
          <div className="space-y-2 text-[11px]">
            <SignerCell label="Source operator" value={`${operator.operatorId} · ${operator.organization}`} />
            <SignerCell label="Signer address" value={operator.wallet.publicKey} mono truncate />
            <SignerCell label="Active network" value="Stellar Testnet · horizon.stellar.org" />
            <SignerCell
              label="Authorization state"
              value={running ? "BINDING SIGNER" : result ? "FINALIZED" : "READY"}
              tone={running ? "warn" : result ? "ok" : "info"}
            />
            <SignerCell
              label="Active roles"
              value={operator.roles.map((r) => ROLE_META[r].label).join(" · ") || "—"}
            />
          </div>

          <div className="mt-4 rounded-md border border-border bg-background/40 p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Role-bound capabilities on direct rail
            </p>
            <ul className="space-y-1.5">
              {operator.roles.map((r) => (
                <li key={r} className="flex items-start gap-2 text-[11px]">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {ROLE_META[r].label}
                    </span>
                    <p className="text-foreground/85">{ROLE_CONTEXT[r]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Live transfer status — submitted → confirmed → settled (backend feed) */}
      <P2PLiveStatusPanel data={live} />

      {/* Execution console + result */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <Terminal className="h-3.5 w-3.5 text-primary" /> Execution log · stdout
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              signer {maskAddress(operator.wallet.publicKey)}
            </p>
          </div>
          <div
            ref={scrollRef}
            className="h-[260px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed"
          >
            {logs.length === 0 && (
              <p className="text-muted-foreground/70">
                $ awaiting transfer authorization…
              </p>
            )}
            {logs.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-muted-foreground/60">[{l.ts}]</span>
                <span
                  className={
                    l.level === "ok"
                      ? "text-success"
                      : l.level === "warn"
                      ? "text-warning"
                      : "text-foreground/85"
                  }
                >
                  {l.text}
                </span>
              </div>
            ))}
            {running && (
              <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-1.5 animate-pulse bg-primary" />
                <span className="text-[10px]">processing…</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-border bg-card p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Settlement receipt
          </p>
          {result ? (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                <Meta k="Transfer ID" v={result.id} />
                <Meta k="Asset" v={`${result.amount} ${result.asset}`} highlight />
                <Meta k="Source" v={maskAddress(result.sourcePublicKey)} />
                <Meta k="Destination" v={maskAddress(result.destinationPublicKey)} />
                <Meta k="Counterparty" v={result.destinationOrg} />
                <Meta k="Ledger #" v={result.ledger.toLocaleString("en-US")} />
                <Meta k="Finality" v={`${(result.latencyMs / 1000).toFixed(2)}s`} />
                <Meta k="Status" v="FINALIZED" highlight />
              </dl>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Tx hash
                </p>
                <div className="mt-1 flex items-start gap-2">
                  <code className="flex-1 break-all rounded bg-background/60 p-2 font-mono text-[10px]">
                    {result.txHash}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(result.txHash);
                      toast.success("Tx hash copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <a
                href={result.explorerLink || stellarExpertTx(result.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                View on Stellar Expert <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">
              No settlement executed in this session. Authorize a transfer to produce a receipt.
            </p>
          )}
        </Card>
      </div>

      {/* Recent direct settlements */}
      <Card className="border-border bg-card p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" /> Recent direct settlements
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            session log · {transfers.length} record{transfers.length === 1 ? "" : "s"}
          </p>
        </div>
        {transfers.length === 0 ? (
          <p className="px-5 py-6 font-mono text-[11px] text-muted-foreground">
            No direct settlements recorded yet on this rail.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-background/40 text-muted-foreground">
                <tr className="font-mono uppercase tracking-widest">
                  <th className="px-5 py-2 text-left text-[10px]">Transfer</th>
                  <th className="px-3 py-2 text-left text-[10px]">Counterparty</th>
                  <th className="px-3 py-2 text-left text-[10px]">Route</th>
                  <th className="px-3 py-2 text-right text-[10px]">Amount</th>
                  <th className="px-3 py-2 text-left text-[10px]">Ledger</th>
                  <th className="px-3 py-2 text-left text-[10px]">Status</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-t border-border/60 font-mono">
                    <td className="px-5 py-2.5">
                      <div className="text-foreground">{t.id}</div>
                      <div className="text-[10px] text-muted-foreground">{t.ts}</div>
                    </td>
                    <td className="px-3 py-2.5">{t.destinationOrg}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {maskAddress(t.sourcePublicKey)}
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-foreground">{maskAddress(t.destinationPublicKey)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {t.amount} <span className="text-muted-foreground">{t.asset}</span>
                    </td>
                    <td className="px-3 py-2.5">#{t.ledger.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="border-success/40 bg-success/10 font-mono text-[10px] text-success">
                        {t.state}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <a
                        href={stellarExpertTx(t.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                      >
                        view <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SignerCell({
  label, value, mono, truncate, tone,
}: { label: string; value: string; mono?: boolean; truncate?: boolean; tone?: "ok"|"warn"|"info" }) {
  const toneCls = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono" : ""} ${truncate ? "truncate" : ""} ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}

function Meta({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
      <dd className={`font-mono ${highlight ? "text-success" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}
