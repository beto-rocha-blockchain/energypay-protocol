import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, Filter, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  computeExposure,
  contractOperationalTimeline,
  contractStartDate,
  contractEndDate,
  contractDurationDays,
  contractPeriodStatus,
  type Contract,
  type ContractStatus,
  type ContractPeriodStatus,
} from "@/lib/mock-data";
import { useOps } from "@/store/operations";
import { StateMachine } from "@/components/StateMachine";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/contracts/")({
  head: () => ({
    meta: [
      { title: "Contract Registry — EnergyPay" },
      { name: "description", content: "Bilateral PPAs registered for programmable settlement and reconciliation." },
    ],
  }),
  component: ContractsList,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type SortKey = "id" | "volumeMWh" | "priceBRL" | "pldBRL" | "exposure" | "settlementDate" | "startDate" | "endDate";

function StatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, string> = {
    ACTIVE: "border-success/40 bg-success/10 text-success",
    PENDING: "border-warning/40 bg-warning/10 text-warning",
    SETTLED: "border-accent/40 bg-accent/10 text-accent",
    FAILED: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <Badge variant="outline" className={`${map[status]} font-mono text-[10px]`}>
      ● {status}
    </Badge>
  );
}

function PeriodBadge({ status }: { status: ContractPeriodStatus }) {
  const map: Record<ContractPeriodStatus, string> = {
    UPCOMING: "border-warning/40 bg-warning/10 text-warning",
    ACTIVE: "border-success/40 bg-success/10 text-success",
    EXPIRED: "border-muted/40 bg-muted/10 text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`${map[status]} font-mono text-[10px]`}>
      ● {status}
    </Badge>
  );
}

