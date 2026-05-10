export interface P2PValidationResult {
  success: boolean;
  errors: string[];
}

interface ValidateTransferInput {
  amount?: number;
  destination?: string;
  assetCode?: string;
}

export function validateP2PTransfer(
  input: ValidateTransferInput
): P2PValidationResult {
  const errors: string[] = [];

  if (!input.destination) {
    errors.push("Destination wallet is required.");
  }

  if (!input.amount || input.amount <= 0) {
    errors.push("Transfer amount must be greater than zero.");
  }

  return {
    success: errors.length === 0,
    errors,
  };
}