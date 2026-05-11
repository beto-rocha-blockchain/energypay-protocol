import { createFileRoute } from "@tanstack/react-router";
import { Panel, KpiStrip, KpiTile, SeverityBadge, CellNum, StatusDot } from "@/components/ops/primitives";
import { useOperator } from "@/store/operator";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useWalletActivity } from "@/hooks/useWalletActivity";
import { StellarRailMonitor } from "@/components/generator/StellarRailMonitor";
import { LiveSettlementFeed } from "@/components/generator/LiveSettlementFeed";
import { fmtBRLm, fmtNum, fmtUTC, shortHash } from "@/lib/institutional-data";
import { stellarExpertTx } from "@/lib/stellar";
import { ArrowRight, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/treasury")({
  head: () => ({
    meta: [
      { title: "Treasury & Settlement Rails — EnergyPay" },
      { name: "description", content: "Stellar settlement rail monitoring, custody operations and BRL settlement architecture." },
    ],
  }),
  component: TreasuryPage,
});

function TreasuryPage() {
  const operator = useOperator((s) => s.operator);
  const pk = operator?.wallet.publicKey ?? null;
  const balances = useWalletBalances(pk);
  const activity = useWalletActivity(pk);

  const xlm = balances.data?.summary.xlm ?? "0.0000000";
  const eprw = balances.data?.summary.eprw ?? "0.0000000";

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">Treasury · Settlement Rail Operations</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Treasury & Settlement Rails</h1>
        </div>
        <SeverityBadge level="OK" label="STELLAR · TESTNET ACTIVE" />
      </div>

      <KpiStrip>
        <KpiTile label="Operator XLM" value={Number(xlm).toFixed(4)} unit="XLM" tone="primary" sub={pk ? shortHash(pk) : "no operator"} />
        <KpiTile label="EPWR Inventory" value={Number(eprw).toLocaleString("en-US", { maximumFractionDigits: 2 })} unit="EPWR" tone="ok" />
        <KpiTile label="Settled · 24h" value={fmtBRLm(38_420_000)} unit="BRL" tone="ok" />
        <KpiTile label="In-flight" value={fmtBRLm(2_140_000)} unit="BRL" tone="warn" />
        <KpiTile label="Custody Vaults" value="4" sub="cold · warm · hot · escrow" />
        <KpiTile label="Cross-border Routes" value="2" sub="BRL→USDC · BRL→EUR" />
      </KpiStrip>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <StellarRailMonitor />
          <Panel title="Payment Routing" subtitle="Generator → Clearing → Counterparty · programmable leg">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-background/40 p-4">
              {[
                { l: "Generator",  s: "EPWR issued" },
                { l: "Clearing",   s: "Margin verified" },
                { l: "Settlement Rail", s: "Stellar broadcast" },
                { l: "Counterparty",    s: "EPWR delivered" },
                { l: "BRL Leg",         s: "Custody settled" },
              ].map((n, i, arr) => (
                <div key={n.l} className="flex items-center gap-2">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-primary/40 bg-primary/10">
                      <StatusDot tone="info" />
                    </div>
                    <p className="mt-1 font-display text-[11px] font-medium">{n.l}</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{n.s}</p>
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Custody Operations Log" subtitle="Vault transfers · signing events">
          <ul className="space-y-2 text-[11.5px]">
            {[
              { t: -2,   action: "Hot → Warm sweep",    qty: "184 200 EPWR", tone: "ok" as const, op: "system.adapter" },
              { t: -7,   action: "Escrow lock",         qty: "R$ 1.2M",     tone: "info" as const, op: "ops.menezes" },
              { t: -14,  action: "Cold sig · co-sign",  qty: "—",            tone: "info" as const, op: "supervisor.dias" },
              { t: -22,  action: "Warm → Hot refill",   qty: "62 000 EPWR", tone: "ok" as const, op: "system.adapter" },
              { t: -39,  action: "BRL leg confirmation",qty: "R$ 480k",     tone: "ok" as const, op: "custody.partner" },
              { t: -61,  action: "Failsafe armed",      qty: "—",            tone: "warn" as const, op: "system.adapter" },
              { t: -88,  action: "Vault rebalance",     qty: "12 400 EPWR", tone: "ok" as const, op: "ops.cardoso" },
            ].map((e, i) => (
              <li key={i} className="flex items-start gap-2 border-l-2 pl-2"
                  style={{ borderColor: e.tone === "warn" ? "var(--warning)" : e.tone === "info" ? "var(--primary)" : "var(--success)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-medium">{e.action}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{e.t}m</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>{e.qty}</span>
                    <span>{e.op}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <LiveSettlementFeed events={activity.events} loading={activity.loading} error={activity.error} fetchedAt={activity.fetchedAt} />

      <Panel title="Recent Ledger Anchors" subtitle="Stellar Horizon · last confirmed transactions">
        <div className="overflow-x-auto">
          <table className="table-inst w-full">
            <thead>
              <tr><th>Tx Hash</th><th>Kind</th><th className="!text-right">Amount</th><th>Asset</th><th>Result</th><th></th></tr>
            </thead>
            <tbody>
              {activity.events.slice(0, 8).map((ev) => (
                <tr key={ev.id}>
                  <td className="font-mono text-[10.5px] text-primary">{shortHash(ev.tx_hash)}</td>
                  <td className="font-mono text-[10px] uppercase text-muted-foreground">{ev.kind}</td>
                  <td className="text-right"><CellNum>{ev.amount ?? "—"}</CellNum></td>
                  <td className="font-mono text-[10.5px]">{ev.asset ?? "—"}</td>
                  <td><SeverityBadge level={ev.successful ? "OK" : "CRITICAL"} label={ev.successful ? "FINALIZED" : "FAILED"} /></td>
                  <td className="text-right">
                    <a href={stellarExpertTx(ev.tx_hash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary">
                      explorer <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </td>
                </tr>
              ))}
              {activity.events.length === 0 && (
                <tr><td colSpan={6} className="text-center font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">No ledger activity in window</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
