import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Currency {
  code: string;
  symbol: string;
  locale: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', locale: 'en-US', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', locale: 'ar-AE', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', locale: 'ar-SA', name: 'Saudi Riyal' },
  { code: 'CHF', symbol: 'CHF', locale: 'de-CH', name: 'Swiss Franc' },
  { code: 'MYR', symbol: 'RM', locale: 'ms-MY', name: 'Malaysian Ringgit' },
  { code: 'LKR', symbol: 'Rs', locale: 'si-LK', name: 'Sri Lankan Rupee' },
  { code: 'BDT', symbol: '৳', locale: 'bn-BD', name: 'Bangladeshi Taka' },
];

// Active currency is module-level so formatCurrency's ~58 call sites don't
// need a prop/context; it is set from the user's profile before renders
// (store.ts users-doc snapshot) and changing it triggers a state update there.
let activeCurrency: Currency = CURRENCIES[0];

export const setActiveCurrency = (code: string | undefined) => {
  activeCurrency = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
};

export const getActiveCurrency = (): Currency => activeCurrency;

export const currencySymbol = (): string => activeCurrency.symbol;

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat(activeCurrency.locale, {
    style: 'currency',
    currency: activeCurrency.code,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getCurrentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const formatMonth = (monthStr: string, format: 'short' | 'long' = 'long') => {
  const [year, month] = monthStr.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleString('default', { month: format, year: 'numeric' });
};

export const getCurrentDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Consecutive days (ending today) where the day's expenses stayed within the
 * daily budget — the month's total budget spread evenly over its days.
 * Days with no spending count as under budget; months without any budget
 * don't break the streak. Returns 0 until the user has both a budget and at
 * least one transaction, and never counts days before the first transaction.
 */
export const computeUnderBudgetStreak = (
  transactions: { date: string; type: string; amount: number }[],
  budgets: { month: string; amount: number }[],
  today: Date = new Date()
): number => {
  if (!budgets.length || !transactions.length) return 0;

  const dailyExpenses = new Map<string, number>();
  let firstDate = '9999-12-31';
  for (const t of transactions) {
    if (t.date < firstDate) firstDate = t.date;
    if (t.type !== 'expense') continue;
    dailyExpenses.set(t.date, (dailyExpenses.get(t.date) || 0) + t.amount);
  }

  const monthlyBudget = new Map<string, number>();
  for (const b of budgets) {
    monthlyBudget.set(b.month, (monthlyBudget.get(b.month) || 0) + b.amount);
  }

  let streak = 0;
  const cursor = new Date(today);
  for (let i = 0; i < 365; i++) {
    const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const day = `${month}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (day < firstDate) break;
    const budget = monthlyBudget.get(month);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const dailyBudget = budget !== undefined ? budget / daysInMonth : Infinity;
    if ((dailyExpenses.get(day) || 0) > dailyBudget) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const CATEGORIES = [
  { id: 'Food', name: 'Food', icon: '🍔', color: 'bg-orange-100 text-orange-700', hex: '#FBBC04', type: 'expense' },
  { id: 'Transport', name: 'Transport', icon: '🚌', color: 'bg-blue-100 text-blue-700', hex: '#4285F4', type: 'expense' },
  { id: 'Health', name: 'Health', icon: '💊', color: 'bg-red-100 text-red-700', hex: '#EA4335', type: 'expense' },
  { id: 'Entertainment', name: 'Entertainment', icon: '🎬', color: 'bg-purple-100 text-purple-700', hex: '#A142F4', type: 'expense' },
  { id: 'Shopping', name: 'Shopping', icon: '🛍️', color: 'bg-pink-100 text-pink-700', hex: '#F439A0', type: 'expense' },
  { id: 'Utilities', name: 'Utilities', icon: '💡', color: 'bg-yellow-100 text-yellow-700', hex: '#FFD600', type: 'expense' },
  { id: 'Education', name: 'Education', icon: '📚', color: 'bg-green-100 text-green-700', hex: '#34A853', type: 'expense' },
  { id: 'Rent', name: 'Rent', icon: '🏠', color: 'bg-teal-100 text-teal-700', hex: '#14B8A6', type: 'expense' },
  { id: 'SIP', name: 'SIP', icon: '📈', color: 'bg-cyan-100 text-cyan-700', hex: '#06B6D4', type: 'expense' },
  { id: 'Electricity', name: 'Electricity', icon: '⚡', color: 'bg-yellow-100 text-yellow-700', hex: '#EAB308', type: 'expense' },
  { id: 'Grocery', name: 'Grocery', icon: '🛒', color: 'bg-lime-100 text-lime-700', hex: '#84CC16', type: 'expense' },
  { id: 'Vegetables', name: 'Vegetables', icon: '🥕', color: 'bg-green-100 text-green-700', hex: '#22C55E', type: 'expense' },
  { id: 'Fruits', name: 'Fruits', icon: '🍎', color: 'bg-red-100 text-red-700', hex: '#EF4444', type: 'expense' },
  { id: 'Debt Given', name: 'Debt Given', icon: '💸', color: 'bg-rose-100 text-rose-700', hex: '#F43F5E', type: 'expense' },
  { id: 'EMI', name: 'EMI', icon: '💳', color: 'bg-slate-100 text-slate-700', hex: '#64748B', type: 'expense' },
  { id: 'RD', name: 'RD', icon: '🔄', color: 'bg-sky-100 text-sky-700', hex: '#0EA5E9', type: 'expense' },
  { id: 'FD', name: 'FD', icon: '🏦', color: 'bg-amber-100 text-amber-700', hex: '#F59E0B', type: 'expense' },
  { id: 'Savings', name: 'Savings', icon: '🐷', color: 'bg-fuchsia-100 text-fuchsia-700', hex: '#D946EF', type: 'expense' },
  { id: 'Emergency fund', name: 'Emergency fund', icon: '🚨', color: 'bg-red-100 text-red-700', hex: '#DC2626', type: 'expense' },
  { id: 'Trading', name: 'Trading', icon: '📊', color: 'bg-violet-100 text-violet-700', hex: '#8B5CF6', type: 'expense' },
  { id: 'Housing Loan', name: 'Housing Loan', icon: '🏠', color: 'bg-rose-100 text-rose-700', hex: '#E11D48', type: 'expense' },
  { id: 'Personal Loan', name: 'Personal Loan', icon: '🏦', color: 'bg-red-100 text-red-700', hex: '#DC2626', type: 'expense' },
  { id: 'Fashion', name: 'Fashion', icon: '👗', color: 'bg-pink-100 text-pink-700', hex: '#DB2777', type: 'expense' },
  { id: 'Gold', name: 'Gold', icon: '📀', color: 'bg-yellow-100 text-yellow-700', hex: '#EAB308', type: 'expense' },
  { id: 'Bonds', name: 'Bonds', icon: '📜', color: 'bg-blue-100 text-blue-700', hex: '#2563EB', type: 'expense' },
  { id: 'Beauty parlour/Haircut', name: 'Beauty parlour/Haircut', icon: '💇', color: 'bg-purple-100 text-purple-700', hex: '#9333EA', type: 'expense' },
  { id: 'Wedding Gifts', name: 'Wedding Gifts', icon: '🎁', color: 'bg-rose-100 text-rose-700', hex: '#E11D48', type: 'expense' },
  { id: 'Festival', name: 'Festival', icon: '🎆', color: 'bg-orange-100 text-orange-700', hex: '#EA580C', type: 'expense' },
  { id: 'Other', name: 'Other', icon: '📦', color: 'bg-gray-100 text-gray-700', hex: '#70757A', type: 'expense' },
  
  { id: 'Salary', name: 'Salary', icon: '💰', color: 'bg-emerald-100 text-emerald-700', hex: '#10B981', type: 'income' },
  { id: 'Freelance', name: 'Freelance', icon: '💻', color: 'bg-indigo-100 text-indigo-700', hex: '#6366F1', type: 'income' },
  { id: 'Investment', name: 'Investment', icon: '📈', color: 'bg-cyan-100 text-cyan-700', hex: '#06B6D4', type: 'income' },
  { id: 'Interest', name: 'Interest', icon: '🏦', color: 'bg-blue-100 text-blue-700', hex: '#3B82F6', type: 'income' },
  { id: 'Debt Received', name: 'Debt Received', icon: '🤝', color: 'bg-emerald-100 text-emerald-700', hex: '#10B981', type: 'income' },
];
