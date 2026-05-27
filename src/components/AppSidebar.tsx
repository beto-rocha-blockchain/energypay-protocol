import { useRouterState, useNavigate } from "@tanstack/react-router";
import { STELLAR_NETWORK_LABEL } from "@/lib/stellar";
import {
  LayoutDashboard,
  Calculator,

  Activity,
  ListChecks,
  FilePlus2,
  Send,
  Radio,
  Wallet,
  Factory,
  GitBranch,
  ShieldCheck,
  Database,
  Network,
  BookLock,
  Banknote,
  PlugZap,
  Building2,
  Cable,
  MapPinned,
  FileCheck2,
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
import { BrandBadge, BrandName } from "@/components/BrandLogo";

type Role = "GENERATOR" | "SELLER" | "INVESTOR" | "USER" | "UTILITY";

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
  if (roles.length === 0) return false;

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
    title: "Operations",
    url: "/",
    icon: LayoutDashboard,
    code: "OPS-00",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"],
  },
  {
    title: "Netting & Clearing",
    url: "/clearing",
    icon: GitBranch,
    code: "CLR-01",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "UTILITY"],
  },
];

// --------------------------------------------------
// RISK & COMPLIANCE
// --------------------------------------------------

const RISK_DATA: Item[] = [
  {
    title: "Reconciliation",
    url: "/reconciliation",
    icon: Database,
    code: "RSK-02",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "UTILITY"],
  },
  {
    title: "Oracle & Market Data",
    url: "/oracle",
    icon: Radio,
    code: "RSK-03",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"],
  },
  {
    title: "Audit & Compliance",
    url: "/audit",
    icon: BookLock,
    code: "RSK-04",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "UTILITY"],
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
    roles: ["GENERATOR", "SELLER", "INVESTOR", "UTILITY"],
  },
  {
    title: "Settlement Engine",
    url: "/settlement",
    icon: Calculator,
    code: "STL-02",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"],
  },
  {
    title: "Direct Settlement",
    url: "/p2p",
    icon: Send,
    code: "STL-03",
    // P2P livre — todos os participantes são agentes do mercado livre
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"],
  },
  {
    title: "x402 API Access",
    url: "/x402",
    icon: PlugZap,
    code: "STL-05",
    roles: ["SELLER", "INVESTOR", "USER", "UTILITY"],
  },
  {
    title: "Custody Wallet",
    url: "/wallet",
    icon: Wallet,
    code: "STL-04",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"],
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
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"],
  },
  {
    title: "New Contract",
    url: "/contracts/new",
    icon: FilePlus2,
    code: "TRM-03",
    roles: ["GENERATOR", "SELLER", "USER", "UTILITY"],
  },
  {
    title: "Operational Grid",
    url: "/grid",
    icon: Radio,
    code: "TRM-04",
    roles: ["GENERATOR", "SELLER", "INVESTOR", "USER", "UTILITY"],
  },
];

// --------------------------------------------------
// UTILITY OPERATIONS (concessionária exclusiva)
// --------------------------------------------------

const UTILITY_OPS: Item[] = [
  {
    title: "UC Registry",
    url: "/utility/uc",
    icon: MapPinned,
    code: "UTL-01",
    roles: ["UTILITY"],
  },
  {
    title: "Grid Connections",
    url: "/utility/connections",
    icon: Cable,
    code: "UTL-02",
    roles: ["UTILITY"],
  },
  {
    title: "TUSD Settlement",
    url: "/utility/tusd",
    icon: Banknote,
    code: "UTL-03",
    roles: ["UTILITY"],
  },
  {
    title: "Connection Certificates",
    url: "/utility/certificates",
    icon: FileCheck2,
    code: "UTL-04",
    roles: ["UTILITY"],
  },
  {
    title: "Concession Area",
    url: "/utility/area",
    icon: Building2,
    code: "UTL-05",
    roles: ["UTILITY"],
  },
];

function Group({ label, items, path }: { label: string; items: Item[]; path: string }) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <SidebarGroup className="py-1">
      <SidebarGroupLabel className="px-2 font-mono text-[9.5px] font-medium tracking-[0.22em] text-muted-foreground/75">
        {label}
      </SidebarGroupLabel>

      <SidebarGroupContent>
        <SidebarMenu className="gap-[2px]">
          {items.map((item) => {
            // Exact match only — child routes (e.g. /contracts/new) should NOT
            // highlight a parent entry (/contracts) when both are in the sidebar.
            const active = path === item.url;

            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={{ children: item.title, className: "font-mono text-[11px]" }}
                  className="relative h-7 cursor-pointer select-none rounded-sm pl-2 pr-1 data-[active=true]:bg-sidebar-accent/70"
                  onClick={() => navigate({ to: item.url })}
                >
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
  const utilityOps = filterItemsByRole(UTILITY_OPS, roles);

  const buildHash = "b9f4c2e";

  return (
    <Sidebar collapsible="icon" className="w-72">
      <SidebarHeader className="!p-0 border-b border-sidebar-border">
        <div className="flex h-12 items-center gap-2.5 px-3">
          <BrandBadge size="sm" />
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden" style={{ gap: "5px" }}>
            <BrandName size="sm" />
            <span className="font-mono text-[9px] uppercase leading-none tracking-[0.22em] text-muted-foreground">
              Clearing &amp; Settlement OS
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <Group label="Executive Layer" items={marketOps} path={path} />

        <Group label="Risk & Clearing" items={riskData} path={path} />

        <Group label="Settlement Infrastructure" items={settlement} path={path} />

        <Group label="Market Infrastructure" items={terminals} path={path} />

        <Group label="Utility Operations" items={utilityOps} path={path} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {/* Expanded: full info grid */}
        <div className="flex flex-col gap-1.5 px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground group-data-[collapsible=icon]:hidden">
          <div className="grid grid-cols-[64px_1fr] items-center gap-2">
            <span>Operator</span>
            <span
              className="min-w-0 truncate text-right text-foreground/85"
              title={operator?.operatorId ?? "No session"}
            >
              {operator?.operatorId ?? "No session"}
            </span>
          </div>
          <div className="grid grid-cols-[64px_1fr] items-center gap-2">
            <span>Roles</span>
            <span
              className="min-w-0 truncate text-right text-foreground/70"
              title={roles.length > 0 ? roles.map(r => r === "USER" ? "CONSUMER" : r).join(" · ") : "UNASSIGNED"}
            >
              {roles.length > 0 ? roles.map(r => r === "USER" ? "CONSUMER" : r).join(" · ") : "UNASSIGNED"}
            </span>
          </div>
          <div className="grid grid-cols-[64px_1fr] items-center gap-2">
            <span>Network</span>
            <div className="flex min-w-0 items-center justify-end gap-1.5">
              <Activity className="h-3 w-3 shrink-0 text-success animate-status-dot" />
              <span className="truncate text-foreground/70">{STELLAR_NETWORK_LABEL}</span>
            </div>
          </div>
          <div className="grid grid-cols-[64px_1fr] items-center gap-2">
            <span>Version</span>
            <span className="min-w-0 truncate text-right text-foreground/70">
              v0.5 · {buildHash}
            </span>
          </div>
        </div>
        {/* Collapsed: just a network status dot */}
        <div className="hidden items-center justify-center py-2 group-data-[collapsible=icon]:flex">
          <Activity className="h-3.5 w-3.5 text-success animate-status-dot" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}