import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, KpiStrip, KpiTile, SeverityBadge, CellNum, StatusDot } from "@/components/ops/primitives";
import { AUDIT_LOG, KYC_RECORDS, fmtUTC, shortHash } from "@/lib/institutional-data";
import { stellarExpertTx } from "@/lib/stellar";
import { ExternalLink, FileText, Download } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit & Compliance — EnergyPay" },
      { name: "description", content: "Immutable audit logs, KYC verification, institutional access control and regulatory reporting." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [filter, setFilter] = useState<"ALL" | "OK" | "DENIED" | "ERROR">("ALL");
  const filtered = filter === "ALL" ? AUDIT_LOG : AUDIT_LOG.filter((a) => a.result === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-op">Compliance Office · Institutional Access</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Audit & Compliance Center</h1>
        </div>
        <SeverityBadge level="OK" label="ATTESTATION CURRENT · ATT-2026-Q2-018" />
      </div>

      <KpiStrip>
        <KpiTile label="Audit Records · 24h" value={AUDIT_LOG.length} tone="primary" />
        <KpiTile label="Denied · 24h" value={AUDIT_LOG.filter((a) => a.result === "DENIED").length} tone="warn" />
        <KpiTile label="Errors · 24h" value={AUDIT_LOG.filter((a) => a.result === "ERROR").length} tone={AUDIT_LOG.filter(a => a.result === "ERROR").length > 0 ? "bad" : "ok"} />
        <KpiTile label="KYC Verified" value={KYC_RECORDS.filter((k) => k.status === "VERIFIED").length} tone="ok" />
        <KpiTile label="KYC Expiring" value={KYC_RECORDS.filter((k) => k.status === "EXPIRING").length} tone="warn" />
        <KpiTile label="Reports Due" value="3" tone="warn" sub="CCEE · ANEEL · BCB" />
      </KpiStrip>

      <Panel
        title="Immutable Audit Log"
        subtitle="Operator actions · ledger anchored · provenance"
        right={
          <div className="flex gap-1">
            {(["ALL", "OK", "DENIED", "ERROR"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                  filter === f ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="table-inst w-full">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th className="!text-right">Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Source IP</th>
                <th>Result</th>
                <th>Anchor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-[10.5px]">{a.id}</td>
                  <td className="text-right font-mono text-[10.5px] text-muted-foreground">{fmtUTC(a.ts)} UTC</td>
                  <td className="font-mono text-[11px]">{a.actor}</td>
                  <td className="font-mono text-[10.5px] uppercase tracking-widest text-foreground/90">{a.action}</td>
                  <td className="font-mono text-[10.5px] text-muted-foreground">{a.resource}</td>
                  <td className="font-mono text-[10.5px] text-muted-foreground">{a.ip}</td>
                  <td><SeverityBadge level={a.result === "OK" ? "OK" : a.result === "DENIED" ? "WARN" : "CRITICAL"} label={a.result} /></td>
                  <td>
                    {a.txHash ? (
                      <a href={stellarExpertTx(a.txHash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10.5px] text-primary hover:underline">
                        {shortHash(a.txHash)} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Panel title="KYC Status Board" subtitle="Counterparty verification · institutional tier" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="table-inst w-full">
              <thead>
                <tr><th>Counterparty</th><th>Tier</th><th>Status</th><th>Last Review</th><th>Reviewer</th></tr>
              </thead>
              <tbody>
                {KYC_RECORDS.map((k) => (
                  <tr key={k.cpId}>
                    <td>{k.shortName} <span className="ml-1 font-mono text-[10px] text-muted-foreground">{k.cpId}</span></td>
                    <td><SeverityBadge level={k.level === "TIER-1" ? "OK" : k.level === "TIER-2" ? "INFO" : "WARN"} label={k.level} /></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot tone={k.status === "VERIFIED" ? "ok" : k.status === "EXPIRING" ? "warn" : k.status === "REJECTED" ? "bad" : "info"} />
                        <span className="font-mono text-[10px] uppercase tracking-widest">{k.status}</span>
                      </span>
                    </td>
                    <td className="font-mono text-[10.5px]">{k.lastReview}</td>
                    <td className="font-mono text-[10.5px] text-muted-foreground">{k.reviewer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Regulatory Reporting" subtitle="Filing queue · institutional disclosures">
          <ul className="space-y-2 text-[11.5px]">
            {[
              { id: "RPT-2026-Q2-018", title: "CCEE Monthly Settlement", due: "in 3d",  state: "DRAFT" as const },
              { id: "RPT-2026-Q2-014", title: "ANEEL Quarterly Filing",  due: "in 11d", state: "DRAFT" as const },
              { id: "RPT-2026-Q2-008", title: "BCB IF.DATA / SETTLEMENT",due: "in 2d",  state: "REVIEW" as const },
              { id: "RPT-2026-Q1-079", title: "Annual Risk Disclosure",  due: "filed",  state: "FILED" as const },
              { id: "RPT-2026-Q1-074", title: "Audit Attestation Pack",  due: "filed",  state: "FILED" as const },
            ].map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-sm border border-border bg-background/40 p-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[11.5px] font-medium">{r.title}</span>
                    <SeverityBadge level={r.state === "FILED" ? "OK" : r.state === "REVIEW" ? "WARN" : "INFO"} label={r.state} />
                  </div>
                  <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>{r.id}</span>
                    <span>{r.due}</span>
                  </div>
                </div>
                <button className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:border-primary/50 hover:text-primary">
                  <Download className="h-2.5 w-2.5" /> Pack
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
