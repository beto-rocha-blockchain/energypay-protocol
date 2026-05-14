import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CircleDot,
  Calendar,
  Building2,
} from "lucide-react";

export type ContractStatus = "ACTIVE" | "SETTLING" | "DELIVERING" | "EXPIRED" | "AT RISK";

type Contract = {
  id: string;
  counterparty: string;
  volumeMwh: number;
  pricePerMwh: number;
  status: ContractStatus;
  deliveredPct: number;
  expiresAt: string;
  liquidityRisk: number; // 0-100
};

const SEED: Contract[] = [
  { id: "EPC-2047", counterparty: "Vale Energia", volumeMwh: 18_400, pricePerMwh: 278, status: "DELIVERING", deliveredPct: 64, expiresAt: "2026-12-31", liquidityRisk: 18 },
  { id: "EPC-2051", counterparty: "Furnas Centrais", volumeMwh: 9_200, pricePerMwh: 264, status: "ACTIVE", deliveredPct: 12, expiresAt: "2027-03-15", liquidityRisk: 22 },
  { id: "EPC-2058", counterparty: "Cemig GT", volumeMwh: 24_000, pricePerMwh: 291, status: "SETTLING", deliveredPct: 88, expiresAt: "2026-08-30", liquidityRisk: 36 },
  { id: "EPC-2061", counterparty: "Engie Brasil", volumeMwh: 6_800, pricePerMwh: 305, status: "AT RISK", deliveredPct: 41, expiresAt: "2026-06-12", liquidityRisk: 71 },
  { id: "EPC-2063", counterparty: "Equatorial S/A", volumeMwh: 12_500, pricePerMwh: 252, status: "ACTIVE", deliveredPct: 27, expiresAt: "2027-01-05", liquidityRisk: 14 },
  { id: "EPC-2070", counterparty: "Auren Energia", volumeMwh: 15_750, pricePerMwh: 283, status: "DELIVERING", deliveredPct: 53, expiresAt: "2026-11-20", liquidityRisk: 29 },
];

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const statusTone: Record<ContractStatus, string> = {
  ACTIVE: "border-success/40 text-success",
  SETTLING: "border-primary/40 text-primary",
  DELIVERING: "border-accent/40 text-accent",
  EXPIRED: "border-muted-foreground/40 text-muted-foreground",
  "AT RISK": "border-destructive/40 text-destructive",
};

const barTone = (s: ContractStatus) =>
  s === "AT RISK" ? "bg-destructive" : s === "SETTLING" ? "bg-primary" : s === "DELIVERING" ? "bg-accent" : "bg-success";

export function BilateralContractsPanel() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 4_000);
    return () => window.clearInterval(id);
  }, []);

  const contracts = useMemo(
    () =>
      SEED.map((c, i) => {
        const drift = ((Math.sin(tick * 0.6 + i) + 1) / 2) * 4;
        const delivered = Math.min(99, c.deliveredPct + drift);
        return { ...c, deliveredPct: Math.round(delivered) };
      }),
    [tick],
  );

  const totals = useMemo(() => {
    const v = contracts.reduce((a, c) => a + c.volumeMwh, 0);
    const notional = contracts.reduce((a, c) => a + c.volumeMwh * c.pricePerMwh, 0);
    const atRisk = contracts.filter((c) => c.status === "AT RISK").length;
    return { v, notional, atRisk };
  }, [contracts]);

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Bilateral Trading Desk · Active PPAs
          </p>
          <h2 className="mt-0.5 font-display text-base font-semibold">Active Bilateral Contracts</h2>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest">
          <Badge variant="outline" className="border-border">
            <ShieldCheck className="mr-1.5 h-3 w-3 text-success" />
            {contracts.length} OPEN
          </Badge>
          <Badge variant="outline" className="border-border">
            <TrendingUp className="mr-1.5 h-3 w-3 text-primary" />
            {fmt(totals.v)} MWh
          </Badge>
          <Badge variant="outline" className="border-border">
            R$ {fmt(totals.notional / 1_000_000)}M notional
          </Badge>
          {totals.atRisk > 0 && (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              <AlertTriangle className="mr-1.5 h-3 w-3" /> {totals.atRisk} AT RISK
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-12 gap-2 border-b border-border bg-background/40 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground md:grid">
          <span className="col-span-2">Contract</span>
          <span className="col-span-3">Counterparty</span>
          <span className="col-span-2 text-right">Volume / Price</span>
          <span className="col-span-3">Delivery</span>
          <span className="col-span-1 text-right">Risk</span>
          <span className="col-span-1 text-right">Status</span>
        </div>
        <div className="divide-y divide-border">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-1 items-center gap-2 px-3 py-2.5 transition-colors hover:bg-background/40 md:grid-cols-12"
            >
              <div className="col-span-2 flex items-center gap-2">
                <CircleDot className={`h-3 w-3 ${c.status === "AT RISK" ? "text-destructive animate-pulse" : "text-primary"}`} />
                <span className="font-mono text-[11px]">{c.id}</span>
              </div>
              <div className="col-span-3 flex items-center gap-1.5 text-[12px]">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                {c.counterparty}
              </div>
              <div className="col-span-2 text-right font-mono text-[11px]">
                <div>{fmt(c.volumeMwh)} MWh</div>
                <div className="text-[10px] text-muted-foreground">R$ {c.pricePerMwh}/MWh</div>
              </div>
              <div className="col-span-3">
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{c.deliveredPct}% delivered</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {c.expiresAt}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-700 ${barTone(c.status)}`}
                    style={{ width: `${c.deliveredPct}%` }}
                  />
                </div>
              </div>
              <div className="col-span-1 text-right font-mono text-[11px]">
                <span
                  className={
                    c.liquidityRisk > 60
                      ? "text-destructive"
                      : c.liquidityRisk > 35
                      ? "text-amber-500"
                      : "text-success"
                  }
                >
                  {c.liquidityRisk}
                </span>
              </div>
              <div className="col-span-1 flex justify-end">
                <Badge variant="outline" className={`font-mono text-[9px] uppercase tracking-widest ${statusTone[c.status]}`}>
                  {c.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
