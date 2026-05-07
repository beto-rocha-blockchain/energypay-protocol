export type SettlementResponse = {
  txHash: string;
  ledger: number;
  successful: boolean;
};

export async function executeSettlement(): Promise<SettlementResponse> {
  const response = await fetch(
    "http://localhost:3000/api/settlement/execute",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Settlement execution failed");
  }

  return response.json();
}