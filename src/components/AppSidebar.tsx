import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Calculator, Zap, Activity, ListChecks, FilePlus2, Send, Radio, Wallet, Factory,
  GitBranch, Gauge, ShieldCheck, Database, Network, BookLock, Banknote,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; code: string };

// Canonical IA: domain-grouped, codes match terminology
const MARKET_OPS: Item[] = [
  { title: "Control Room",       url: "/",              icon: LayoutDashboard, code: "MKT-00" },
  { title: "Market Operations",  url: "/ops",           icon: Gauge,           code: "MKT-01" },
  { title: "Clearing House",     url: "/clearing",      icon: GitBranch,       code: "MKT-02" },
  { title: "Network Topology",   url: "/topology",      icon: Network,         code: "MKT-03" },
];

const RISK_DATA: Item[] = [
  { title: "Risk & Collateral",  url: "/risk",          icon: ShieldCheck,     code: "RSK-01" },
  { title: "Reconciliation",     url: "/reconciliation", icon: Database,       code: "RSK-02" },
  { title: "Oracle & Mkt Data",  url: "/oracle",         icon: Radio,          code: "RSK-03" },
  { title: "Audit & Compliance", url: "/audit",          icon: BookLock,       code: "RSK-04" },
];

const SETTLEMENT: Item[] = [
  { title: "Treasury & Rails",   url: "/treasury",       icon: Banknote,       code: "STL-01" },
  { title: "Settlement Engine",  url: "/settlement",     icon: Calculator,     code: "STL-02" },
  { title: "Direct Settlement",  url: "/p2p",            icon: Send,           code: "STL-03" },
  { title: "Wallet",             url: "/wallet",         icon: Wallet,         code: "STL-04" },
];

const TERMINALS: Item[] = [
  { title: "Generator Terminal", url: "/generator",      icon: Factory,        code: "TRM-01" },
  { title: "Contract Registry",  url: "/contracts",      icon: ListChecks,     code: "TRM-02" },
  { title: "New Contract",       url: "/contracts/new",  icon: FilePlus2,      code: "TRM-03" },
  { title: "Operational Grid",   url: "/grid",           icon: Radio,          code: "TRM-04" },
];

function Group({ label, items, path }: { label: string; items: Item[]; path: string }) {
  return (
    <SidebarGroup className="py-1">
      <SidebarGroupLabel className="px-2 font-mono text-[9.5px] font-medium tracking-[0.22em] text-muted-foreground/75">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-[2px]">
          {items.map((item) => {
            const active = path === item.url || (item.url !== "/" && path.startsWith(item.url));
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="relative h-7 rounded-sm pl-2 pr-1 data-[active=true]:bg-sidebar-accent/70"
                >
                  <Link to={item.url} className="flex items-center gap-2">
                    {active && (
                      <span aria-hidden className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r-sm bg-primary" />
                    )}
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[12.5px] leading-none">{item.title}</span>
                    <span className="ml-auto font-mono text-[9px] tracking-widest text-muted-foreground/55">
                      {item.code}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const buildHash = "b9f4c2e"; // ephemeral, replaced on real build pipeline

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[image:var(--gradient-primary)]">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[12.5px] font-semibold tracking-tight">EnergyPay</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Clearing & Settlement OS
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <Group label="Market Ops"   items={MARKET_OPS} path={path} />
        <Group label="Risk & Data"  items={RISK_DATA}  path={path} />
        <Group label="Settlement"   items={SETTLEMENT} path={path} />
        <Group label="Terminals"    items={TERMINALS}  path={path} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex flex-col gap-1 px-2 py-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Operator</span>
            <span className="text-foreground/85">OP-7741</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Session</span>
            <span className="text-foreground/70">sess · {buildHash}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-success animate-status-dot" />
              <span>Stellar Testnet</span>
            </div>
            <span className="text-foreground/70">v0.5</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
