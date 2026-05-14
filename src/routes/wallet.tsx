import { createFileRoute, Navigate } from "@tanstack/react-router";
import { WalletBalancesPanel } from "@/components/WalletBalancesPanel";
import { TokenAllocationPanel } from "@/components/TokenAllocationPanel";
import { BlockchainActivityFeed } from "@/components/BlockchainActivityFeed";
import { useOperator } from "@/store/operator";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — EnergyPay Settlement" },
      {
        name: "description",
        content:
          "Live institutional wallet balances on the Stellar settlement rail — XLM, EPRW and operational telemetry.",
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <WalletBalancesPanel
        publicKey={operator.wallet.publicKey}
        organization={operator.organization}
        funded={operator.funded}
      />
      <TokenAllocationPanel publicKey={operator.wallet.publicKey} />
      <BlockchainActivityFeed publicKey={operator.wallet.publicKey} />
    </div>
  );
}
