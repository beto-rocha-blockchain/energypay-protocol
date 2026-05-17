import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useOperator } from "@/store/operator";

import appCss from "../styles.css?url";

const AppSidebar = lazy(() =>
  import("@/components/AppSidebar").then((m) => ({ default: m.AppSidebar })),
);

const OperatorBadge = lazy(() =>
  import("@/components/OperatorBadge").then((m) => ({ default: m.OperatorBadge })),
);

const StatusRail = lazy(() =>
  import("@/components/ops/StatusRail").then((m) => ({ default: m.StatusRail })),
);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Route not found in settlement registry.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);

  const router = useRouter();
  const isProd = import.meta.env?.PROD;

  const safeMessage = isProd
    ? "An unexpected error occurred. Please retry or return home."
    : error.message;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{safeMessage}</p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Retry
          </button>

          <Link
            to="/"
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EnergyPay — Programmable Settlement for Power Markets" },
      {
        name: "description",
        content: "Institutional settlement infrastructure for electricity contracts on Stellar.",
      },
      {
        property: "og:title",
        content: "EnergyPay — Programmable Settlement for Power Markets",
      },
      {
        name: "twitter:title",
        content: "EnergyPay — Programmable Settlement for Power Markets",
      },
      {
        property: "og:description",
        content: "Institutional settlement infrastructure for electricity contracts on Stellar.",
      },
      {
        name: "twitter:description",
        content: "Institutional settlement infrastructure for electricity contracts on Stellar.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isAuthenticated = useOperator((s) => s.isAuthenticated);
  const operator = useOperator((s) => s.operator);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register";

  useEffect(() => {
    if (!isAuthenticated && !isPublicRoute) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isPublicRoute, navigate]);

  if (isPublicRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen w-full bg-background">
          <Outlet />
        </div>
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Suspense fallback={null}>
            <AppSidebar />
          </Suspense>

          <div className="flex flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <SidebarTrigger />

                <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:inline">
                  {operator ? operator.organization : "Clearing Desk · BRL"}
                </span>

                <span className="hidden h-3 w-px bg-border md:inline" />

                <Suspense fallback={null}>
                  <StatusRail />
                </Suspense>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Suspense fallback={null}>
                  <OperatorBadge />
                </Suspense>
              </div>
            </header>

            <main className="flex-1 space-y-4 p-4 md:p-6 lg:p-8">
              {isAuthenticated ? <Outlet /> : null}
            </main>
          </div>
        </div>

        <Toaster />
      </SidebarProvider>
    </QueryClientProvider>
  );
}