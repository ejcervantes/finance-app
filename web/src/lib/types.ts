export type TransactionType = "income" | "expense";
export type ExpenseNature = "fixed" | "variable" | "discretionary";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  country: string;
  base_currency: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  is_system: boolean;
  name: string;
  icon: string | null;
  color: string | null;
  is_archived: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  expense_nature: ExpenseNature | null;
  description: string | null;
  transaction_date: string;
  account_id: string | null;
  category_id: string;
  notes: string | null;
  source: string;
  nature_source: string | null;
  receipt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionList {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface TransactionCreate {
  type: TransactionType;
  amount: string;
  currency?: string | null;
  expense_nature?: ExpenseNature | null;
  description?: string | null;
  transaction_date: string;
  category_id: string;
  account_id?: string | null;
  receipt_id?: string | null;
}

export interface Summary {
  period: { from: string; to: string };
  total_income: string;
  total_expense: string;
  balance: string;
  savings_rate: number | null;
}

export interface CategoryReportItem {
  category_id: string;
  category_name: string;
  total: string;
  count: number;
}

export const NATURE_LABELS: Record<ExpenseNature, string> = {
  fixed: "Fijo",
  variable: "Variable",
  discretionary: "Prescindible",
};
