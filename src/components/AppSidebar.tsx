import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calculator,
  Zap,
  Activity,
  ListChecks,
  FilePlus2,
  Send,
  Radio,
  Wallet,
  Factory,
  GitBranch,
  Gauge,
  ShieldCheck,
  Database,
  Network,
  BookLock,
  Banknote,
  PlugZap,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

import { useOperator } from "@/store/operator";

type Role = "GENERATOR" | "SELLER" | "INVESTOR" | "USER";

type Item = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  code: string;
  roles: Role[];
};

// --------------------------------------------------
// ACCESS HELPERS
// --------------------------------------------------

const canAccessItem = (item: Item, roles: Role[]) => {
  return item.roles.some((role) => roles.includes(role));
};

const filterItemsByRole = (items: Item[], roles: Role[]) => {
  return items.filter((item) => canAccessItem(item, roles));
};

// --------------------------------------------------
// EXECUTIVE & OPERATIONS
// --------------------------------------------------

const MARKET_OPS: Item[] = [
  {
    title: "Executive Ops",
    url: "/",
    icon: LayoutDashboard,
    code: "EXE-00",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER"],
  },

  {
    title: "Market Operations",
    url: "/ops",
    icon: Gauge,
    code: "OPS-01",
    roles: ["GENERATOR", "SELLER", "INVESTOR"],
  },

  {
    title: "Netting & Clearing",
    url: "/clearing",
    icon: GitBranch,
    code: "CLR-01",
    roles: ["SELLER", "INVESTOR"],
  },

  {
    title: "Network Topology",
    url: "/topology",
    icon: Network,
    code: "NET-01",
    roles: ["GENERATOR", "SELLER"],
  },
];

// --------------------------------------------------
// RISK & COMPLIANCE
// --------------------------------------------------

const RISK_DATA: Item[] = [
  {
    title: "Risk & Collateral",
    url: "/risk",
    icon: ShieldCheck,
    code: "RSK-01",
    roles: ["SELLER", "INVESTOR"],
  },

  {
    title: "Reconciliation",
    url: "/reconciliation",
    icon: Database,
    code: "RSK-02",
    roles: ["SELLER", "INVESTOR"],
  },

  {
    title: "Oracle & Market Data",
    url: "/oracle",
    icon: Radio,
    code: "RSK-03",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER"],
  },

  {
    title: "Audit & Compliance",
    url: "/audit",
    icon: BookLock,
    code: "RSK-04",
    roles: ["SELLER", "INVESTOR"],
  },
];

// --------------------------------------------------
// SETTLEMENT INFRASTRUCTURE
// --------------------------------------------------

const SETTLEMENT: Item[] = [
  {
    title: "Treasury & Rails",
    url: "/treasury",
    icon: Banknote,
    code: "STL-01",
    roles: ["SELLER", "INVESTOR"],
  },

  {
    title: "Settlement Engine",
    url: "/settlement",
    icon: Calculator,
    code: "STL-02",
    roles: ["GENERATOR", "SELLER", "INVESTOR"],
  },

  {
    title: "Direct Settlement",
    url: "/p2p",
    icon: Send,
    code: "STL-03",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER"],
  },

  {
    title: "x402 API Access",
    url: "/x402",
    icon: PlugZap,
    code: "STL-05",
    roles: ["INVESTOR", "USER"],
  },

  {
    title: "Custody Wallet",
    url: "/wallet",
    icon: Wallet,
    code: "STL-04",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER"],
  },
];

// --------------------------------------------------
// MARKET INFRASTRUCTURE
// --------------------------------------------------

const TERMINALS: Item[] = [
  {
    title: "Generator Terminal",
    url: "/generator",
    icon: Factory,
    code: "TRM-01",
    roles: ["GENERATOR"],
  },

  {
    title: "Contract Registry",
    url: "/contracts",
    icon: ListChecks,
    code: "TRM-02",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER"],
  },

  {
    title: "New Contract",
    url: "/contracts/new",
    icon: FilePlus2,
    code: "TRM-03",
    roles: ["GENERATOR", "SELLER"],
  },

  {
    title: "Operational Grid",
    url: "/grid",
    icon: Radio,
    code: "TRM-04",
    roles: ["GENERATOR"],
  },
];

function Group({ label, items, path }: { label: string; items: Item[]; path: string }) {
  if (items.length === 0) return null;

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
                      <span
                        aria-hidden
                        className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r-sm bg-primary"
                      />
                    )}

                    <item.icon className="h-3.5 w-3.5 shrink-0" />

                    <span className="truncate text-[12px] leading-none">{item.title}</span>

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
  const path = useRouterState({
    select: (s) => s.location.pathname,
  });

  const operator = useOperator((s) => s.operator);
  const roles = (operator?.roles ?? []) as Role[];

  const marketOps = filterItemsByRole(MARKET_OPS, roles);
  const riskData = filterItemsByRole(RISK_DATA, roles);
  const settlement = filterItemsByRole(SETTLEMENT, roles);
  const terminals = filterItemsByRole(TERMINALS, roles);

  const buildHash = "b9f4c2e";

  return (
    <Sidebar collapsible="icon" className="w-72">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[image:var(--gradient-primary)]">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>

          <div className="flex flex-col leading-tight">
            <span className="truncate text-[12px] leading-none">EnergyPay</span>

            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Clearing & Settlement OS
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <Group label="Executive Layer" items={marketOps} path={path} />

        <Group label="Risk & Clearing" items={riskData} path={path} />

        <Group label="Settlement Infrastructure" items={settlement} path={path} />

        <Group label="Market Infrastructure" items={terminals} path={path} />
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
