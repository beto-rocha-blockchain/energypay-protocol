import { useMemo } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  ExternalLink,
  Link2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { stellarExpertTx, stellarExpertAccount } from "@/lib/stellar";
import { useWalletActivity, type ActivityEvent } from "@/hooks/useWalletActivity";

type Props = { publicKey: string };

const KIND_META: Record<
  ActivityEvent["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  FUNDING: { label: "FUNDING", icon: Sparkles },
  ISSUANCE: { label: "ISSUANCE", icon: Coins },
  TRUSTLINE: { label: "TRUSTLINE", icon: Link2 },
  SETTLEMENT: { label: "SETTLEMENT", icon: Wallet },
  OFFER: { label: "DEX", icon: Activity },
  OTHER: { label: "OPERATION", icon: ShieldCheck },
};

const SEVERITY_TONE: Record<ActivityEvent["severity"], string> = {
  ok: "border-success/40 text-success",
  info: "border-primary/40 text-primary",
  warn: "border-amber-500/40 text-amber-500",
  critical: "border-destructive/40 text-destructive",
};

const SEVERITY_DOT: Record<ActivityEvent["severity"], string> = {
  ok: "bg-success shadow-[0_0_6px_currentColor]",
  info: "bg-primary",
  warn: "bg-amber-500",
  critical: "bg-destructive",
};

const fmtRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const fmtAbsolute = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
};

export function BlockchainActivityFeed({ publicKey }: Props) {
  const { events, loading, error, fetchedAt, latency, refresh, refreshCount } =
    useWalletActivity(publicKey);

  const grouped = useMemo(() => {
    const out: { day: string; items: ActivityEvent[] }[] = [];
    for (const ev of events) {
      const day = ev.created_at.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(ev);
      else out.push({ day, items: [ev] });
    }
    return out;
  }, [events]);

  return (
    <Card className="border-border bg-card p-4 md:p-5">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            On-Chain Telemetry
          </p>
          <h3 className="mt-0.5 font-display text-lg font-semibold tracking-tight">
            Blockchain Activity Feed
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
          >
            <Activity className="mr-1.5 h-3 w-3 text-success" />
            Polling · 15s
          </Badge>
          {latency != null && (
            <Badge
              variant="outline"
              className={`font-mono text-[10px] uppercase tracking-widest ${
                latency < 800 ? "border-success/40 text-success" : "border-amber-500/40 text-amber-500"
              }`}
            >
              Horizon {latency}ms
            </Badge>
          )}
          <a
            href={stellarExpertAccount(publicKey)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
          >
            Account · Stellar Expert
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading && events.length === 0}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div className="flex-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-destructive">
              Activity Feed Degraded
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && events.length === 0 && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && events.length === 0 && (
        <div className="mt-6 rounded-md border border-dashed border-border bg-background/40 p-6 text-center">
          <Activity className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            No on-chain operations recorded yet.
          </p>
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div className="mt-4 space-y-5">
          {grouped.map(({ day, items }) => (
            <div key={day}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {day}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {items.length} event{items.length === 1 ? "" : "s"}
                </span>
              </div>
              <ol className="relative space-y-1.5 border-l border-border pl-4">
                {items.map((ev) => (
                  <ActivityRow key={ev.id} event={ev} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* Footer telemetry */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>
          {fetchedAt ? `Last sync · ${fmtRelative(fetchedAt)}` : "Awaiting first sample"}
        </span>
        <span>Polls · {refreshCount}</span>
        <span>Stellar Testnet · Horizon</span>
      </div>
    </Card>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const Meta = KIND_META[event.kind];
  const Icon = Meta.icon;
  const Directional =
    event.kind === "SETTLEMENT" && event.title.toLowerCase().includes("received")
      ? ArrowDownLeft
      : event.kind === "SETTLEMENT"
      ? ArrowUpRight
      : null;

  return (
    <li className="group relative">
      <span
        className={`absolute -left-[21px] top-2.5 inline-block h-2 w-2 rounded-full ${
          SEVERITY_DOT[event.severity]
        }`}
      />
      <a
        href={stellarExpertTx(event.tx_hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md border border-border bg-background/30 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-background/60"
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${SEVERITY_TONE[event.severity]} bg-background/60`}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {Meta.label}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">·</span>
              <span className="flex items-center gap-1 font-display text-sm font-semibold">
                {Directional && <Directional className="h-3.5 w-3.5" />}
                {event.title}
              </span>
              {!event.successful && (
                <Badge variant="outline" className="border-destructive/40 font-mono text-[9px] uppercase text-destructive">
                  FAILED
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{event.detail}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
              <span title={fmtAbsolute(event.created_at)}>{fmtRelative(event.created_at)}</span>
              {event.amount && event.asset && (
                <span className="text-foreground">
                  {Number(event.amount).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {event.asset}
                </span>
              )}
              <span className="truncate">tx {event.tx_hash.slice(0, 8)}…{event.tx_hash.slice(-6)}</span>
            </div>
          </div>

          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </a>
    </li>
  );
}
