import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, ArrowUpRight, FileSignature, ExternalLink, Info,
  ShieldAlert, TrendingUp, Wallet, Zap, Clock,
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
import { SettlementTimeline } from "@/components/SettlementTimeline";
import { pldSeries, volumeSeries, computeExposure } from "@/lib/mock-data";
import { useOps } from "@/store/operations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control Room — EnergyPay Settlement" },
      { name: "description", content: "Operational overview of programmable energy settlements, exposure and reconciliation." },
    ],
  }),
  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Dashboard() {
  const contracts = useOps((s) => s.contracts);
  const settlements = useOps((s) => s.settlements);
  const alerts = useOps((s) => s.alerts);
  const queue = useOps((s) => s.queue);
  const feed = useOps((s) => s.feed);
  const ackAlert = useOps((s) => s.ackAlert);

  const activeContracts = contracts.filter((c) => c.status === "ACTIVE").length;
  const settledToday = 22900;
  const exposure = contracts
    .filter((c) => c.status === "ACTIVE")
    .reduce((acc, c) => acc + Math.abs(computeExposure(c)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Settlement Operations / Control Room
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Operational Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Intraday settlement cycle · counterparty exposure · reconciliation pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/contracts"><FileSignature className="mr-2 h-4 w-4" /> Contract Registry</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/settlement"><Activity className="mr-2 h-4 w-4" /> Run Settlement</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/contracts/new"><FileSignature className="mr-2 h-4 w-4" /> New Contract</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Contracts" value={activeContracts}
          sub="3 onboarded this cycle" trend="up" icon={<FileSignature className="h-5 w-5" />} />
        <StatCard label="Settled Today (MWh)" value={settledToday.toLocaleString("pt-BR")}
          sub="+12.4% vs. previous cycle" trend="up" icon={<Zap className="h-5 w-5" />} />
        <StatCard label="Cleared Volume (30d)" value={fmtBRL(38_420_000)}
          sub="98.7% transaction finality" trend="up" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Intraday Open Exposure" value={fmtBRL(exposure)}
          sub="Δ −1.8% vs. T-1 close" trend="down" icon={<Wallet className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="col-span-1 border-border bg-[image:var(--gradient-card)] p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Settlement Throughput</p>
              <p className="font-display text-lg font-semibold">Notified vs. Cleared volume (MWh)</p>
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

      {/* Operational widgets row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Real-time</p>
              <p className="font-display text-base font-semibold">Recent Settlement Feed</p>
            </div>
            <span className="flex items-center gap-1 font-mono text-[10px] text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> LIVE
            </span>
          </div>
          <ul className="space-y-3">
            {feed.map((f) => (
              <li key={f.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{f.id}</p>
                  <p className="truncate text-sm">{f.counterparty}</p>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-sm ${f.amount >= 0 ? "text-success" : "text-destructive"}`}>
                    {f.amount >= 0 ? "+" : ""}{fmtBRL(f.amount)}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">{f.ago}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Reconciliation Pipeline</p>
              <p className="font-display text-base font-semibold">Settlement Queue</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">{queue.length} pending</Badge>
          </div>
          <ul className="divide-y divide-border/60">
            {queue.map((q) => (
              <li key={q.id} className="grid grid-cols-12 items-center gap-2 py-2 text-xs">
                <span className="col-span-3 font-mono text-muted-foreground">{q.id}</span>
                <span className="col-span-4 truncate">{q.counterparty}</span>
                <span className="col-span-3 text-right font-mono">{fmtBRL(q.amount)}</span>
                <span className="col-span-2 flex items-center justify-end gap-1 font-mono text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {q.eta}
                </span>
                <div className="col-span-12 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest">
                  <span className={
                    q.priority === "high" ? "rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-destructive"
                    : q.priority === "low" ? "rounded border border-border px-1.5 py-0.5 text-muted-foreground"
                    : "rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-warning"
                  }>P · {q.priority}</span>
                  <span className={
                    q.phase === "signing" ? "rounded bg-primary/15 px-1.5 py-0.5 text-primary"
                    : q.phase === "broadcasting" ? "rounded bg-accent/15 px-1.5 py-0.5 text-accent"
                    : q.phase === "validating" ? "rounded bg-warning/15 px-1.5 py-0.5 text-warning"
                    : "rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
                  }>{q.phase}</span>
                  <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                    {q.state}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Operational</p>
              <p className="font-display text-base font-semibold">Alerts</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">{alerts.length} open</Badge>
          </div>
          <ul className="space-y-3">
            {alerts.map((a) => {
              const Icon = a.level === "critical" ? ShieldAlert : a.level === "warn" ? AlertTriangle : Info;
              const color =
                a.level === "critical" ? "text-destructive" :
                a.level === "warn" ? "text-warning" : "text-accent";
              return (
                <li key={a.id} className="flex gap-3 border-b border-border/50 pb-3 last:border-0">
                  <Icon className={`mt-0.5 h-4 w-4 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">{a.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Timeline + ops metrics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-[image:var(--gradient-card)] p-5 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Active settlement cycle</p>
              <p className="font-display text-lg font-semibold">EPC-2041 · Operational Timeline</p>
            </div>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-xs text-primary">
              IN EXECUTION
            </Badge>
          </div>
          <SettlementTimeline />
        </Card>

        <Card className="border-border bg-card p-5">
          <p className="mb-4 font-display text-lg font-semibold">Operational KPIs</p>
          <div className="space-y-4">
            {[
              { label: "Avg. transaction finality", value: "2.4s", bar: 92 },
              { label: "Reconciliation match rate", value: "99.6%", bar: 99 },
              { label: "Counterparty coverage", value: "47 entities", bar: 76 },
              { label: "Clearing flow utilisation", value: "1.32×", bar: 64 },
              { label: "Failed settlements (24h)", value: "1", bar: 8 },
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
          <p className="font-display text-lg font-semibold">Recent Settlements</p>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to="/contracts">View registry <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[11px] uppercase tracking-wider">ID</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Counterparty</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">PLD</TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-wider">Amount</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Tx Hash</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Finality</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.slice(0, 6).map((s) => (
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

      <Card className="border-border bg-[image:var(--gradient-card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Cleared notional</p>
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
