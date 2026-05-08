import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  FileSignature,
  ExternalLink,
  Info,
  ShieldAlert,
  TrendingUp,
  Wallet,
  Zap,
  Clock,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { StatCard } from "@/components/StatCard";
import { SettlementTimeline } from "@/components/SettlementTimeline";

import {
  pldSeries,
  volumeSeries,
  computeExposure,
} from "@/lib/mock-data";

import { useOps } from "@/store/operations";

import { useBackendStatus } from "@/hooks/useBackendStatus";

import { getSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Control Room — EnergyPay Settlement",
      },
      {
        name: "description",
        content:
          "Operational overview of programmable energy settlements, exposure and reconciliation.",
      },
    ],
  }),

  component: Dashboard,
});

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function Dashboard() {
  const contracts = useOps((s) => s.contracts);
  const settlements = useOps((s) => s.settlements);
  const alerts = useOps((s) => s.alerts);
  const queue = useOps((s) => s.queue);
  const feed = useOps((s) => s.feed);

  const { status, online } = useBackendStatus();

  const activeContracts = contracts.filter(
    (c) => c.status === "ACTIVE"
  ).length;

  const settledToday = 22900;

  const exposure = contracts
    .filter((c) => c.status === "ACTIVE")
    .reduce((acc, c) => acc + Math.abs(computeExposure(c)), 0);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Settlement Operations / Control Room
          </p>

          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Operational Overview
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Intraday settlement cycle · counterparty exposure · reconciliation
            pipeline.
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/contracts">
              <FileSignature className="mr-2 h-4 w-4" />
              Contract Registry
            </Link>
          </Button>

          <Button asChild size="sm">
            <Link to="/settlement">
              <Activity className="mr-2 h-4 w-4" />
              Run Settlement
            </Link>
          </Button>

          <Button asChild size="sm">
            <Link to="/contracts/new">
              <FileSignature className="mr-2 h-4 w-4" />
              New Contract
            </Link>
          </Button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active Contracts"
          value={activeContracts}
          sub="3 onboarded this cycle"
          trend="up"
          icon={<FileSignature className="h-5 w-5" />}
        />

        <StatCard
          label="Settled Today (MWh)"
          value={settledToday.toLocaleString("pt-BR")}
          sub="+12.4% vs. previous cycle"
          trend="up"
          icon={<Zap className="h-5 w-5" />}
        />

        <StatCard
          label="Cleared Volume (30d)"
          value={fmtBRL(38_420_000)}
          sub="98.7% transaction finality"
          trend="up"
          icon={<TrendingUp className="h-5 w-5" />}
        />

        <StatCard
          label="Intraday Open Exposure"
          value={fmtBRL(exposure)}
          sub="Δ −1.8% vs. T-1 close"
          trend="down"
          icon={<Wallet className="h-5 w-5" />}
        />

        {/* BACKEND STATUS */}
        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Settlement API
              </p>

              <p className="mt-2 font-display text-lg font-semibold">
                {online ? "ONLINE" : "OFFLINE"}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {status?.network || "no network"}
              </p>
            </div>

            <div
              className={`h-3 w-3 rounded-full ${
                online ? "bg-success" : "bg-destructive"
              }`}
            />
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <p className="font-mono text-[10px] text-muted-foreground">
              {status?.timestamp || "No timestamp"}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}