function ContractsList() {
  const contracts = useOps((s) => s.contracts);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ContractStatus>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "settlementDate", dir: "desc" });
  const [selected, setSelected] = useState<Contract | null>(null);

  const rows = useMemo(() => {
    let r = contracts.filter((c) => {
      const matchQ =
        !q ||
        c.id.toLowerCase().includes(q.toLowerCase()) ||
        c.buyer.toLowerCase().includes(q.toLowerCase()) ||
        c.seller.toLowerCase().includes(q.toLowerCase());
      const matchS = statusFilter === "ALL" || c.status === statusFilter;
      return matchQ && matchS;
    });
    const accessor = (c: Contract, key: SortKey): number | string => {
      if (key === "exposure") return computeExposure(c);
      if (key === "startDate") return contractStartDate(c);
      if (key === "endDate") return contractEndDate(c);
      return (c as any)[key];
    };
    r = [...r].sort((a, b) => {
      const va = accessor(a, sort.key);
      const vb = accessor(b, sort.key);
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return r;
  }, [contracts, q, statusFilter, sort]);

  const toggle = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  const SortableHead = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <TableHead className={`text-[11px] uppercase tracking-wider ${align === "right" ? "text-right" : ""}`}>
      <button onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Clearing & Reconciliation / Contract Registry
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Contract Registry</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Bilateral PPAs under settlement supervision · counterparty exposure, PLD reference and transaction finality.
        </p>
      </div>

      <Card className="overflow-hidden border-border bg-card/60 p-0 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-background/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Registry · Live
            </span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {rows.length} / {contracts.length} contracts
          </Badge>
        </div>

        <div className="flex flex-col gap-2 border-b border-border bg-background/20 px-4 py-2.5 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ID, buyer or seller…"
              className="h-8 bg-input pl-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-8 w-[160px] bg-input text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SETTLED">Settled</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <Table className="text-xs [&_th]:h-8 [&_th]:px-2.5 [&_td]:px-2.5 [&_td]:py-1.5">
            <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              <TableRow className="border-border hover:bg-transparent">
                <SortableHead k="id" label="Contract" />
                <TableHead className="text-[10px] uppercase tracking-wider">Buyer</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Seller</TableHead>
                <SortableHead k="volumeMWh" label="MWh" align="right" />
                <SortableHead k="priceBRL" label="Price" align="right" />
                <SortableHead k="pldBRL" label="PLD" align="right" />
                <SortableHead k="exposure" label="Exposure" align="right" />
                <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Period</TableHead>
                <SortableHead k="startDate" label="Start" />
                <SortableHead k="endDate" label="End" />
                <TableHead className="text-[10px] uppercase tracking-wider text-right">Duration</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">State</TableHead>
                <SortableHead k="settlementDate" label="Settles" />
                <TableHead className="text-[10px] uppercase tracking-wider">Ledger</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Tx Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const exp = computeExposure(c);
                const period = contractPeriodStatus(c);
                const start = contractStartDate(c);
                const end = contractEndDate(c);
                const duration = contractDurationDays(c);
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer border-border/60 hover:bg-accent/5"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell className="font-mono text-[11px]">{c.id}</TableCell>
                    <TableCell className="text-xs">{c.buyer}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.seller}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {c.volumeMWh.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{c.priceBRL.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {c.pldBRL.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-xs font-medium ${exp >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {exp >= 0 ? "+" : ""}
                      {fmtBRL(exp)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>
                      <PeriodBadge status={period} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{start}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{end}</TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                      {duration}d
                    </TableCell>
                    <TableCell className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.state}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{c.settlementDate}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {c.ledger ? `#${c.ledger.toLocaleString("en-US")}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {c.status === "FAILED" ? "—" : `${c.txHash.slice(0, 6)}…${c.txHash.slice(-6)}`}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={16} className="py-10 text-center text-xs text-muted-foreground">
                    No contracts match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-background/40 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Σ Exposure · {fmtBRL(rows.reduce((a, c) => a + computeExposure(c), 0))}</span>
          <span>Stellar Testnet · Settlement Network</span>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
          {selected && (
            <>
              <DialogHeader className="border-b border-border px-5 py-4 space-y-1">
                <DialogTitle className="font-display flex items-center gap-2">
                  <span>Contract</span>
                  <span className="font-mono text-base text-primary">{selected.id}</span>
                  <StatusBadge status={selected.status} />
                  <PeriodBadge status={contractPeriodStatus(selected)} />
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Bilateral PPA · operational state, exposure & settlement finality
                </DialogDescription>
              </DialogHeader>

              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Settlement state machine
                  </p>
                  <StateMachine current={selected.state} failed={selected.state === "FAILED"} />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch">
                  <div className="flex h-full flex-col rounded-md border border-border bg-card p-3.5 text-sm">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Operational metadata
                    </p>
                    <div className="flex-1 space-y-1.5">
                      <KV k="Buyer" v={selected.buyer} />
                      <KV k="Seller" v={selected.seller} />
                      <KV k="Volume" v={`${selected.volumeMWh.toLocaleString("pt-BR")} MWh`} mono />
                      <KV k="Contract price" v={`R$ ${selected.priceBRL.toFixed(2)}`} mono />
                      <KV k="PLD reference" v={`R$ ${selected.pldBRL.toFixed(2)}`} mono />
                      <KV k="Settlement window" v={selected.window} mono />
                      <KV k="Active period" v={`${contractStartDate(selected)} → ${contractEndDate(selected)}`} mono />
                      <KV k="Duration" v={`${contractDurationDays(selected)} days`} mono />
                      <KV k="Settlement date" v={selected.settlementDate} mono />
                      <KV k="Ledger #" v={selected.ledger ? selected.ledger.toLocaleString("en-US") : "—"} mono />
                      <KV
                        k="Finality latency"
                        v={selected.latencyMs ? `${(selected.latencyMs / 1000).toFixed(2)}s` : "—"}
                        mono
                      />
                    </div>
                    <div className="mt-2 border-t border-border pt-2">
                      <KV k="Net exposure" v={fmtBRL(computeExposure(selected))} mono highlight />
                    </div>
                  </div>

                  <div className="flex h-full flex-col rounded-md border border-border bg-card p-3.5">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Operational timeline
                    </p>
                    <ol className="flex-1 space-y-1.5">
                      {contractOperationalTimeline(selected.id).map((e, i, arr) => (
                        <li key={i} className="relative flex gap-2.5 pl-1">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                          {i < arr.length - 1 && (
                            <span className="absolute left-[6px] top-4 bottom-[-6px] w-px bg-border" />
                          )}
                          <div className="flex-1 pb-0.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-[11px] font-medium leading-tight">{e.label}</p>
                              <span className="font-mono text-[10px] text-muted-foreground">{e.ts}</span>
                            </div>
                            <p className="text-[10px] leading-snug text-muted-foreground">{e.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              <div className="border-t border-border bg-background/40 px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Stellar Tx Hash
                    </p>
                    <p className="truncate font-mono text-[11px]">
                      {selected.status === "FAILED" ? "— transaction not broadcast —" : selected.txHash}
                    </p>
                  </div>
                  {selected.status !== "FAILED" && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${selected.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-accent hover:bg-accent/10"
                    >
                      Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border bg-card/40 px-5 py-3">
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ k, v, mono, highlight }: { k: string; v: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-base font-semibold text-primary" : "text-sm"}`}>
        {v}
      </span>
    </div>
  );
}
