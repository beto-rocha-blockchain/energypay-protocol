import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Panel, KpiStrip, KpiTile, SeverityBadge, StatusDot, CellNum } from "@/components/ops/primitives";
import { COUNTERPARTIES, fmtBRLm, fmtNum, fmtUTC, shortHash } from "@/lib/institutional-data";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/clearing")({
  head: () => ({
    meta: [
      { title: "Clearing House Console — EnergyPay" },
      { name: "description", content: "Bilateral contract lifecycle, margin monitoring, settlement state machine and ledger anchoring." },
    ],
  }),
  component: ClearingPage,
});

type ClrState = "INTAKE" | "VALIDATED" | "SIGNED" | "BROADCAST" | "FINALIZED" | "REJECTED";

const QUEUE_SEED: Array<{
  id: string; cp: string; volMwh: number; priceMwh: number; notional: number;
  state: ClrState; submitted: string; finality?: number; txHash?: string;
}> = [
  { id: "CLR-77821", cp: "Vale Energia",   volMwh: 1840, priceMwh: 278, notional: 511_520,  state: "FINALIZED",   submitted: new Date(Date.now() - 8*60_000).toISOString(),  finality: 4120, txHash: "9f3ab27c1d8e0a4f51b" },
  { id: "CLR-77822", cp: "Cemig D MG",     volMwh:  920, priceMwh: 264, notional: 242_880,  state: "BROADCAST",   submitted: new Date(Date.now() - 3*60_000).toISOString(),  finality: 0,    txHash: "771dffaa20419c8b00a" },
  { id: "CLR-77823", cp: "Engie BR",       volMwh: 2400, priceMwh: 291, notional: 698_400,  state: "SIGNED",      submitted: new Date(Date.now() - 90_000).toISOString() },
  { id: "CLR-77824", cp: "Equatorial NE",  volMwh:  680, priceMwh: 305, notional: 207_400,  state: "VALIDATED",   submitted: new Date(Date.now() - 40_000).toISOString() },
  { id: "CLR-77825", cp: "Klabin",         volMwh: 1250, priceMwh: 252, notional: 315_000,  state: "INTAKE",      submitted: new Date(Date.now() - 12_000).toISOString() },
  { id: "CLR-77820", cp: "Comerc",         volMwh: 1575, priceMwh: 283, notional: 445_725,  state: "REJECTED",    submitted: new Date(Date.now() - 11*60_000).toISOString() },
];

const STATES: ClrState[] = ["INTAKE", "VALIDATED", "SIGNED", "BROADCAST", "FINALIZED"];

