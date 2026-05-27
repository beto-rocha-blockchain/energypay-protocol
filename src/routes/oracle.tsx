import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Radio,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/useDashboard";
import { useSettlementRail } from "@/hooks/useSettlementRail";
import { STELLAR_NETWORK_LABEL } from "@/lib/stellar";
import { API_BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/oracle")({
  head: () => ({
    meta: [
      { title: "Oracle & Market Data — EnergyPay" },
      {
        name: "description",
        content:
          "Real-time PLD/CMO prices from ONS, Horizon oracle feed, settlement telemetry.",
      },
    ],
  }),
  component: OraclePage,
});

/* ── Types ── */

type PldPrice = {
  submercado: string;
  subsistema: string;
  nome: string;
  cmo_brl_mwh: number;
  timestamp: string;
};

type PldHistoryPoint = {
  t: string;
  SE?: number;
  S?: number;
  NE?: number;
  N?: number;
};

/* ── Helpers ── */

const fmtTime = (ts: string) => {
  // ts format: "2026-05-26 18:00:00"
  const parts = ts.split(" ");
  if (parts.length === 2) return parts[1].slice(0, 5);
  // ISO format fallback
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fmtDate = (ts: string) => {
  const parts = ts.split(" ");
  if (parts.length === 2) {
    const [y, m, d] = parts[0].split("-");
    return `${d}/${m} ${parts[1].slice(0, 5)}`;
  }
  return ts;
};

const fmtCompact = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
};

/* ── Range definitions ── */

type PldRange = "48h" | "7d" | "1m" | "1y";

const RANGE_OPTIONS: { id: PldRange; label: string; subtitle: string }[] = [
  { id: "48h", label: "Hora", subtitle: "Semi-horário · Últimas 48h" },
  { id: "7d",  label: "Dia",  subtitle: "Média diária · Últimos 7 dias" },
  { id: "1m",  label: "Mês",  subtitle: "Média diária · Mês atual" },
  { id: "1y",  label: "Ano",  subtitle: "Média mensal · Últimos 12 meses" },
];

/* ── Hook: real PLD data ── */

