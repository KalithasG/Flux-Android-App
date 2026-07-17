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

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  savingsCategoryIds?: string[];
  savingsPlan?: Record<string, Record<string, number>>;
  currency?: string; // ISO 4217 code, defaults to INR
  whatsappNumber?: string; // E.164 digits, mirrored by the WhatsApp bot backend
}

export interface AppState {
  transactions: Transaction[];
  budgets: Budget[];
  categories: CustomCategory[];
}