function ClearingPage() {
  const { telemetry } = useSettlementRail();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 3000);
    return () => window.clearInterval(id);
  }, []);

  const queue = useMemo(() => QUEUE_SEED, []);
  const counts = useMemo(() => {
    const c: Record<ClrState, number> = { INTAKE: 0, VALIDATED: 0, SIGNED: 0, BROADCAST: 0, FINALIZED: 0, REJECTED: 0 };
    queue.forEach((q) => { c[q.state] += 1; });
    return c;
  }, [queue]);

  const finalized = telemetry?.counters.finalized_count ?? 1284;
  const failed = telemetry?.counters.failed_count ?? 7;
  const avgFinality = telemetry?.counters.avg_finality_ms ?? 4180;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">Clearing House · Lifecycle Console</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Clearing House Console</h1>
        </div>
        <SeverityBadge level="OK" label={`SESSION CLR-${new Date().toISOString().slice(0,10).replace(/-/g, "")}`} />
      </div>

      <KpiStrip>
        <KpiTile label="In Queue" value={fmtNum(queue.filter(q => q.state !== "FINALIZED" && q.state !== "REJECTED").length)} tone="primary" sub="awaiting confirmation" />
        <KpiTile label="Finalized · session" value={fmtNum(finalized)} tone="ok" />
        <KpiTile label="Rejected · session" value={fmtNum(failed)} tone={failed > 0 ? "warn" : "ok"} />
        <KpiTile label="Avg Finality" value={`${(avgFinality / 1000).toFixed(2)}s`} tone={avgFinality < 6000 ? "ok" : "warn"} />
        <KpiTile label="Margin Calls · pending" value="3" tone="warn" sub="2 monitored · 1 escalated" />
        <KpiTile label="Audit Checkpoints · today" value="48" tone="ok" sub="last 6m12s ago" />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Panel title="Settlement State Machine" subtitle="Lifecycle · throughput per stage" className="xl:col-span-3">
          <div className="grid grid-cols-5 gap-2">
            {STATES.map((s, i) => (
              <div key={s} className="rounded-sm border border-border bg-background/40 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="label-op">{s}</span>
                  <StatusDot tone={s === "FINALIZED" ? "ok" : s === "BROADCAST" ? "info" : "muted"} />
                </div>
                <div className="mt-1.5 kpi-num text-xl font-semibold">{counts[s]}</div>
                <div className="mt-1 h-0.5 w-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(counts[s] / Math.max(1, queue.length)) * 100}%` }} />
                </div>
                {i < STATES.length - 1 && (
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">→ next stage</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table-inst w-full">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Counterparty</th>
                  <th className="!text-right">Volume</th>
                  <th className="!text-right">Price</th>
                  <th className="!text-right">Notional</th>
                  <th>State</th>
                  <th>Ledger Anchor</th>
                  <th className="!text-right">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id}>
                    <td className="font-mono text-[11px]">{q.id}</td>
                    <td>{q.cp}</td>
                    <td className="text-right"><CellNum>{fmtNum(q.volMwh)} MWh</CellNum></td>
                    <td className="text-right"><CellNum>R$ {q.priceMwh}</CellNum></td>
                    <td className="text-right"><CellNum>{fmtBRLm(q.notional)}</CellNum></td>
                    <td>
                      <SeverityBadge
                        level={q.state === "FINALIZED" ? "OK" : q.state === "REJECTED" ? "CRITICAL" : q.state === "BROADCAST" ? "PENDING" : "INFO"}
                        label={q.state}
                      />
                    </td>
                    <td className="font-mono text-[10.5px]">{q.txHash ? <span className="text-primary">{shortHash(q.txHash)}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="text-right font-mono text-[10.5px] text-muted-foreground">{fmtUTC(q.submitted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Margin Monitoring" subtitle="Live counterparty margin envelope" className="xl:col-span-2">
          <div className="space-y-2">
            {COUNTERPARTIES.slice(0, 8).map((c) => {
              const pct = Math.min(160, Math.max(40, c.collateralRatio * 100));
              const tone = c.collateralRatio < 1.0 ? "bad" : c.collateralRatio < 1.1 ? "warn" : "ok";
              return (
                <div key={c.id} className="rounded-sm border border-border bg-background/40 px-2.5 py-2">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="font-display font-medium">{c.shortName}</span>
                    <CellNum tone={tone}>{c.collateralRatio.toFixed(2)}×</CellNum>
                  </div>
                  <div className="mt-1 h-1 w-full bg-muted overflow-hidden">
                    <div className={`h-full ${tone === "bad" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-success"}`} style={{ width: `${(pct / 160) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                    <span>{fmtBRLm(c.exposureBRL)} exposure</span>
                    <span>{fmtBRLm(c.collateralBRL)} pledged</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Audit Checkpoint Timeline" subtitle="Immutable lifecycle anchors · last 90 minutes">
        <ol className="relative space-y-0">
          {[
            { ts: 0,  label: "Session opened",            icon: Circle, tone: "info" as const, meta: "operator · supervisor.dias" },
            { ts: 4,  label: "Margin re-evaluation",      icon: CheckCircle2, tone: "ok" as const, meta: "Δ ratio reviewed for 16 CPs" },
            { ts: 11, label: "Contract intake batch #41", icon: CheckCircle2, tone: "ok" as const, meta: "9 tickets · 23 ledger ops" },
            { ts: 19, label: "Comerc margin call",        icon: AlertTriangle, tone: "warn" as const, meta: "0.97× ratio · 1.05× target" },
            { ts: 26, label: "Ledger anchor finalized",   icon: CheckCircle2, tone: "ok" as const, meta: "block 51 224 197 · 4 anchors" },
            { ts: 38, label: "Oracle override · PLD NE",  icon: AlertTriangle, tone: "warn" as const, meta: "fallback B engaged" },
            { ts: 51, label: "Settlement window closed",  icon: CheckCircle2, tone: "ok" as const, meta: "$8.4M cleared" },
          ].map((e, i) => (
            <li key={i} className="relative flex gap-3 border-l border-border py-2 pl-4">
              <span className={`absolute -left-[5px] top-3 inline-block h-2.5 w-2.5 rounded-full ${e.tone === "ok" ? "bg-success" : e.tone === "warn" ? "bg-warning" : "bg-primary"}`} />
              <div className="flex flex-1 items-center justify-between text-[11.5px]">
                <span className="font-display font-medium">{e.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{e.meta} · −{e.ts}m</span>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
