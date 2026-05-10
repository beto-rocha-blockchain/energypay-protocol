export function isValidPublicKey(key: string): boolean {
  return (
    typeof key === "string" &&
    key.startsWith("G") &&
    key.length === 56
  );
}

export function stellarExpertTx(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

export function stellarExpertAccount(address: string): string {
  return `https://stellar.expert/explorer/testnet/account/${address}`;
}