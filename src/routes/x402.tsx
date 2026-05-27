import { createFileRoute } from "@tanstack/react-router";
import { STELLAR_NETWORK_LABEL, STELLAR_NETWORK } from "@/lib/stellar";
import { useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Copy,
  DatabaseZap,
  ExternalLink,
  KeyRound,
  Lock,
  Radio,
  ShieldCheck,
  Terminal,
  Unlock,
  Zap,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/x402")({
  head: () => ({
    meta: [
      { title: "x402 API Access — EnergyPay" },
      {
        name: "description",
        content:
          "x402-compatible HTTP 402 payment flow for EnergyPay premium energy market APIs.",
      },
    ],
  }),
  component: X402Page,
});

type PaymentRequirement = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  destination: string;
  memo: string;
  description: string;
  resource: string;
};

type X402StatusResponse = {
  status: string;
  protocol: string;
  network: string;
  resource: string;
  payment_required: PaymentRequirement;
};

type PaymentRequiredResponse = {
  error: string;
  code: string;
  message: string;
  payment_required: PaymentRequirement;
  retry_with_header: string;
};

type AccessGrantedResponse = {
  status: "ACCESS_GRANTED";
  protocol: string;
  network: string;
  resource: string;
  payment: {
    ok: true;
    txHash: string;
    ledger: number;
    from: string;
    to: string;
    asset: string;
    amount: string;
    memo: string;
    explorer_url: string;
  };
  data: {
    market: string;
    subsystem: string;
    pld_brl_mwh: number;
    settlement_window: string;
    source: string;
    timestamp: string;
  };
};

type LogLine = {
  ts: string;
  level: "info" | "ok" | "warn";
  text: string;
};

const short = (value?: string) =>
  value && value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value || "—";

const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });

async function readJson<T>(res: Response): Promise<T | null> {
  return (await res.json().catch(() => null)) as T | null;
}

