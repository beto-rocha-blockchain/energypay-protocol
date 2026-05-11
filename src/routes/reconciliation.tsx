import { createFileRoute } from "@tanstack/react-router";
import { Panel, KpiStrip, KpiTile, SeverityBadge, StatusDot, CellNum } from "@/components/ops/primitives";
import { RECON_EXCEPTIONS, fmtUTC } from "@/lib/institutional-data";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({
    meta: [
      { title: "Reconciliation Engine — EnergyPay" },
      { name: "description", content: "Automated reconciliation pipeline, oracle verification and ledger validation." },
    ],
  }),
  component: ReconciliationPage,
});

const STAGES = [
  { name: "Ingest",   tps: 1240, ok: 99.92, sla: 250 },
  { name: "Match",    tps: 1235, ok: 99.78, sla: 480 },
  { name: "Verify",   tps: 1232, ok: 99.66, sla: 720 },
  { name: "Anchor",   tps: 1228, ok: 99.51, sla: 4200 },
  { name: "Confirm",  tps: 1226, ok: 99.40, sla: 5800 },
];

function ReconciliationPage() {
  const open = RECON_EXCEPTIONS.filter((e) => e.state !== "RESOLVED");
  const critical = RECON_EXCEPTIONS.filter((e) => e.severity === "CRITICAL").length;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">Reconciliation · Continuous Pipeline</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Reconciliation Engine</h1>
        </div>
        <SeverityBadge level={critical > 0 ? "CRITICAL" : "OK"} label={`${open.length} OPEN · ${critical} CRITICAL`} />
      </div>

      <KpiStrip>
        <KpiTile label="Pipeline TPS" value="1 226" tone="primary" sub="rolling 5m" />
        <KpiTile label="Open Exceptions" value={open.length} tone={open.length > 8 ? "warn" : "ok"} />
        <KpiTile label="Critical" value={critical} tone={critical > 0 ? "bad" : "ok"} />
        <KpiTile label="Auto-Resolved · 24h" value="3 184" tone="ok" sub="97.4% rate" />
        <KpiTile label="Oracle Divergence" value="0.06%" tone="ok" sub="vs PLD reference" />
        <KpiTile label="Audit Anchors · 24h" value="48" tone="ok" sub="block 51 224 197" />
      </KpiStrip>

      <Panel title="Reconciliation Pipeline" subtitle="Stage throughput · SLA envelope · success rate">
        <div className="flex flex-wrap items-stretch gap-2">
          {STAGES.map((s, i) => (
            <div key={s.name} className="flex flex-1 items-center gap-2 min-w-[180px]">
              <div className="flex-1 rounded-sm border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="label-op">{s.name}</span>
                  <StatusDot tone={s.ok > 99.7 ? "ok" : "warn"} />
                </div>
                <div className="kpi-num mt-1 text-xl font-semibold">{s.tps.toLocaleString()}</div>
                <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>tx/min</span>
                  <span className={s.ok > 99.7 ? "text-success" : "text-warning"}>{s.ok}% ok</span>
                </div>
                <div className="mt-1 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                  SLA p95 · {s.sla} ms
                </div>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel title="Exception Queue" subtitle="Open mismatches · age-sorted" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="table-inst w-full">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Counterparty</th>
                  <th>Kind</th>
                  <th>Δ</th>
                  <th>Sev</th>
                  <th>State</th>
                  <th className="!text-right">Age</th>
                </tr>
              </thead>
              <tbody>
                {RECON_EXCEPTIONS.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-[10.5px]">{e.id}</td>
                    <td>{e.counterparty}</td>
                    <td className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{e.kind.replace("_", " ")}</td>
                    <td><CellNum tone={e.severity === "CRITICAL" ? "bad" : e.severity === "WARN" ? "warn" : "default"}>{e.delta}</CellNum></td>
                    <td><SeverityBadge level={e.severity} /></td>
                    <td><SeverityBadge level={e.state === "RESOLVED" ? "OK" : e.state === "ESCALATED" ? "CRITICAL" : "INFO"} label={e.state} /></td>
                    <td className="text-right font-mono text-[10.5px] text-muted-foreground">{e.ageMin}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Oracle Verification" subtitle="PLD reference · feed integrity">
          <div className="space-y-2">
            {[
              { feed: "PLD-SECO · ONS",       lat: 412,  div: 0.04, ok: true  },
              { feed: "PLD-S · ONS",          lat: 388,  div: 0.02, ok: true  },
              { feed: "PLD-NE · ONS",         lat: 1640, div: 0.18, ok: false },
              { feed: "PLD-N · ONS",          lat: 502,  div: 0.06, ok: true  },
              { feed: "Fallback B · CCEE",    lat: 720,  div: 0.09, ok: true  },
              { feed: "Settlement Ref · IPCA",lat: 240,  div: 0.01, ok: true  },
            ].map((o) => (
              <div key={o.feed} className="rounded-sm border border-border bg-background/40 px-2.5 py-2">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-display font-medium">{o.feed}</span>
                  <SeverityBadge level={o.ok ? "OK" : "WARN"} label={o.ok ? "VERIFIED" : "DIVERGENT"} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>latency · {o.lat} ms</span>
                  <span className={o.div > 0.1 ? "text-warning" : ""}>div · {o.div}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <button className="flex-1 rounded-sm border border-border bg-background/40 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary/50 hover:text-primary">
              Engage Fallback
            </button>
            <button className="flex-1 rounded-sm border border-border bg-background/40 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-primary/50 hover:text-primary">
              Re-anchor batch
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="Audit Trail Explorer" subtitle="Resolved exceptions · 24h provenance">
        <ol className="space-y-1.5 font-mono text-[11px]">
          {[
            { t: -5,   ref: "EX-38201", action: "AUTO-RESOLVE", detail: "Price mismatch within 0.5% tolerance — collapsed to canonical PLD reference." },
            { t: -22,  ref: "EX-38195", action: "ESCALATE",      detail: "Volume drift +6.2 MWh on EPC-2061 — supervisor.dias notified." },
            { t: -38,  ref: "EX-38188", action: "REANCHOR",      detail: "Ledger gap seq −2 — block 51 224 188 reanchored to canonical chain." },
            { t: -64,  ref: "EX-38174", action: "FALLBACK",      detail: "Oracle PLD-NE latency 1.6s > 1.0s — fallback B engaged." },
            { t: -91,  ref: "EX-38161", action: "AUTO-RESOLVE",  detail: "Timestamp skew 220ms recovered after NTP resync." },
            { t: -128, ref: "EX-38149", action: "CLOSE",         detail: "Settlement discrepancy on EPC-2070 cleared after CP confirmation." },
          ].map((e, i) => (
            <li key={i} className="flex items-start gap-2 border-l border-border pl-2.5">
              <span className="text-muted-foreground">{e.t}m</span>
              <span className="text-primary">{e.ref}</span>
              <SeverityBadge level={e.action === "ESCALATE" ? "WARN" : e.action === "FALLBACK" ? "WARN" : "OK"} label={e.action} />
              <span className="flex-1 text-foreground/90">{e.detail}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
