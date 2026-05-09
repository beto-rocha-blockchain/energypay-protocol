import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useOperator, maskAddress, ROLE_META } from "@/store/operator";
import {
  Copy, LogOut, ShieldCheck, Activity, Building2, Mail, Hash, Check,
  KeyRound, MapPin,
} from "lucide-react";
import { toast } from "sonner";

export function OperatorBadge() {
  const operator = useOperator((s) => s.operator);
  const logout = useOperator((s) => s.logout);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!operator) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(operator.settlementAddress);
      setCopied(true);
      toast.success("Settlement address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const onLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground transition hover:bg-accent/10"
        >
          <span className="flex items-center gap-1.5 text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Operator Connected
          </span>
          <span className="hidden text-muted-foreground md:inline">·</span>
          <span className="hidden text-muted-foreground md:inline">{operator.operatorId}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] border-border bg-card/95 p-0 backdrop-blur"
      >
        <div className="flex items-center justify-between border-b border-border bg-background/40 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Operator Profile
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            {operator.networkStatus}
          </span>
        </div>

        <div className="space-y-3 p-3.5">
          <Row icon={<Hash className="h-3 w-3" />} label="Operator ID" value={operator.operatorId} mono />
          <Row icon={<Hash className="h-3 w-3" />} label="Full Name" value={operator.fullName} />
          <Row icon={<Building2 className="h-3 w-3" />} label="Organization" value={operator.organization} />
          <Row icon={<Mail className="h-3 w-3" />} label="Operator Email" value={operator.email} mono />
          <Row icon={<MapPin className="h-3 w-3" />} label="Jurisdiction" value={`${operator.city} · ${operator.country}`} />

          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Signer Address · Active Settlement Authority
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <code className="flex-1 truncate rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground">
                {operator.wallet.publicKey}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copy}
                className="h-7 px-2 font-mono text-[10px] uppercase tracking-widest">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {maskAddress(operator.wallet.publicKey)} · ed25519 · Stellar Testnet
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              Signer custody
            </div>
            <div className="mt-1 rounded-md border border-border bg-background/60 px-2 py-1.5 font-mono text-[11px] text-foreground">
              Backend custody · ed25519 · {operator.wallet.status}
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              Secret seed is held by the EnergyPay backend. Settlement signing is performed server-side on Stellar Testnet.
            </div>
          </div>

          <Separator className="bg-border/60" />

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Market Participant Roles
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {operator.roles.length === 0 && (
                <span className="font-mono text-[10px] text-muted-foreground">No roles provisioned</span>
              )}
              {operator.roles.map((r) => (
                <span key={r}
                  className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                  {ROLE_META[r].label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-widest">
            <Mini label="Access Level" value={operator.accessLevel.replace("_", " ")} />
            <Mini label="Network" value="Stellar Testnet" />
            <Mini label="Funded" value={operator.funded ? "Yes · Friendbot" : "No"} />
            <Mini label="Connectivity" value="Horizon · OK" tone="success" />
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Reconciliation Permissions
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {operator.permissions.map((p) => (
                <span key={p}
                  className="rounded-sm border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-background/40 px-3 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3 w-3 text-success" />
            Session active
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-7 px-2 font-mono text-[10px] uppercase tracking-widest"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  icon, label, value, mono,
}: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 truncate text-xs ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[11px] ${tone === "success" ? "text-success" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
