import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, KeyRound, Building2, Mail, ShieldCheck, Activity, Terminal, Loader2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOperator } from "@/store/operator";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safe-error";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useOperator((s) => s.isAuthenticated);
  const login = useOperator((s) => s.login);

  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/" });
  }, [isAuthenticated, navigate]);

  const onAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Operator email and password are required.");
      return;
    }
    setBusy(true);
    try {
      const id = await login({ email, password, organization: organization || undefined });
      toast.success(`Operator ${id.operatorId} connected · Stellar Testnet active`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(safeErrorMessage(err, "Authentication failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full place-items-center px-4">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
        <Card className="hidden flex-col justify-between overflow-hidden border-border bg-card/60 p-6 lg:flex">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
                <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">EnergyPay</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Clearing & Settlement Infrastructure
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Operator Access · Pilot Environment
              </div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                Programmable settlement<br />for power markets.
              </h1>
              <p className="mt-2 max-w-sm text-xs text-muted-foreground">
                Operator access connects an existing settlement identity to the EnergyPay clearing
                network, anchored to Stellar Testnet for institutional reconciliation.
              </p>
            </div>

            <Separator className="my-6 bg-border/60" />

            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-success" />
                <span><span className="font-mono text-foreground">Operational credentials</span> · scoped to clearing desk &amp; reconciliation</span>
              </li>
              <li className="flex items-start gap-2">
                <Terminal className="mt-0.5 h-3.5 w-3.5 text-accent" />
                <span><span className="font-mono text-foreground">Settlement identity</span> · ed25519 keypair bound to operator</span>
              </li>
              <li className="flex items-start gap-2">
                <Activity className="mt-0.5 h-3.5 w-3.5 text-success" />
                <span><span className="font-mono text-foreground">Network status</span> · Stellar Testnet · Settlement Network</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span>EnergyPay Clearing · v0.4.2</span>
            <span className="flex items-center gap-1.5 text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Network nominal
            </span>
          </div>
        </Card>

        <Card className="overflow-hidden border-border bg-card/70">
          <div className="flex items-center justify-between border-b border-border bg-background/40 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Settlement Network · Access Terminal
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">SECURE · TLS</div>
          </div>

          <form onSubmit={onAccess} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Operator Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="username" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@clearing-desk.com" className="h-9 pl-8 font-mono text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Organization
              </Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="org" value={organization} onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Treasury · Energy Trading Desk" className="h-9 pl-8 font-mono text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="key" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="key" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••" className="h-9 pl-8 font-mono text-xs tracking-widest" />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Authenticated against the EnergyPay clearing backend. Sessions are scoped to this browser tab.
              </p>
            </div>

            <Button type="submit" disabled={busy} className="h-9 w-full font-mono text-xs uppercase tracking-widest">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {busy ? "Authenticating…" : "Access Clearing Environment"}
            </Button>

            <Separator className="bg-border/60" />

            <Link to="/register"
              className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2.5 text-xs transition hover:border-primary/40 hover:bg-primary/5">
              <span>
                <span className="block font-mono uppercase tracking-widest text-foreground">
                  Provision new settlement identity
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Mint operator identity · ed25519 keypair · market participant roles
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <div className="flex items-center justify-between border-t border-border pt-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span>Stellar Testnet · Settlement Network</span>
              <span className="flex items-center gap-1.5 text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Online
              </span>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
