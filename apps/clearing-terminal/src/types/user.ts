export type UserRole =
  | "Generator"
  | "Seller"
  | "Investor"
  | "Consumer";

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