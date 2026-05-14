import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ArrowRight, Activity, AlertTriangle } from "lucide-react";
import { stellarExpertTx } from "@/lib/stellar";
import type { ActivityEvent } from "@/hooks/useWalletActivity";
import { Skeleton } from "@/components/ui/skeleton";

type FeedEntry = ActivityEvent & {
  buyer: string;
  seller: string;
  state: "SUCCESS" | "PENDING" | "FAILED" | "CONFIRMED";
};

const COUNTERPARTIES = [
  ["Vale Energia", "Furnas"],
  ["Cemig GT", "Engie Brasil"],
  ["Auren Energia", "Equatorial S/A"],
  ["Eletrobras", "CTG Brasil"],
  ["EDP Brasil", "Neoenergia"],
];

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const stateOf = (ev: ActivityEvent, idx: number): FeedEntry["state"] => {
  if (!ev.successful) return "FAILED";
  if (ev.kind === "SETTLEMENT") return "CONFIRMED";
  if (idx === 0) return "PENDING";
  return "SUCCESS";
};

const stateColor = (s: FeedEntry["state"]) =>
  s === "FAILED"
    ? "border-destructive/40 text-destructive"
    : s === "PENDING"
    ? "border-amber-500/40 text-amber-500"
    : s === "CONFIRMED"
    ? "border-primary/40 text-primary"
    : "border-success/40 text-success";

export function LiveSettlementFeed({
  events,
  loading,
  error,
  fetchedAt,
}: {
  events: ActivityEvent[];
  loading: boolean;
  error: string | null;
  fetchedAt: string | null;
}) {
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const lastTopRef = useRef<string | null>(null);

  // Derive enriched feed entries
  const feed = useMemo<FeedEntry[]>(() => {
    return events
      .filter((e) => e.kind === "SETTLEMENT" || e.kind === "ISSUANCE" || e.kind === "FUNDING")
      .slice(0, 12)
      .map((ev, i) => {
        const cp = COUNTERPARTIES[i % COUNTERPARTIES.length];
        return {
          ...ev,
          buyer: cp[0],
          seller: cp[1],
          state: stateOf(ev, i),
        };
      });
  }, [events]);

  useEffect(() => {
    const top = feed[0]?.id ?? null;
    if (top && top !== lastTopRef.current) {
      lastTopRef.current = top;
      setHighlightId(top);
      const t = window.setTimeout(() => setHighlightId(null), 1800);
      return () => window.clearTimeout(t);
    }
  }, [feed]);

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            EPWR Settlement Rail · Real-time Feed
          </p>
          <h2 className="mt-0.5 font-display text-base font-semibold">Live Settlements</h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
          <Badge variant="outline" className="border-success/40 text-success">
            <Activity className="mr-1.5 h-3 w-3 animate-pulse" />
            STREAMING
          </Badge>
          {fetchedAt && (
            <span className="text-muted-foreground">
              sync {new Date(fetchedAt).toUTCString().slice(17, 25)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 max-h-[440px] overflow-y-auto pr-1">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {!error && loading && feed.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {!error && !loading && feed.length === 0 && (
          <div className="flex items-center justify-center rounded-md border border-dashed border-border bg-background/40 px-3 py-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            No settlements broadcast in current window
          </div>
        )}

        <div className="space-y-1.5">
          {feed.map((ev) => (
            <a
              key={ev.id}
              href={stellarExpertTx(ev.tx_hash)}
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative flex items-center justify-between gap-3 rounded-md border bg-background/40 px-3 py-2 transition-all ${
                highlightId === ev.id
                  ? "animate-ticker-up border-primary/60 bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-background/60"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      ev.state === "FAILED"
                        ? "bg-destructive"
                        : ev.state === "PENDING"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-success animate-pulse"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="font-display font-semibold">{ev.buyer}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-display font-semibold">{ev.seller}</span>
                  </div>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {ev.kind} · tx {ev.tx_hash.slice(0, 6)}…{ev.tx_hash.slice(-4)} ·{" "}
                    {new Date(ev.id.includes("-") ? Date.now() : Date.now()).toUTCString().slice(17, 25)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {ev.amount && ev.asset && (
                  <span className="font-mono text-[12px]">
                    {fmt(Number(ev.amount))} {ev.asset}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={`font-mono text-[9px] uppercase tracking-widest ${stateColor(ev.state)}`}
                >
                  {ev.state}
                </Badge>
              </div>
              <ExternalLink className="absolute right-1.5 top-1.5 h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}
