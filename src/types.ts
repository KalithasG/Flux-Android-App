export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  note?: string;
  paymentMethod?: 'UPI' | 'Card' | 'Cash' | string;
  createdAt: string;
  authorUid: string;
}

export interface Budget {
  id: string;
  month: string; // YYYY-MM
  category: string;
  amount: number;
  authorUid: string;
  createdAt: string;
}

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  hex: string;
  type: 'income' | 'expense';
  authorUid: string;
  createdAt: string;
}

export interface AppState {
  transactions: Transaction[];
  budgets: Budget[];
  categories: CustomCategory[];
}
