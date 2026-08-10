export type UserRole = "admin" | "member";

export type TransactionStatus = "pending" | "success" | "failed" | "cancelled";

export type WithdrawalStatus =
  | "pending_confirmation"
  | "confirmed"
  | "processing"
  | "success"
  | "failed"
  | "cancelled";

export type PaymentMethod = "airtel_money" | "tnm_mpamba" | "bank" | "card" | "other";

export type DestinationType = "airtel_money" | "tnm_mpamba";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  pin_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  tx_ref: string;
  amount: number;
  currency: "MWK";
  status: TransactionStatus;
  depositor_id: string | null;
  depositor_name: string;
  payment_method: PaymentMethod | null;
  paychangu_data: Record<string, unknown> | null;
  receipt_url: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  currency: "MWK";
  destination_type: DestinationType;
  phone_number: string;
  status: WithdrawalStatus;
  initiated_by: string;
  confirmation_code: string | null;
  code_expires_at: string | null;
  paychangu_ref: string | null;
  paychangu_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  emoji: string | null;
  created_by: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: "deposit" | "withdrawal" | "goal" | "system" | "security";
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSettings {
  id: string;
  logo_url: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  app_name: string;
  updated_at: string;
}
