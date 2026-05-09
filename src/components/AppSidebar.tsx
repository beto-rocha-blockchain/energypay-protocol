import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Calculator, Zap, Activity, ListChecks, FilePlus2, Send, Radio } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";

const items = [
  { title: "Control Room", url: "/", icon: LayoutDashboard },
  { title: "Contract Registry", url: "/contracts", icon: ListChecks },
  { title: "New Contract", url: "/contracts/new", icon: FilePlus2 },
  { title: "Settlement Engine", url: "/settlement", icon: Calculator },
  { title: "Direct Settlement", url: "/p2p", icon: Send },
  { title: "Operational Grid", url: "/grid", icon: Radio },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">EnergyPay</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Clearing Infrastructure</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-success" />
          <span className="font-mono">Stellar Testnet · Settlement Network</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
