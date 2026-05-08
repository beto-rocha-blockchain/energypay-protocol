export type UserRole =
  | "GENERATOR"
  | "SELLER"
  | "INVESTOR"
  | "CONSUMER";

export type UserProfile = {
  id: string;

  full_name: string;
  email: string;

  role: UserRole;

  organization?: string;
  city?: string;
  state?: string;

  wallet_public_key: string;
};