import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, ShieldCheck, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EnergyPay — Programmable Settlement Infrastructure" },
      {
        name: "description",
        content:
          "Programmable clearing, reconciliation and settlement infrastructure for energy contracts.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-stretch">
          <Card className="border-border bg-card/70 p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
                <Zap className="h-6 w-6 text-primary-foreground" />
              </div>

              <div>
                <div className="font-display text-xl font-semibold">EnergyPay</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Clearing & Settlement Infrastructure
                </div>
              </div>
            </div>

            <div className="mt-10">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Programmable Financial Rail for Electricity Markets
              </p>

              <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight">
                Programmable settlement infrastructure for energy contracts.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                EnergyPay modernizes the operational layer behind energy contract settlement:
                clearing, reconciliation, programmable payments, auditability and Stellar Testnet
                settlement in one institutional platform.
              </p>
            </div>

            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="rounded-md border border-border bg-background/40 p-4">
                <ShieldCheck className="mb-2 h-5 w-5 text-success" />
                <div className="font-mono text-xs uppercase tracking-widest text-foreground">
                  Clearing
                </div>
                <p className="mt-1 text-xs">Contract lifecycle and counterparty visibility.</p>
              </div>

              <div className="rounded-md border border-border bg-background/40 p-4">
                <Activity className="mb-2 h-5 w-5 text-primary" />
                <div className="font-mono text-xs uppercase tracking-widest text-foreground">
                  Reconciliation
                </div>
                <p className="mt-1 text-xs">Operational audit trails and settlement state.</p>
              </div>

              <div className="rounded-md border border-border bg-background/40 p-4">
                <Zap className="mb-2 h-5 w-5 text-accent" />
                <div className="font-mono text-xs uppercase tracking-widest text-foreground">
                  Settlement
                </div>
                <p className="mt-1 text-xs">Programmable transactions on Stellar Testnet.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/login">
                  Access Platform <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline">
                <Link to="/register">Create Account</Link>
              </Button>

              <Button asChild variant="ghost">
                <Link to="/p2p">Direct Settlement</Link>
              </Button>
            </div>
          </Card>

          <Card className="border-border bg-[image:var(--gradient-card)] p-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Pilot Environment
                </p>
                <p className="mt-1 font-display text-lg font-semibold">System Status</p>
              </div>

              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Online
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {[
                ["Network", "Stellar Testnet"],
                ["Backend", "EnergyPay API"],
                ["Settlement Rail", "Direct Settlement"],
                ["x402 Flow", "Enabled"],
                ["Auditability", "Transaction hash + ledger"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-md border border-border bg-background/40 px-4 py-3"
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                  <span className="font-mono text-xs text-foreground">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Demo Flow
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Open the platform, provision or access an operator identity, execute a Direct
                Settlement, inspect the transaction hash and validate the operation through Stellar
                Testnet.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}