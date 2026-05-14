/**
 * P2P transfer validation — runs both as a frontend guard and as the
 * canonical server-side schema. Validates destination public key checksum,
 * asset whitelist, amount bounds and memo/transferId shape BEFORE any
 * Stellar Testnet submission.
 *
 * Returns a structured error code + UI-ready message so the surface in the
 * settlement terminal is always actionable.
 */

import { z } from "zod";
import { isValidPublicKey } from "@/lib/stellar";

export const SUPPORTED_ASSETS = ["EPWR", "XLM"] as const;
export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

// Stellar memo_text max length is 28 bytes. We allow ASCII-printable chars
// plus a small set of safe punctuation suitable for settlement references.
const MEMO_REGEX = /^[A-Za-z0-9 _\-.:#/]{0,28}$/;
const TRANSFER_ID_REGEX = /^P2P-[A-Z0-9]{4,12}$/;

export const p2pTransferSchema = z.object({
  sender_user_id: z.string().trim().min(1, "Missing operator session id."),
  recipient_public_key: z
    .string()
    .trim()
    .min(56, "Stellar public key must be 56 characters.")
    .max(56, "Stellar public key must be 56 characters.")
    .refine(isValidPublicKey, {
      message: "Invalid Stellar public key (G… ed25519, checksum failed).",
    }),
  asset: z.enum(SUPPORTED_ASSETS, {
    errorMap: () => ({ message: "Unsupported asset. Allowed: EPWR, XLM." }),
  }),
  amount: z
    .number({ invalid_type_error: "Amount must be a number." })
    .finite("Amount must be finite.")
    .positive("Amount must be greater than zero.")
    .max(1_000_000_000, "Amount exceeds settlement rail ceiling."),
  memo: z
    .string()
    .trim()
    .max(28, "Memo must be 28 characters or fewer (Stellar memo_text).")
    .regex(MEMO_REGEX, "Memo contains unsupported characters.")
    .optional()
    .or(z.literal("")),
  transfer_id: z
    .string()
    .trim()
    .regex(TRANSFER_ID_REGEX, "Invalid transferId (expected P2P-XXXXXX).")
    .optional(),
});

export type P2PTransferInput = z.input<typeof p2pTransferSchema>;
export type P2PTransferValidated = z.output<typeof p2pTransferSchema>;

export type ValidationFailure = {
  ok: false;
  code:
    | "INVALID_DESTINATION"
    | "UNSUPPORTED_ASSET"
    | "INVALID_AMOUNT"
    | "INVALID_MEMO"
    | "INVALID_TRANSFER_ID"
    | "MISSING_OPERATOR"
    | "INVALID_PAYLOAD";
  field: keyof P2PTransferInput | "payload";
  message: string;
};

export type ValidationSuccess = { ok: true; data: P2PTransferValidated };

const codeForField = (field: string): ValidationFailure["code"] => {
  switch (field) {
    case "recipient_public_key": return "INVALID_DESTINATION";
    case "asset": return "UNSUPPORTED_ASSET";
    case "amount": return "INVALID_AMOUNT";
    case "memo": return "INVALID_MEMO";
    case "transfer_id": return "INVALID_TRANSFER_ID";
    case "sender_user_id": return "MISSING_OPERATOR";
    default: return "INVALID_PAYLOAD";
  }
};

export const validateP2PTransfer = (
  input: unknown,
): ValidationSuccess | ValidationFailure => {
  const parsed = p2pTransferSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  const field = (issue?.path[0] as string) || "payload";
  return {
    ok: false,
    code: codeForField(field),
    field: field as ValidationFailure["field"],
    message: issue?.message || "Invalid settlement payload.",
  };
};
