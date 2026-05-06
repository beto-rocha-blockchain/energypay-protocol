import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity, ArrowUpRight, FileSignature, ExternalLink,
  TrendingUp, Wallet, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { mockContracts, mockSettlements, pldSeries, volumeSeries } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — EnergyPay Settlement" },
      { name: "description", content: "Operational overview of programmable energy settlements." },
    ],
  }),
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Dashboard() {
  const activeContracts = mockContracts.filter((c) => c.status === "ACTIVE").length;
  const totalVolume = volumeSeries.reduce((a, b) => a + b.volume, 0);
  const settledToday = 22900;
  const exposure = 4_280_000;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Settlement Operations / Overview
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Control Room</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/settlement"><Activity className="mr-2 h-4 w-4" /> Run Settlement</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/contracts/new"><FileSignature className="mr-2 h-4 w-4" /> New Contract</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Contracts" value={activeContracts}
          sub="+3 vs. last week" trend="up" icon={<FileSignature className="h-5 w-5" />} />
        <StatCard label="Settled Today (MWh)" value={settledToday.toLocaleString("pt-BR")}
          sub="+12.4% intraday" trend="up" icon={<Zap className="h-5 w-5" />} />
        <StatCard label="Settlement Volume (30d)" value={fmtBRL(38_420_000)}
          sub="98.7% on-chain finality" trend="up" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Open Exposure" value={fmtBRL(exposure)}
          sub="Δ −1.8% vs. close" trend="down" icon={<Wallet className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="col-span-1 border-border bg-[image:var(--gradient-card)] p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Settlement Throughput</p>
              <p className="font-display text-lg font-semibold">Volume vs. Settled (MWh)</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">8 day window</Badge>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeSeries}>
                <defs>
                  <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--color-muted-foreground)" }}
                />
                <Area type="monotone" dataKey="volume" stroke="var(--color-chart-1)" fill="url(#gV)" strokeWidth={2} />
                <Area type="monotone" dataKey="settled" stroke="var(--color-chart-2)" fill="url(#gS)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="border-border bg-[image:var(--gradient-card)] p-5">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">PLD intraday</p>
            <p className="font-display text-lg font-semibold">R$ / MWh</p>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pldSeries}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="pld" stroke="var(--color-chart-3)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-chart-3)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Recent Settlements</p>
            <Button variant="ghost" size="sm" className="text-xs">View all <ArrowUpRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wider">ID</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Counterparty</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">PLD</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Amount</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Tx Hash</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSettlements.map((s) => (
                <TableRow key={s.id} className="border-border">
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell className="text-sm">{s.counterparty}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{s.pld.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-mono text-sm ${s.amountBRL >= 0 ? "text-success" : "text-destructive"}`}>
                    {s.amountBRL >= 0 ? "+" : ""}{fmtBRL(s.amountBRL)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {s.txHash}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-success/40 bg-success/10 font-mono text-[10px] text-success">
                      ● {s.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="border-border bg-card p-5">
          <p className="mb-4 font-display text-lg font-semibold">Operational Metrics</p>
          <div className="space-y-4">
            {[
              { label: "Avg. settlement latency", value: "2.4s", bar: 92 },
              { label: "On-chain finality rate", value: "98.7%", bar: 98 },
              { label: "Counterparty coverage", value: "47 entities", bar: 76 },
              { label: "EPWR token velocity", value: "1.32×", bar: 64 },
              { label: "Failed transactions (24h)", value: "0", bar: 4 },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-mono">{m.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[image:var(--gradient-primary)]" style={{ width: `${m.bar}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-semibold">Active Contracts</p>
            <p className="text-xs text-muted-foreground">Bilateral PPAs registered in the settlement registry.</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">{mockContracts.length} contracts</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[11px] uppercase tracking-wider">Contract</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Buyer</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Seller</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">Vol (MWh)</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">Price</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Settles</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockContracts.map((c) => (
              <TableRow key={c.id} className="border-border">
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell className="text-sm">{c.buyer}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.seller}</TableCell>
                <TableCell className="text-right font-mono text-sm">{c.volumeMWh.toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right font-mono text-sm">{c.priceBRL.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{c.settlementDate}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    c.status === "ACTIVE" ? "border-success/40 bg-success/10 text-success font-mono text-[10px]"
                    : c.status === "PENDING" ? "border-warning/40 bg-warning/10 text-warning font-mono text-[10px]"
                    : "border-border bg-muted text-muted-foreground font-mono text-[10px]"
                  }>● {c.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="border-border bg-[image:var(--gradient-card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Transaction history</p>
            <p className="font-display text-lg font-semibold">Settlement value (R$, last 8 days)</p>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeSeries.map((v) => ({ ...v, brl: v.settled * 248 }))}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => fmtBRL(v)} />
              <Bar dataKey="brl" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
