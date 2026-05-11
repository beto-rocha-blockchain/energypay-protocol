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

const OPERATIONS: Item[] = [
  { title: "Control Room",       url: "/",              icon: LayoutDashboard, code: "OPS-00" },
  { title: "Market Operations",  url: "/ops",           icon: Gauge,           code: "OPS-01" },
  { title: "Clearing House",     url: "/clearing",      icon: GitBranch,       code: "OPS-02" },
  { title: "Network Topology",   url: "/topology",      icon: Network,         code: "OPS-03" },
];

const RISK_DATA: Item[] = [
  { title: "Reconciliation",     url: "/reconciliation", icon: Database,       code: "RSK-01" },
  { title: "Oracle & Mkt Data",  url: "/oracle",         icon: Radio,          code: "RSK-02" },
  { title: "Risk & Collateral",  url: "/risk",           icon: ShieldCheck,    code: "RSK-03" },
];

const SETTLEMENT: Item[] = [
  { title: "Treasury & Rails",   url: "/treasury",       icon: Banknote,       code: "STL-01" },
  { title: "Settlement Engine",  url: "/settlement",     icon: Calculator,     code: "STL-02" },
  { title: "Direct Settlement",  url: "/p2p",            icon: Send,           code: "STL-03" },
  { title: "Wallet",             url: "/wallet",         icon: Wallet,         code: "STL-04" },
  { title: "Audit & Compliance", url: "/audit",          icon: BookLock,       code: "STL-05" },
];

const TERMINALS: Item[] = [
  { title: "Generator Terminal", url: "/generator",      icon: Factory,        code: "TRM-01" },
  { title: "Contract Registry",  url: "/contracts",      icon: ListChecks,     code: "TRM-02" },
  { title: "New Contract",       url: "/contracts/new",  icon: FilePlus2,      code: "TRM-03" },
  { title: "Operational Grid",   url: "/grid",           icon: Radio,          code: "TRM-04" },
];

function Group({ label, items, path }: { label: string; items: Item[]; path: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-mono text-[9.5px] tracking-[0.22em] text-muted-foreground/80">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = path === item.url || (item.url !== "/" && path.startsWith(item.url));
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} className="h-8">
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-3.5 w-3.5" />
                    <span className="text-[12.5px]">{item.title}</span>
                    <span className="ml-auto font-mono text-[9px] tracking-widest text-muted-foreground/60">{item.code}</span>
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
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-tight">EnergyPay</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Settlement Infrastructure · v0.5
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Group label="Operations"   items={OPERATIONS} path={path} />
        <Group label="Risk & Data"  items={RISK_DATA}  path={path} />
        <Group label="Settlement"   items={SETTLEMENT} path={path} />
        <Group label="Terminals"    items={TERMINALS}  path={path} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Activity className="h-3 w-3 text-success animate-pulse" />
          <span>Stellar Testnet · Live</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
