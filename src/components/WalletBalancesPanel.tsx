import { useCallback, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getSession } from "@/lib/session";
import {
  Wallet,
  Coins,
  Activity,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Zap,
  CheckCircle2,
  Gauge,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { stellarExpertAccount, STELLAR_NETWORK_LABEL } from "@/lib/stellar";
import { maskAddress } from "@/store/operator";
import { toast } from "sonner";

type Props = {
  publicKey: string;
  organization?: string;
  funded?: boolean;
};

const fmtAmount = (raw: string, decimals = 4) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 2 });
};

const sinceMs = (iso: string | null) => (iso ? Date.now() - new Date(iso).getTime() : null);

export function WalletBalancesPanel({ publicKey, organization, funded }: Props) {
  const { data, error, loading, fetchedAt, refreshCount, refresh } = useWalletBalances(publicKey);
  const [copied, setCopied] = useState(false);

  const xlm = data?.balances?.xlm ?? "0";
  const eprw = data?.balances?.eprw ?? "0";
  const xlmNum = Number(xlm);
  const eprwNum = Number(eprw);

  const health = useMemo(() => {
    if (error) return { label: "DEGRADED", tone: "warn" as const };
    if (!data) return { label: "INITIALIZING", tone: "muted" as const };
    if (xlmNum < 1) return { label: "LOW RESERVE", tone: "warn" as const };
    return { label: "OPERATIONAL", tone: "ok" as const };
  }, [data, error, xlmNum]);

  const trustline = data?.summary?.eprw_trustline ?? (!!data && eprwNum > 0);
  const latency = data?.latency_ms ?? null;
  const [enablingTrustline, setEnablingTrustline] = useState(false);

  const handleEnableEPWR = useCallback(async () => {
    setEnablingTrustline(true);
    try {
      const session = getSession();
      const res = await fetch(`${API_BASE_URL}/api/token/trustline/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) {
        toast.success("EPWR trustline created successfully");
        refresh();
      } else {
        toast.error(json.error || "Failed to create trustline");
      }
    } catch (err) {
      toast.error("Network error creating trustline");
    } finally {
      setEnablingTrustline(false);
    }
  }, [refresh]);

  // Sell EPWR → XLM
  const [sellAmount, setSellAmount] = useState("10");
  const [selling, setSelling] = useState(false);
  const [sellResult, setSellResult] = useState<{
    success: boolean;
    epwr_sold?: string;
    xlm_received?: string;
    hash?: string;
    error?: string;
  } | null>(null);

  const handleSellEPWR = useCallback(async () => {
    const amt = Number(sellAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid EPWR amount.");
      return;
    }
    if (amt > eprwNum) {
      toast.error(`Insufficient EPWR balance. You have ${fmtAmount(eprw, 2)} EPWR.`);
      return;
    }
    setSelling(true);
    setSellResult(null);
    try {
      const session = getSession();
      const res = await fetch(`${API_BASE_URL}/api/token/sell/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ amount: sellAmount }),
      });
      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Backend returned HTTP ${res.status} — restart the backend and try again.`);
      }
      if (json.success) {
        setSellResult(json as never);
        toast.success(`Redeemed ${json.epwr_sold} EPWR for ${json.xlm_received} XLM`);
        refresh();
      } else {
        const msg = (json.error as string) || "Redemption failed";
        setSellResult({ success: false, error: msg });
        toast.error(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error during redemption";
      toast.error(msg);
    } finally {
      setSelling(false);
    }
  }, [sellAmount, eprwNum, eprw, refresh]);

  // Buy EPWR
  const [buyAmount, setBuyAmount] = useState("10");
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<{
    success: boolean;
    epwr_amount?: string;
    xlm_paid?: string;
    hash?: string;
    error?: string;
  } | null>(null);

  const handleBuyEPWR = useCallback(async () => {
    const amt = Number(buyAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid EPWR amount.");
      return;
    }
    setBuying(true);
    setBuyResult(null);
    try {
      const session = getSession();
      const res = await fetch(`${API_BASE_URL}/api/token/buy/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({ amount: buyAmount }),
      });
      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Backend returned HTTP ${res.status} — restart the backend and try again.`);
      }
      if (json.success) {
        setBuyResult(json as never);
        toast.success(`Purchased ${json.epwr_amount} EPWR for ${json.xlm_paid} XLM`);
        refresh();
      } else {
        const msg = (json.error as string) || "Purchase failed";
        setBuyResult({ success: false, error: msg });
        toast.error(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error during purchase";
      toast.error(msg);
    } finally {
      setBuying(false);
    }
  }, [buyAmount, refresh]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Public key copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Treasury / Settlement Wallet
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            Live Wallet Balances
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time Horizon-backed balances for the operator's settlement custody account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            <Radio className="mr-1.5 h-3 w-3 text-success" /> {STELLAR_NETWORK_LABEL}
          </Badge>
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase tracking-widest ${
              health.tone === "ok"
                ? "border-success/40 text-success"
                : health.tone === "warn"
                  ? "border-destructive/40 text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            <Activity className="mr-1.5 h-3 w-3" /> {health.label}
          </Badge>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Wallet identity strip */}
      <Card className="border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <Wallet className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Settlement Custody Account
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-sm">{maskAddress(publicKey)}</span>
                <button
                  onClick={handleCopy}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Copy public key"
                >
                  {copied ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={stellarExpertAccount(publicKey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Open in Stellar Expert"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              {organization && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{organization}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <Indicator
              label="Funded"
              value={data?.account_funded || funded ? "YES" : "—"}
              tone={data?.account_funded || funded ? "ok" : "muted"}
            />
            <Indicator
              label="Trustline"
              value={trustline ? "EPWR" : "PENDING"}
              tone={trustline ? "ok" : "warn"}
            />
            <Indicator
              label="Reserve"
              value={xlmNum >= 1 ? "OK" : "LOW"}
              tone={xlmNum >= 1 ? "ok" : "warn"}
            />
          </div>
        </div>
      </Card>

      {/* Error banner */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-widest text-destructive">
                Balance Feed Degraded
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={refresh}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Balance glow cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BalanceGlowCard
          symbol="XLM"
          label="Stellar Lumens"
          tagline="Network reserve · operational gas"
          icon={<Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />}
          loading={loading && !data}
          amount={fmtAmount(xlm, 4)}
        />
        <BalanceGlowCard
          symbol="EPWR"
          label="EnergyPay Receivable"
          tagline="Tokenized energy settlement asset"
          icon={<Coins className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />}
          loading={loading && !data}
          amount={fmtAmount(eprw, 2)}
        />
      </div>

      {/* Buy EPWR Panel */}
      {trustline && data && (
        <Card className="border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <ArrowRightLeft className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Token Exchange
              </p>
              <p className="font-display text-base font-semibold">Buy EPWR with XLM</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr_auto]  md:items-end">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                EPWR Amount
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="10"
                className="h-9 font-mono text-sm"
                disabled={buying}
              />
            </div>

            <div className="hidden md:flex items-center justify-center pt-5 text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                XLM Cost (1:1)
              </Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/50 px-3 font-mono text-sm text-muted-foreground">
                {Number(buyAmount) > 0 ? Number(buyAmount).toFixed(2) : "0.00"} XLM
              </div>
            </div>

            <Button
              onClick={handleBuyEPWR}
              disabled={buying || !buyAmount || Number(buyAmount) <= 0 || xlmNum < Number(buyAmount)}
              className="h-9 font-mono text-xs uppercase tracking-widest"
            >
              {buying ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Coins className="mr-1.5 h-3.5 w-3.5" />
              )}
              {buying ? "Processing…" : "Buy EPWR"}
            </Button>
          </div>

          {xlmNum > 0 && xlmNum < Number(buyAmount) && (
            <p className="mt-2 font-mono text-[10px] text-destructive">
              Insufficient XLM balance. You have {fmtAmount(xlm, 4)} XLM.
            </p>
          )}

          {buyResult?.success && (
            <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-mono text-[11px] uppercase tracking-widest">
                  Purchase confirmed
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
                <span className="text-muted-foreground">EPWR received</span>
                <span className="text-foreground">{buyResult.epwr_amount}</span>
                <span className="text-muted-foreground">XLM paid</span>
                <span className="text-foreground">{buyResult.xlm_paid}</span>
                {buyResult.hash && (
                  <>
                    <span className="text-muted-foreground">Tx Hash</span>
                    <a
                      href={`https://stellar.expert/explorer/public/tx/${buyResult.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {buyResult.hash.slice(0, 8)}…{buyResult.hash.slice(-8)}
                      <ExternalLink className="ml-1 inline h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
          )}

          {buyResult && !buyResult.success && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-mono text-[11px]">{buyResult.error}</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Sell EPWR → XLM Panel */}
      {trustline && data && eprwNum > 0 && (
        <Card className="border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <ArrowRightLeft className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Token Redemption
              </p>
              <p className="font-display text-base font-semibold">Sell EPWR · Get XLM</p>
            </div>
            <div className="ml-auto rounded-md border border-border bg-background/40 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
              Available: <span className="text-foreground font-semibold">{fmtAmount(eprw, 2)} EPWR</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                EPWR to Sell
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0.01"
                  max={eprwNum}
                  step="0.01"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="10"
                  className="h-9 font-mono text-sm pr-16"
                  disabled={selling}
                />
                <button
                  type="button"
                  onClick={() => setSellAmount(String(Math.floor(eprwNum * 100) / 100))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-widest text-primary hover:underline"
                  disabled={selling}
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-center pt-5 text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                XLM to Receive (1:1)
              </Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/50 px-3 font-mono text-sm text-muted-foreground">
                {Number(sellAmount) > 0 ? Number(sellAmount).toFixed(2) : "0.00"} XLM
              </div>
            </div>

            <Button
              onClick={handleSellEPWR}
              disabled={
                selling ||
                !sellAmount ||
                Number(sellAmount) <= 0 ||
                Number(sellAmount) > eprwNum
              }
              variant="outline"
              className="h-9 font-mono text-xs uppercase tracking-widest border-primary/40 text-primary hover:bg-primary/10"
            >
              {selling ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
              )}
              {selling ? "Processing…" : "Sell EPWR"}
            </Button>
          </div>

          {Number(sellAmount) > eprwNum && eprwNum > 0 && (
            <p className="mt-2 font-mono text-[10px] text-destructive">
              Insufficient EPWR balance. You have {fmtAmount(eprw, 2)} EPWR.
            </p>
          )}

          {sellResult?.success && (
            <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-mono text-[11px] uppercase tracking-widest">
                  Redemption confirmed
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
                <span className="text-muted-foreground">EPWR sold</span>
                <span className="text-foreground">{sellResult.epwr_sold}</span>
                <span className="text-muted-foreground">XLM received</span>
                <span className="text-foreground">{sellResult.xlm_received}</span>
                {sellResult.hash && (
                  <>
                    <span className="text-muted-foreground">Tx Hash</span>
                    <a
                      href={`https://stellar.expert/explorer/public/tx/${sellResult.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {sellResult.hash.slice(0, 8)}…{sellResult.hash.slice(-8)}
                      <ExternalLink className="ml-1 inline h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
          )}

          {sellResult && !sellResult.success && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-mono text-[11px]">{sellResult.error}</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Telemetry + Activity */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Operational Telemetry
          </p>
          <div className="mt-3 space-y-2">
            <TelemetryRow
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="Backend latency"
              value={latency != null ? `${latency} ms` : "—"}
              tone={latency != null && latency < 600 ? "ok" : "warn"}
            />
            <TelemetryRow
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              label="Refresh cadence"
              value="10 s"
              tone="muted"
            />
            <TelemetryRow
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Polls completed"
              value={String(refreshCount)}
              tone="muted"
            />
            <TelemetryRow
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="Last update"
              value={
                fetchedAt
                  ? `${Math.max(0, Math.round((sinceMs(fetchedAt) ?? 0) / 1000))}s ago`
                  : "—"
              }
              tone={fetchedAt ? "ok" : "muted"}
            />
          </div>
        </Card>

        <Card className="border-border bg-card p-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Blockchain Activity
            </p>
            <a
              href={stellarExpertAccount(publicKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
            >
              View on Stellar Expert
              <ExternalLink className="ml-1 inline h-3 w-3" />
            </a>
          </div>

          <div className="mt-3 space-y-2 font-mono text-[11px]">
            <ActivityLine
              ok={!loading && !error}
              text={
                loading && !data
                  ? "Initializing balance feed…"
                  : data
                    ? `Horizon snapshot resolved · ${data.checked_at.slice(11, 19)}`
                    : error
                      ? "Horizon snapshot unavailable"
                      : "Awaiting first sample"
              }
            />
            <ActivityLine
              ok={trustline}
              text={trustline ? "Trustline EPWR established" : "EPWR trustline not yet detected"}
            />
            {!trustline && data && !loading && (
              <Button
                size="sm"
                variant="outline"
                className="ml-5 h-6 text-[10px] uppercase tracking-wider"
                disabled={enablingTrustline}
                onClick={handleEnableEPWR}
              >
                {enablingTrustline ? "Enabling…" : "Enable EPWR"}
              </Button>
            )}
            <ActivityLine
              ok={data?.account_funded || funded || false}
              text={data?.account_funded || funded ? "Account funded on ledger" : "Account funding unconfirmed"}
            />
            <ActivityLine
              ok={xlmNum >= 1}
              text={
                xlmNum >= 1
                  ? "Reserve sufficient for fee submission"
                  : "Reserve below 1 XLM threshold"
              }
            />
            <ActivityLine
              ok={!error}
              text={error ? `Backend rail: ${error}` : "Backend settlement rail responsive"}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Indicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-xs font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function BalanceGlowCard({
  symbol,
  label,
  tagline,
  icon,
  loading,
  amount,
}: {
  symbol: string;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  loading: boolean;
  amount: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border bg-card p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 font-display text-sm text-muted-foreground">{tagline}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          {icon}
        </div>
      </div>

      <div className="relative mt-5 flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-10 w-44" />
        ) : (
          <>
            <span className="font-display text-4xl font-semibold tracking-tight">{amount}</span>
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {symbol}
            </span>
          </>
        )}
      </div>

      <div className="relative mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Activity className="h-3 w-3 text-success" />
        Live · Horizon settlement rail
      </div>
    </Card>
  );
}

function TelemetryRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-[11px] ${color}`}>{value}</span>
    </div>
  );
}

function ActivityLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          ok
            ? "bg-success shadow-[0_0_6px_var(--success,theme(colors.green.500))]"
            : "bg-destructive"
        }`}
      />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