function usePldData() {
  const [prices, setPrices] = useState<PldPrice[]>([]);
  const [history, setHistory] = useState<PldHistoryPoint[]>([]);
  const [range, setRange] = useState<PldRange>("48h");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/oracle/pld`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setPrices(json.prices);
          setUpdatedAt(json.updated_at);
          setSource(json.source);
        }
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch PLD data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (r: PldRange) => {
    setHistoryLoading(true);
    try {
      const param = r === "48h" ? "hours=48" : `range=${r}`;
      const res = await fetch(`${API_BASE_URL}/api/oracle/pld/history?${param}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setHistory(json.series);
      }
    } catch {
      // keep existing history on error
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const changeRange = useCallback((r: PldRange) => {
    setRange(r);
    fetchHistory(r);
  }, [fetchHistory]);

  useEffect(() => {
    fetchPrices();
    fetchHistory(range);
    intervalRef.current = setInterval(() => {
      fetchPrices();
      fetchHistory(range);
    }, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchPrices, fetchHistory, range]);

  const refresh = useCallback(() => {
    fetchPrices();
    fetchHistory(range);
  }, [fetchPrices, fetchHistory, range]);

  return { prices, history, range, changeRange, updatedAt, source, loading, historyLoading, error, refresh };
}

/* ── Submercado colors ── */

const SM_COLORS: Record<string, string> = {
  SE: "oklch(0.78 0.13 215)",
  S: "oklch(0.76 0.16 150)",
  NE: "oklch(0.66 0.22 25)",
  N: "oklch(0.82 0.16 75)",
};

const SM_LABELS: Record<string, string> = {
  SE: "SE/CO",
  S: "S",
  NE: "NE",
  N: "N",
};

/* ── Page ── */

function OraclePage() {
  const { stats, horizon, loading: dashLoading } = useDashboard();
  const { health } = useSettlementRail();
  const { prices, history, range, changeRange, updatedAt, source, loading: pldLoading, historyLoading, error: pldError, refresh: refreshPld } = usePldData();

  const horizonLatency = horizon?.latency_ms ?? 0;
  const horizonOnline = horizon?.horizon_online ?? false;
  const backendOnline = health?.status === "ok";
  const backendLatency = health?.backend?.latency_ms ?? 0;

  const loading = dashLoading || pldLoading;

  const refreshAll = () => {
    refreshPld();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Oracle Center · ONS / CCEE · Real-Time CMO
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Oracle & Market Data
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest">
            <Radio className="mr-1.5 h-3 w-3 text-success" />
            {STELLAR_NETWORK_LABEL}
          </Badge>
          <Button size="sm" variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* PLD Price Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {pldLoading && prices.length === 0 ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border bg-card p-3">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-24" />
            </Card>
          ))
        ) : prices.length > 0 ? (
          prices.map((p) => (
            <Card key={p.subsistema} className="border-border bg-card p-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                CMO · {p.submercado}
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold text-primary">
                R$ {p.cmo_brl_mwh.toFixed(2)}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                /MWh · {p.nome}
              </p>
            </Card>
          ))
        ) : (
          <Card className="col-span-full border-border bg-card p-4 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              {pldError ? `Erro: ${pldError}` : "Carregando preços PLD..."}
            </p>
          </Card>
        )}
      </div>

      {/* PLD Historical Chart */}
      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {RANGE_OPTIONS.find((o) => o.id === range)?.subtitle} · Fonte: ONS
            </p>
            <p className="font-display text-lg font-semibold">PLD Historical Curve</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="flex rounded-md border border-border overflow-hidden">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => changeRange(opt.id)}
                  className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                    range === opt.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-background/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {updatedAt && (
              <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px]">
                {fmtDate(updatedAt)}
              </Badge>
            )}
          </div>
        </div>

        {history.length > 0 ? (
          <div className="relative mt-3 h-72">
            {historyLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-[1px]">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.27 0.02 250)" />
                <XAxis
                  dataKey="t"
                  tickFormatter={(t) => {
                    if (range === "48h") return fmtTime(t);
                    if (range === "7d" || range === "1m") {
                      const p = t.split("-");
                      return p.length >= 3 ? `${p[2]}/${p[1]}` : t;
                    }
                    // 1y → "Mai/26"
                    const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
                    const [y, m] = t.split("-");
                    return m ? `${MONTHS[parseInt(m) - 1]}/${y?.slice(2)}` : t;
                  }}
                  stroke="oklch(0.55 0.02 240)"
                  fontSize={10}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis stroke="oklch(0.55 0.02 240)" fontSize={10} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.18 0.022 250)",
                    border: "1px solid oklch(0.28 0.02 250)",
                    fontSize: 11,
                  }}
                  labelFormatter={(t) => {
                    if (range === "48h") return fmtDate(t as string) + " BRT";
                    if (range === "7d" || range === "1m") {
                      const p = (t as string).split("-");
                      return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : (t as string);
                    }
                    const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
                    const [y, m] = (t as string).split("-");
                    return m ? `${MONTHS[parseInt(m) - 1]}/${y}` : (t as string);
                  }}
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toFixed(2)} /MWh`,
                    SM_LABELS[name] || name,
                  ]}
                />
                <Line type="monotone" dataKey="SE" stroke={SM_COLORS.SE} strokeWidth={1.5} dot={false} name="SE" />
                <Line type="monotone" dataKey="S"  stroke={SM_COLORS.S}  strokeWidth={1.5} dot={false} name="S" />
                <Line type="monotone" dataKey="NE" stroke={SM_COLORS.NE} strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="NE" />
                <Line type="monotone" dataKey="N"  stroke={SM_COLORS.N}  strokeWidth={1.5} dot={false} name="N" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-3 flex h-72 items-center justify-center">
            {pldLoading || historyLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <p className="font-mono text-sm text-muted-foreground">Sem dados históricos disponíveis.</p>
            )}
          </div>
        )}

        {/* Source attribution */}
        {source && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Fonte: {source}
            </span>
            <a
              href="https://dados.ons.org.br/dataset/cmo-semi-horario"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary"
            >
              dados.ons.org.br <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </Card>

      {/* Feed Monitor + Treasury */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border-border bg-card p-4 lg:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Oracle Feed Monitor · Data Sources
          </p>
          <div className="mt-3 space-y-2">
            <FeedRow
              source="ONS Open Data"
              feed="CMO Semi-Horário"
              latency={null}
              status={prices.length > 0 ? "ok" : "degraded"}
            />
            <FeedRow
              source="Stellar Horizon"
              feed="Ledger & Balances"
              latency={horizonLatency}
              status={horizonOnline ? "ok" : "degraded"}
            />
            <FeedRow
              source="Backend API"
              feed="Settlement Engine"
              latency={backendLatency}
              status={backendOnline ? "ok" : "degraded"}
            />
          </div>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Platform Treasury
          </p>
          <div className="mt-3 space-y-2">
            <TreasuryRow label="Operator XLM" value={horizon?.operator_balance?.xlm} symbol="XLM" />
            <TreasuryRow label="Distribution XLM" value={horizon?.distribution_balance?.xlm} symbol="XLM" />
            <TreasuryRow label="EPWR Supply" value={horizon?.distribution_balance?.epwr} symbol="EPWR" compact />
          </div>
        </Card>
      </div>

      {/* Telemetry */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border-border bg-card p-4 lg:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Oracle Health Indicators
          </p>
          <div className="mt-3 space-y-3">
            <HealthBar label="ONS Data Feed" value={prices.length > 0 ? 100 : 0} />
            <HealthBar label="Horizon Availability" value={horizonOnline ? 100 : 0} />
            <HealthBar label="Backend Availability" value={backendOnline ? 100 : health?.status === "degraded" ? 50 : 0} />
          </div>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Oracle Telemetry
          </p>
          <div className="mt-3 space-y-2">
            <TelRow icon={<Gauge className="h-3.5 w-3.5" />} label="Horizon latency" value={`${horizonLatency} ms`} tone={horizonLatency < 1000 ? "ok" : "warn"} />
            <TelRow icon={<Activity className="h-3.5 w-3.5" />} label="Backend latency" value={`${backendLatency} ms`} tone={backendLatency < 500 ? "ok" : "warn"} />
            <TelRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="PLD feeds" value={`${prices.length} submercados`} tone={prices.length === 4 ? "ok" : "warn"} />
            <TelRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Data source" value="ONS" tone="ok" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function FeedRow({
  source,
  feed,
  latency,
  status,
}: {
  source: string;
  feed: string;
  latency: number | null;
  status: "ok" | "degraded";
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-28">{source}</span>
        <span className="text-[11px] font-medium">{feed}</span>
      </div>
      <div className="flex items-center gap-4">
        {latency !== null && (
          <span className={`font-mono text-[11px] ${latency > 1000 ? "text-destructive" : "text-muted-foreground"}`}>
            {latency} ms
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${status === "ok" ? "bg-success animate-ping opacity-60" : "bg-destructive animate-ping opacity-60"}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${status === "ok" ? "bg-success" : "bg-destructive"}`} />
          </span>
          <span className={`font-mono text-[10px] uppercase tracking-widest ${status === "ok" ? "text-success" : "text-destructive"}`}>
            {status === "ok" ? "VERIFIED" : "DEGRADED"}
          </span>
        </span>
      </div>
    </div>
  );
}

function TreasuryRow({
  label,
  value,
  symbol,
  compact = false,
}: {
  label: string;
  value?: string;
  symbol: string;
  compact?: boolean;
}) {
  const formatted = value
    ? compact
      ? fmtCompact(Number(value))
      : Number(value).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    : "—";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[11px] font-medium">
        {formatted} <span className="text-muted-foreground">{symbol}</span>
      </span>
    </div>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 95 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={`font-mono text-[11px] ${pct >= 95 ? "text-success" : pct >= 70 ? "text-warning" : "text-destructive"}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TelRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tone: "ok" | "warn" | "muted";
}) {
  const color = tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-[11px] ${color}`}>{value ?? "—"}</span>
    </div>
  );
}
