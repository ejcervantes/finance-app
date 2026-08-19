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
  type: TransactionType;
  default_nature: ExpenseNature | null;
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

export type BudgetPeriod = "weekly" | "monthly" | "yearly";

export const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: string;
  period: BudgetPeriod;
  start_date: string;
  created_at: string;
}

export interface BudgetCreate {
  category_id: string;
  amount: string;
  period: BudgetPeriod;
  start_date: string;
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

export interface TrendItem {
  month: string; // "YYYY-MM"
  income: string;
  expense: string;
  balance: string;
  cumulative: string;
}

export interface NatureReportItem {
  nature: string; // "fixed" | "variable" | "discretionary" | "unclassified"
  total: string;
  count: number;
}

export interface BudgetStatusItem {
  budget_id: string;
  category_id: string;
  category_name: string | null;
  period: string;
  window: { from: string; to: string };
  budget: string;
  spent: string;
  remaining: string;
  percent_used: number | null;
}

export const NATURE_LABELS: Record<ExpenseNature, string> = {
  fixed: "Fijo",
  variable: "Variable",
  discretionary: "Prescindible",
};

export const NATURE_LABELS_EXT: Record<string, string> = {
  fixed: "Fijo",
  variable: "Variable",
  discretionary: "Prescindible",
  unclassified: "Sin clasificar",
};