function X402Page() {
  const [requirement, setRequirement] = useState<PaymentRequirement | null>(null);
  const [lockedResponse, setLockedResponse] = useState<PaymentRequiredResponse | null>(null);
  const [accessGranted, setAccessGranted] = useState<AccessGrantedResponse | null>(null);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState<"status" | "request" | "unlock" | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);

  const paymentHeader = useMemo(
    () => (txHash.trim() ? `PAYMENT-SIGNATURE: stellar-mainnet:${txHash.trim()}` : ""),
    [txHash],
  );

  const append = (text: string, level: LogLine["level"] = "info") => {
    setLogs((prev) => [{ ts: now(), text, level }, ...prev].slice(0, 12));
  };

  const checkStatus = async () => {
    setLoading("status");
    setAccessGranted(null);

    try {
      append("→ GET /api/x402/status");
      const res = await fetch(`${API_BASE_URL}/api/x402/status`);
      const data = await readJson<X402StatusResponse>(res);

      if (!res.ok || !data?.payment_required) {
        throw new Error(`Status request failed with HTTP ${res.status}`);
      }

      setRequirement(data.payment_required);
      append(`✓ x402 protocol online · ${data.network}`, "ok");
      toast.success("x402 status online");
    } catch (error) {
      append(`✗ ${(error as Error).message}`, "warn");
      toast.error("Unable to read x402 status");
    } finally {
      setLoading(null);
    }
  };

  const requestProtectedFeed = async () => {
    setLoading("request");
    setAccessGranted(null);

    try {
      append("→ GET /api/x402/pld without payment proof");
      const res = await fetch(`${API_BASE_URL}/api/x402/pld`);
      const data = await readJson<PaymentRequiredResponse>(res);

      if (res.status !== 402 || !data?.payment_required) {
        throw new Error(`Expected HTTP 402, received HTTP ${res.status}`);
      }

      setLockedResponse(data);
      setRequirement(data.payment_required);
      append("✓ HTTP 402 Payment Required received", "ok");
      append("✓ PAYMENT-REQUIRED metadata returned by backend", "ok");
      toast.success("Payment required metadata received");
    } catch (error) {
      append(`✗ ${(error as Error).message}`, "warn");
      toast.error("Protected API request failed");
    } finally {
      setLoading(null);
    }
  };

  const unlockWithPayment = async () => {
    const cleanTx = txHash.trim();

    if (!cleanTx) {
      toast.error(`Paste a ${STELLAR_NETWORK_LABEL} transaction hash first`);
      return;
    }

    setLoading("unlock");

    try {
      append("→ Retrying /api/x402/pld with PAYMENT-SIGNATURE");
      const res = await fetch(`${API_BASE_URL}/api/x402/pld`, {
        headers: {
          "PAYMENT-SIGNATURE": `stellar-mainnet:${cleanTx}`,
        },
      });

      const data = await readJson<AccessGrantedResponse | PaymentRequiredResponse>(res);

      if (!res.ok || !data || !("status" in data) || data.status !== "ACCESS_GRANTED") {
        const reason =
          data && "message" in data ? data.message : `Unlock failed with HTTP ${res.status}`;
        throw new Error(reason);
      }

      setAccessGranted(data);
      append(`✓ ACCESS_GRANTED · ledger #${data.payment.ledger}`, "ok");
      append("✓ Premium PLD market data unlocked", "ok");
      toast.success("Premium PLD feed unlocked");
    } catch (error) {
      append(`✗ ${(error as Error).message}`, "warn");
      toast.error("Payment verification failed");
    } finally {
      setLoading(null);
    }
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Programmable API Monetization
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            x402 Energy API Access
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Demonstrates an x402-compatible HTTP 402 payment flow for premium PLD market data,
            using {STELLAR_NETWORK_LABEL} transactions as verifiable payment proofs.
          </p>
        </div>

        <Badge className="gap-2 border-primary/30 bg-primary/10 px-3 py-1 text-primary">
          <Radio className="h-3.5 w-3.5" />
          {STELLAR_NETWORK_LABEL}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <DatabaseZap className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Premium PLD Feed</h2>
              <p className="text-xs text-muted-foreground">
                Protected API resource: <span className="font-mono">/api/x402/pld</span>
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Button onClick={checkStatus} disabled={loading !== null} variant="secondary">
              <Activity className="mr-2 h-4 w-4" />
              Check Status
            </Button>

            <Button onClick={requestProtectedFeed} disabled={loading !== null}>
              <Lock className="mr-2 h-4 w-4" />
              Request Feed
            </Button>

            <Button onClick={unlockWithPayment} disabled={loading !== null}>
              <Unlock className="mr-2 h-4 w-4" />
              Unlock with txHash
            </Button>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-background/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Payment Requirement
              </p>
              <Badge variant={lockedResponse ? "default" : "secondary"}>
                {lockedResponse ? "HTTP 402 RECEIVED" : "WAITING"}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Asset" value={requirement?.asset} />
              <Info label="Amount" value={requirement?.amount} />
              <Info label="Network" value={requirement?.network} />
              <Info label="Memo" value={requirement?.memo} />
            </div>

            <div className="mt-3">
              <Info label="Destination" value={short(requirement?.destination)} mono />
              {requirement?.destination ? (
                <Button
                  className="mt-2 h-8"
                  size="sm"
                  variant="outline"
                  onClick={() => copy(requirement.destination, "Destination")}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy destination
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Label htmlFor="txHash">{STELLAR_NETWORK_LABEL} txHash</Label>
            <Input
              id="txHash"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder={`Paste the ${STELLAR_NETWORK_LABEL} payment transaction hash`}
              className="font-mono text-xs"
            />
            {paymentHeader ? (
              <div className="rounded-md border border-border bg-background/70 p-3">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Retry Header
                </p>
                <code className="break-all text-xs text-primary">{paymentHeader}</code>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="border-border/70 bg-card/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Verification State</h2>
              <p className="text-xs text-muted-foreground">
                Horizon validation of memo, destination and amount.
              </p>
            </div>
          </div>

          {accessGranted ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-primary" />
                  <p className="font-mono text-sm font-semibold text-primary">ACCESS_GRANTED</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Premium market data unlocked after {STELLAR_NETWORK_LABEL} payment verification.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Ledger" value={String(accessGranted.payment.ledger)} />
                <Info label="Amount Paid" value={`${accessGranted.payment.amount} XLM`} />
                <Info label="From" value={short(accessGranted.payment.from)} mono />
                <Info label="To" value={short(accessGranted.payment.to)} mono />
              </div>

              <div className="rounded-lg border border-border bg-background/70 p-4">
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Premium Data
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Market" value={accessGranted.data.market} />
                  <Info label="Subsystem" value={accessGranted.data.subsystem} />
                  <Info label="PLD BRL/MWh" value={String(accessGranted.data.pld_brl_mwh)} />
                  <Info label="Window" value={accessGranted.data.settlement_window} />
                </div>
              </div>

              <Button asChild variant="outline">
                <a href={accessGranted.payment.explorer_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View payment on Stellar Expert
                </a>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/50 p-6 text-center">
              <KeyRound className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Awaiting payment proof</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Request the protected feed, execute the Stellar payment, then paste the txHash.
              </p>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-border bg-background/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                x402 Execution Log
              </p>
            </div>

            <div className="space-y-2">
              {logs.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground">
                  No requests executed yet.
                </p>
              ) : (
                logs.map((line, index) => (
                  <div key={`${line.ts}-${index}`} className="font-mono text-xs">
                    <span className="text-muted-foreground">[{line.ts}] </span>
                    <span
                      className={
                        line.level === "ok"
                          ? "text-primary"
                          : line.level === "warn"
                            ? "text-destructive"
                            : "text-foreground"
                      }
                    >
                      {line.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/70 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Zap className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            x402 does not replace EnergyPay’s institutional settlement engine. It adds a
            programmable monetization layer for paid energy APIs, oracle feeds and
            machine-to-machine market data access.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}