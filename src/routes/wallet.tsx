import { createFileRoute, Navigate } from "@tanstack/react-router";
import { WalletBalancesPanel } from "@/components/WalletBalancesPanel";
import { useOperator } from "@/store/operator";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — EnergyPay Settlement" },
      {
        name: "description",
        content:
          "Live institutional wallet balances on the Stellar settlement rail — XLM, EPWR and operational telemetry.",
      },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const operator = useOperator((s) => s.operator);
  const isAuthenticated = useOperator((s) => s.isAuthenticated);

  if (!isAuthenticated || !operator) {
    return <Navigate to="/login" />;
  }

  const publicKey =
    operator?.wallet?.publicKey ||
    operator?.settlementAddress ||
    "";

  if (!publicKey) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-warning">
            Wallet unavailable
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This operator session does not include a valid Stellar settlement address.
            Please sign out and provision a new settlement identity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <WalletBalancesPanel
        publicKey={publicKey}
        organization={operator.organization}
        funded={operator.funded || operator.wallet?.funded}
      />

      <div className="rounded-md border border-border bg-card p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Wallet modules
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Token allocation and blockchain activity modules are temporarily disabled
          in the production demo while the live wallet feed is stabilized.
        </p>
      </div>
    </div>
  );
}