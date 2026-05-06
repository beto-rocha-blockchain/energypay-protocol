import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, Filter, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { mockContracts, computeExposure, contractOperationalTimeline, type Contract, type ContractStatus } from "@/lib/mock-data";
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

type SortKey = "id" | "volumeMWh" | "priceBRL" | "pldBRL" | "exposure" | "settlementDate";

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

function ContractsList() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ContractStatus>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "settlementDate", dir: "desc" });
  const [selected, setSelected] = useState<Contract | null>(null);

  const rows = useMemo(() => {
    let r = mockContracts.filter((c) => {
      const matchQ =
        !q ||
        c.id.toLowerCase().includes(q.toLowerCase()) ||
        c.buyer.toLowerCase().includes(q.toLowerCase()) ||
        c.seller.toLowerCase().includes(q.toLowerCase());
      const matchS = statusFilter === "ALL" || c.status === statusFilter;
      return matchQ && matchS;
    });
    r = [...r].sort((a, b) => {
      const va = sort.key === "exposure" ? computeExposure(a) : (a as any)[sort.key];
      const vb = sort.key === "exposure" ? computeExposure(b) : (b as any)[sort.key];
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return r;
  }, [q, statusFilter, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  const SortableHead = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <TableHead className={`text-[11px] uppercase tracking-wider ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => toggle(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label} <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Clearing & Reconciliation / Contract Registry
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Contract Registry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bilateral PPAs under settlement supervision · counterparty exposure, PLD reference and transaction finality.
        </p>
      </div>

      <Card className="border-border bg-card p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search contract ID, buyer or seller…"
              className="bg-input pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[180px] bg-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SETTLED">Settled</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="font-mono text-xs">{rows.length} / {mockContracts.length}</Badge>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <SortableHead k="id" label="Contract" />
              <TableHead className="text-[11px] uppercase tracking-wider">Buyer</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Seller</TableHead>
              <SortableHead k="volumeMWh" label="Volume (MWh)" align="right" />
              <SortableHead k="priceBRL" label="Price" align="right" />
              <SortableHead k="pldBRL" label="PLD" align="right" />
              <SortableHead k="exposure" label="Exposure" align="right" />
              <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
              <SortableHead k="settlementDate" label="Settles" />
              <TableHead className="text-[11px] uppercase tracking-wider">Tx Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => {
              const exp = computeExposure(c);
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer border-border"
                  onClick={() => setSelected(c)}
                >
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell className="text-sm">{c.buyer}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.seller}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{c.volumeMWh.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{c.priceBRL.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{c.pldBRL.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${exp >= 0 ? "text-success" : "text-destructive"}`}>
                    {exp >= 0 ? "+" : ""}{fmtBRL(exp)}
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.settlementDate}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {c.status === "FAILED" ? "—" : `${c.txHash.slice(0, 6)}…${c.txHash.slice(-6)}`}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">No contracts match the current filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <span>Contract</span>
                  <span className="font-mono text-base text-primary">{selected.id}</span>
                  <StatusBadge status={selected.status} />
                </DialogTitle>
                <DialogDescription>
                  Bilateral PPA · counterparty exposure & settlement finality
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
                <KV k="Buyer" v={selected.buyer} />
                <KV k="Seller" v={selected.seller} />
                <KV k="Volume" v={`${selected.volumeMWh.toLocaleString("pt-BR")} MWh`} mono />
                <KV k="Contract price" v={`R$ ${selected.priceBRL.toFixed(2)} / MWh`} mono />
                <KV k="PLD reference" v={`R$ ${selected.pldBRL.toFixed(2)} / MWh`} mono />
                <div className="border-t border-border pt-3">
                  <KV k="Financial exposure" v={fmtBRL(computeExposure(selected))} mono highlight />
                </div>
                <KV k="Settlement cycle" v={selected.settlementDate} mono />
                <div className="border-t border-border pt-3">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Stellar Tx Hash</p>
                  <p className="mt-1 break-all rounded bg-background/60 p-2 font-mono text-[11px]">
                    {selected.status === "FAILED" ? "— transaction not broadcast —" : selected.txHash}
                  </p>
                  {selected.status !== "FAILED" && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${selected.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      View on Stellar Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
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
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-base font-semibold text-primary" : "text-sm"}`}>{v}</span>
    </div>
  );
}
