import React, { useState, useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share as CapacitorShare } from '@capacitor/share';
import { runBackHandlers } from './lib/backButton';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  ReceiptText, 
  Wallet, 
  BarChart3, 
  Sparkles,
  Plus,
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  X,
  Edit3,
  Calendar,
  TrendingDown,
  FileText,
  Download,
  AlertTriangle,
  AlertCircle,
  Edit2,
  Check,
  PiggyBank,
  PieChart as PieChartIcon,
  Share,
  Bot
} from 'lucide-react';
import { useFluxData, handleFirestoreError, OperationType } from './store';
import { cn, formatCurrency, CATEGORIES, getCurrentMonth, formatMonth, getCurrentDate, computeUnderBudgetStreak } from './lib/utils';
import { GoogleGenAI } from "@google/genai";
import { AIAnalyzer } from './components/AIAnalyzer';
import { CustomCategory } from './types';
import { AIChatModal } from './components/AIChatModal';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  CartesianGrid,
  Label
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { FluxLogo } from './components/FluxLogo';
import { SloganAnimation } from './components/SloganAnimation';

// --- Components ---

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMsg = this.state.error?.message || 'An unknown error occurred';
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed.error) errorMsg = parsed.error;
      } catch (e) {}

      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-error-container text-on-error-container rounded-full flex items-center justify-center mb-4">
            <X size={32} />
          </div>
          <h1 className="text-2xl font-medium text-on-surface mb-2">Something went wrong</h1>
          <p className="text-on-surface-variant mb-6 max-w-sm">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Logo = () => (
  <div className="flex items-center gap-3">
    <FluxLogo className="w-10 h-10 drop-shadow-sm" />
    <div className="flex flex-col">
      <h1 className="text-lg font-medium text-on-surface leading-none tracking-tight">Flux</h1>
      <SloganAnimation />
    </div>
  </div>
);

const InteractiveDonutChart = ({ 
  data, 
  totalValue, 
  innerRadius = 75, 
  outerRadius = 95, 
  centerLabel = "Total",
  dataKey = "value",
  nameKey = "name",
  centerFontSize
}: { 
  data: any[], 
  totalValue: number, 
  innerRadius?: number, 
  outerRadius?: number,
  centerLabel?: string,
  dataKey?: string,
  nameKey?: string,
  centerFontSize?: string
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieClick = (_: any, index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const activeItem = activeIndex !== null ? data[activeIndex] : null;
  
  // Dynamic font size based on innerRadius if not provided
  const fontSize = centerFontSize || (innerRadius < 40 ? '11px' : innerRadius < 60 ? '14px' : '18px');
  const labelFontSize = innerRadius < 40 ? '8px' : innerRadius < 60 ? '10px' : '12px';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={3}
          dataKey={dataKey}
          nameKey={nameKey}
          stroke="none"
          onClick={onPieClick}
          style={{ cursor: 'pointer', outline: 'none' }}
          animationBegin={0}
          animationDuration={800}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.hex || entry.color || '#8884d8'} 
              style={{ 
                filter: activeIndex === index ? 'brightness(1.1) saturate(1.2)' : 'none',
                transition: 'all 0.3s ease',
                outline: 'none'
              }}
            />
          ))}
          <Label
            content={({ viewBox }) => {
              const { cx, cy } = viewBox as any;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                  <tspan
                    x={cx}
                    y={cy - (innerRadius < 40 ? 5 : innerRadius < 60 ? 7 : 10)}
                    style={{
                      fontSize: labelFontSize,
                      fill: '#444746',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: '500'
                    }}
                  >
                    {activeItem ? activeItem[nameKey] : centerLabel}
                  </tspan>
                  <tspan
                    x={cx}
                    y={cy + (innerRadius < 40 ? 7 : innerRadius < 60 ? 9 : 12)}
                    style={{
                      fontSize: fontSize,
                      fontWeight: '700',
                      fill: '#1A1C1E',
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    {formatCurrency(activeItem ? activeItem[dataKey] : totalValue)}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ 
            borderRadius: '16px', 
            border: '1px solid #C4C7C5', 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            fontSize: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

const ScreenHeader = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
  return (
    <header className="flex justify-between items-center px-4 h-16 bg-surface sticky top-0 z-40 border-b border-outline-variant/30">
      <Logo />
      <div className="flex items-center gap-3">
        <button onClick={onOpenSettings} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant font-bold overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
          {auth.currentUser?.photoURL ? (
            <img src={auth.currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary text-on-primary flex items-center justify-center text-xs">
              {auth.currentUser?.displayName?.charAt(0) || 'U'}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'expenses', label: 'Transactions', icon: ReceiptText },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'budget', label: 'Budget', icon: Wallet },
    { id: 'compare', label: 'Analytics', icon: BarChart3 },
    { id: 'report', label: 'Report', icon: FileText },
  ];

  return (
    <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 bg-surface-container/95 backdrop-blur-xl h-[80px] pb-safe flex justify-around items-center z-50 px-1 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] border-t border-outline-variant/10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center flex-1 min-w-0 h-full gap-1 group relative transition-all duration-200"
          >
            <div className="relative flex items-center justify-center w-12 h-8 mb-1">
              <AnimatePresence mode="wait">
                {isActive && (
                  <motion.div 
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-secondary-container rounded-full z-0"
                    initial={{ scaleX: 0.5, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    exit={{ scaleX: 0.5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </AnimatePresence>
              <motion.div
                animate={{ 
                  scale: isActive ? 1.1 : 1,
                }}
                className="relative z-10"
              >
                <Icon 
                  size={22} 
                  strokeWidth={isActive ? 2.5 : 1.5} 
                  className={cn(
                    "transition-all duration-300",
                    isActive ? "text-on-secondary-container" : "text-on-surface-variant group-hover:text-on-surface"
                  )} 
                />
              </motion.div>
            </div>
            <span className={cn(
              "text-[10px] font-medium tracking-tight transition-colors duration-300 truncate w-full px-0.5 text-center",
              isActive ? "text-on-surface font-bold" : "text-on-surface-variant"
            )}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

// --- Constants ---

const SAVINGS_COLORS = [
  '#059669', // Emerald 600
  '#0891b2', // Cyan 600
  '#2563eb', // Blue 600
  '#4f46e5', // Indigo 600
  '#7c3aed', // Violet 600
  '#0d9488', // Teal 600
  '#16a34a', // Green 600
  '#0284c7', // Sky 600
  '#0369a1', // Sky 700
  '#0e7490', // Cyan 700
];

// --- Screens ---

const SavingsPortfolioCard = ({ 
  totalSavings, 
  overallSavings, 
  savingsByCategory, 
  overallSavingsByCategory, 
  allCategories,
  isMounted 
}: { 
  totalSavings: number, 
  overallSavings: number, 
  savingsByCategory: any[], 
  overallSavingsByCategory: any[],
  allCategories: any[],
  isMounted: boolean
}) => {
  const uniqueCategoryIds = Array.from(new Set([
    ...savingsByCategory.filter(c => c.amount > 0).map(c => c.id),
    ...overallSavingsByCategory.map(c => c.id)
  ]));

  if (totalSavings <= 0 && overallSavings <= 0) return null;

  const categoryColorMap = uniqueCategoryIds.reduce((acc, id, index) => {
    acc[id] = SAVINGS_COLORS[index % SAVINGS_COLORS.length];
    return acc;
  }, {} as { [key: string]: string });

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Savings Portfolio</h3>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium">
          <Sparkles size={12} />
          <span>Optimized</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Monthly Savings Chart */}
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-medium text-on-surface-variant uppercase mb-4">Monthly</p>
          <div className="w-full h-[140px] relative min-w-0">
            {isMounted && totalSavings > 0 ? (
              <InteractiveDonutChart 
                data={savingsByCategory.filter(c => c.amount > 0).map(c => ({ ...c, hex: categoryColorMap[c.id] }))} 
                totalValue={totalSavings} 
                innerRadius={35} 
                outerRadius={50} 
                dataKey="amount"
                centerLabel="Monthly"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[10px] text-on-surface-variant">No data</p>
              </div>
            )}
          </div>
        </div>

        {/* Overall Savings Chart */}
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-medium text-on-surface-variant uppercase mb-4">Overall</p>
          <div className="w-full h-[140px] relative min-w-0">
            {isMounted && overallSavings > 0 ? (
              <InteractiveDonutChart 
                data={overallSavingsByCategory.map(c => ({ ...c, hex: categoryColorMap[c.id] }))} 
                totalValue={overallSavings} 
                innerRadius={35} 
                outerRadius={50} 
                dataKey="amount"
                centerLabel="Overall"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[10px] text-on-surface-variant">No data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="mt-8 space-y-2.5">
        <div className="grid grid-cols-3 gap-2 px-2 border-b border-outline-variant/30 pb-1.5 mb-2">
          <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wider">Allocation</span>
          <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wider text-right">Monthly</span>
          <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wider text-right">Overall</span>
        </div>
        {uniqueCategoryIds.map(id => {
          const cat = allCategories.find(c => c.id === id);
          const monthlyCat = savingsByCategory.find(c => c.id === id);
          const overallCat = overallSavingsByCategory.find(c => c.id === id);
          const monthlyPercent = totalSavings > 0 ? ((monthlyCat?.amount || 0) / totalSavings * 100).toFixed(0) : '0';
          const overallPercent = overallSavings > 0 ? ((overallCat?.amount || 0) / overallSavings * 100).toFixed(0) : '0';
          
          return (
            <div key={id} className="grid grid-cols-3 gap-2 px-2 items-center">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColorMap[id] }} />
                <span className="text-[11px] font-medium text-on-surface truncate">{cat?.name}</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 text-right">{monthlyPercent}%</span>
              <span className="text-[11px] font-semibold text-teal-600 text-right">{overallPercent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ExpenseInsightsCardProps {
  pieData: any[];
  paymentModeData: any[];
  totalExpenses: number;
  allCategories: any[];
  isMounted: boolean;
}

const ExpenseInsightsCard = ({ 
  pieData, 
  paymentModeData, 
  totalExpenses, 
  allCategories,
  isMounted 
}: ExpenseInsightsCardProps) => {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Expense Insights</h3>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
          <PieChartIcon size={12} />
          <span>Analysis</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Category Breakdown Chart */}
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-4">Categories</p>
          <div className="w-full h-[140px] relative min-w-0">
            {isMounted && totalExpenses > 0 ? (
              <InteractiveDonutChart 
                data={pieData} 
                totalValue={totalExpenses} 
                innerRadius={35} 
                outerRadius={50} 
                centerLabel="Spent"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[10px] text-on-surface-variant">No data</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Modes Chart */}
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-4">Modes</p>
          <div className="w-full h-[140px] relative min-w-0">
            {isMounted && totalExpenses > 0 ? (
              <InteractiveDonutChart 
                data={paymentModeData} 
                totalValue={totalExpenses} 
                innerRadius={35} 
                outerRadius={50} 
                centerLabel="Modes"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[10px] text-on-surface-variant">No data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Lists */}
      <div className="space-y-8">
        {/* Categories List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2 border-b border-outline-variant/30 pb-2 mb-4">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Category Breakdown</p>
            <span className="text-[10px] font-medium text-on-surface-variant">{pieData.length} Categories</span>
          </div>
          <div className="space-y-2">
            {pieData.sort((a, b) => b.value - a.value).map((d) => {
              const percentage = totalExpenses > 0 ? ((d.value / totalExpenses) * 100).toFixed(1) : 0;
              const cat = allCategories.find(c => c.id === d.id);
              return (
                <div key={d.id} className="flex items-center justify-between p-2 hover:bg-surface-container-low rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: `${d.hex}20`, color: d.hex }}>
                      {cat?.icon || '📦'}
                    </div>
                    <span className="text-sm font-medium text-on-surface">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-on-surface">{formatCurrency(d.value)}</span>
                    <span className="text-[10px] font-medium text-on-surface-variant w-12 text-right bg-surface-container px-1.5 py-0.5 rounded-md">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Modes List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2 border-b border-outline-variant/30 pb-2 mb-4">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Payment Mode Analysis</p>
            <span className="text-[10px] font-medium text-on-surface-variant">{paymentModeData.length} Modes</span>
          </div>
          <div className="space-y-2">
            {paymentModeData.sort((a, b) => b.value - a.value).map((d) => {
              const percentage = totalExpenses > 0 ? ((d.value / totalExpenses) * 100).toFixed(1) : 0;
              return (
                <div key={d.id} className="flex items-center justify-between p-2 hover:bg-surface-container-low rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: `${d.hex}20`, color: d.hex }}>
                      <Wallet size={14} />
                    </div>
                    <span className="text-sm font-medium text-on-surface">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-on-surface">{formatCurrency(d.value)}</span>
                    <span className="text-[10px] font-medium text-on-surface-variant w-12 text-right bg-surface-container px-1.5 py-0.5 rounded-md">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ data, onNavigateToAdd, onNavigateToTransactions, userProfile, selectedMonth, onMonthChange }: { data: any, onNavigateToAdd?: () => void, onNavigateToTransactions?: () => void, userProfile?: any, selectedMonth: string, onMonthChange: (m: string) => void }) => {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  // The month is shared app-wide (lifted to MainApp); the year view is
  // Dashboard-only, so the selected year stays local.
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const selectedPeriod = viewMode === 'year' ? selectedYear : selectedMonth; // YYYY-MM or YYYY
  const setSelectedPeriod = (period: string) => {
    if (viewMode === 'year') setSelectedYear(period);
    else onMonthChange(period);
  };
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentYear = selectedPeriod.slice(0, 4);
  const isYearView = viewMode === 'year';

  const filteredTransactions = data.transactions.filter((t: any) => 
    isYearView ? t.date.startsWith(currentYear) : t.date.startsWith(selectedPeriod)
  );
  
  const totalIncome = filteredTransactions
    .filter((t: any) => t.type === 'income')
    .reduce((sum: number, t: any) => sum + t.amount, 0);
    
  const totalExpenses = filteredTransactions
    .filter((t: any) => t.type === 'expense')
    .reduce((sum: number, t: any) => sum + t.amount, 0);
    
  const balance = totalIncome - totalExpenses;
  
  const budgets = data.budgets.filter((b: any) => 
    isYearView ? b.month.startsWith(currentYear) : b.month === selectedPeriod
  );
  const totalBudget = budgets.reduce((sum: number, b: any) => sum + b.amount, 0);
  
  const streak = computeUnderBudgetStreak(data.transactions, data.budgets);

  const allCategories = Array.from(new Map([...CATEGORIES, ...(data.categories || [])].map(c => [c.id, c])).values());

  const categoryTotals: Record<string, number> = {};
  filteredTransactions
    .filter((t: any) => t.type === 'expense')
    .forEach((t: any) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

  const pieData = Object.entries(categoryTotals).map(([catId, amount]) => {
    const cat = allCategories.find(c => c.id === catId);
    return { 
      id: catId,
      name: cat?.name || catId, 
      value: amount, 
      hex: cat?.hex || '#70757A' 
    };
  }).filter(d => d.value > 0);

  const paymentModeTotals: Record<string, number> = {};
  filteredTransactions
    .filter((t: any) => t.type === 'expense')
    .forEach((t: any) => {
      const mode = t.paymentMethod || 'Other';
      paymentModeTotals[mode] = (paymentModeTotals[mode] || 0) + t.amount;
    });

  const paymentModeColors: Record<string, string> = {
    'Cash': '#10B981',
    'Card': '#3B82F6',
    'UPI': '#8B5CF6',
    'Net Banking': '#F59E0B',
    'Other': '#6B7280'
  };

  const paymentModeData = Object.entries(paymentModeTotals).map(([mode, amount]) => ({
    id: mode,
    name: mode,
    value: amount,
    hex: paymentModeColors[mode] || paymentModeColors['Other']
  })).sort((a, b) => b.value - a.value);

  const trendData = filteredTransactions
    .filter((t: any) => t.type === 'expense')
    .reduce((acc: any[], t: any) => {
      const dateKey = isYearView ? t.date.slice(0, 7) : t.date;
      const existing = acc.find(d => d.date === dateKey);
      if (existing) {
        existing.amount += t.amount;
      } else {
        acc.push({ date: dateKey, amount: t.amount });
      }
      return acc;
    }, []).sort((a, b) => a.date.localeCompare(b.date));

  // Fill in missing dates for trend data
  let finalTrendData = trendData;
  if (isYearView) {
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `${currentYear}-${m}`;
    });
    finalTrendData = months.map(m => {
      const existing = trendData.find(d => d.date === m);
      return existing || { date: m, amount: 0 };
    });
  } else {
    // Pad days for month view
    let year = parseInt(selectedPeriod.slice(0, 4));
    let month = parseInt(selectedPeriod.slice(5, 7));
    let daysInMonth = new Date(year, month, 0).getDate();
    
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = (i + 1).toString().padStart(2, '0');
      return `${selectedPeriod}-${d}`;
    });
    finalTrendData = days.map(d => {
      const existing = trendData.find(data => data.date === d);
      return existing || { date: d, amount: 0 };
    });
  }

  const handlePrevPeriod = () => {
    if (isYearView) {
      setSelectedPeriod((parseInt(currentYear) - 1).toString());
    } else {
      let year = parseInt(selectedPeriod.slice(0, 4));
      let month = parseInt(selectedPeriod.slice(5, 7));
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      setSelectedPeriod(`${year}-${month.toString().padStart(2, '0')}`);
    }
  };

  const handleNextPeriod = () => {
    if (isYearView) {
      setSelectedPeriod((parseInt(currentYear) + 1).toString());
    } else {
      let year = parseInt(selectedPeriod.slice(0, 4));
      let month = parseInt(selectedPeriod.slice(5, 7));
      month += 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
      setSelectedPeriod(`${year}-${month.toString().padStart(2, '0')}`);
    }
  };

  const savingsCategoryIds = userProfile?.savingsCategoryIds || [];
  const totalSavings = filteredTransactions
    .filter((t: any) => savingsCategoryIds.includes(t.category))
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const overallSavings = data.transactions
    .filter((t: any) => savingsCategoryIds.includes(t.category))
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const savingsByCategory = savingsCategoryIds.map(id => {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return null;
    const amount = filteredTransactions
      .filter((t: any) => t.category === id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    return { ...cat, amount };
  }).filter((c): c is any => c !== null && c.amount > 0);

  const overallSavingsByCategory = savingsCategoryIds.map(id => {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return null;
    const amount = data.transactions
      .filter((t: any) => t.category === id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    return { ...cat, amount };
  }).filter((c): c is any => c !== null && c.amount > 0);

  const formattedPeriod = isYearView 
    ? currentYear 
    : formatMonth(selectedPeriod, 'long');

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="px-4 pt-6 pb-4">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-on-surface">Dashboard</h1>
            <p className="text-xs text-on-surface-variant mt-1">Overview of your finances</p>
          </div>
        </div>
        <div className="flex items-center justify-between mb-4 bg-surface-container-low p-2 rounded-full border border-outline-variant/30">
          <button onClick={handlePrevPeriod} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <span className="font-medium text-sm text-on-surface cursor-pointer">{formattedPeriod}</span>
              {isYearView ? (
                <input 
                  type="number" 
                  value={currentYear}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              ) : (
                <input 
                  type="month" 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              )}
            </div>
            <div className="flex bg-surface-container rounded-full p-0.5 ml-2">
              <button 
                onClick={() => setViewMode('month')}
                className={cn("px-2 py-1 text-[10px] font-medium rounded-full transition-colors", !isYearView ? "bg-primary text-on-primary" : "text-on-surface-variant")}
              >
                M
              </button>
              <button 
                onClick={() => { setViewMode('year'); setSelectedYear(new Date().getFullYear().toString()); }}
                className={cn("px-2 py-1 text-[10px] font-medium rounded-full transition-colors", isYearView ? "bg-primary text-on-primary" : "text-on-surface-variant")}
              >
                Y
              </button>
            </div>
          </div>
          <button onClick={handleNextPeriod} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <div className="relative">
          <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-on-primary rounded-[32px] p-6 pb-14 shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-20 -mb-20 blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-widest opacity-80 mb-1">Total Balance</p>
                  <h2 className="text-4xl font-semibold tracking-tight drop-shadow-sm">{formatCurrency(balance)}</h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg">
                    <Wallet size={24} className="text-white" />
                  </div>
                  <div className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-[9px] font-medium uppercase tracking-widest">
                    {isYearView ? currentYear : formatMonth(selectedPeriod, 'short')}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-5 border-t border-white/20">
                {/* Income Section */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                    <ArrowUpRight size={18} className="text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-medium opacity-60 leading-none mb-1">Income</p>
                    <p className="text-sm font-semibold leading-none">{formatCurrency(totalIncome)}</p>
                  </div>
                </div>

                {/* Spacer for Floating Button */}
                <div className="w-12 shrink-0" />

                {/* Expense Section */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                    <ArrowDownRight size={18} className="text-rose-300" />
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-[9px] uppercase tracking-widest font-medium opacity-60 leading-none mb-1">Expenses</p>
                    <p className="text-sm font-semibold leading-none">{formatCurrency(totalExpenses)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Plus Button - Perfectly Centered and Heroic */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-30">
            <div className="relative group">
              {/* Enhanced glow effect */}
              <div className="absolute inset-0 rounded-full bg-white/50 blur-xl scale-125 group-hover:scale-150 transition-transform duration-700" />
              
              <button 
                onClick={onNavigateToAdd}
                className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_15px_35px_rgba(0,0,0,0.2),0_0_0_5px_rgba(255,255,255,0.3)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.25),0_0_0_8px_rgba(255,255,255,0.4)] hover:scale-110 active:scale-90 transition-all duration-500 border border-slate-50"
                aria-label="Add Transaction"
              >
                {/* Inner gradient for depth */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white via-white to-slate-100" />
                
                <Plus 
                  size={32} 
                  strokeWidth={3} 
                  className="text-primary relative z-10 group-hover:rotate-90 transition-transform duration-500 ease-in-out" 
                />
              </button>
            </div>
          </div>
        </div>
        
        <div className="h-4" />
      </section>

      <section className="px-4 space-y-4">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-medium text-on-surface">Spending Trend</h3>
            <span className="text-xs font-medium text-primary bg-primary-container px-3 py-1 rounded-full">{formattedPeriod}</span>
          </div>
          <div className="w-full h-[180px] min-w-0">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
              {isYearView ? (
                <BarChart data={finalTrendData}>
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => {
                    const [year, month] = val.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return date.toLocaleString('default', { month: 'short' });
                  }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid #C4C7C5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => formatMonth(label, 'long')}
                  />
                  <Bar dataKey="amount" fill="#0B57D0" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={finalTrendData}>
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.split('-')[2]} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid #C4C7C5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#0B57D0" strokeWidth={3} dot={{ fill: '#0B57D0', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

        {/* Beautiful Savings Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-[32px] p-6 shadow-xl shadow-emerald-900/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-8 -mb-8 blur-xl" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider mb-1">{isYearView ? 'Yearly' : 'Monthly'} Savings</p>
                <h2 className="text-3xl font-bold tracking-tight">{formatCurrency(totalSavings)}</h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider mb-1">Overall Savings</p>
                <h2 className="text-xl font-bold tracking-tight opacity-90">{formatCurrency(overallSavings)}</h2>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <PiggyBank size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Period</p>
                  <p className="text-sm font-semibold truncate">{formattedPeriod}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Status</p>
                  <p className="text-sm font-semibold">On Track</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <SavingsPortfolioCard 
            totalSavings={totalSavings}
            overallSavings={overallSavings}
            savingsByCategory={savingsByCategory}
            overallSavingsByCategory={overallSavingsByCategory}
            allCategories={allCategories}
            isMounted={isMounted}
          />

          <ExpenseInsightsCard 
            pieData={pieData}
            paymentModeData={paymentModeData}
            totalExpenses={totalExpenses}
            allCategories={allCategories}
            isMounted={isMounted}
          />

          {streak > 0 && (
            <div className="bg-gradient-to-r from-tertiary-container to-tertiary-container/80 text-on-tertiary-container rounded-[24px] p-5 flex flex-col justify-center gap-2 shadow-sm border border-tertiary/20">
              <div className="flex items-center gap-2">
                <div className="text-2xl bg-white/50 p-1.5 rounded-xl shadow-sm">🔥</div>
                <h4 className="font-semibold text-base">Active Streak</h4>
              </div>
              <p className="text-sm font-medium opacity-90 mt-1">You've stayed under budget for <span className="font-bold text-tertiary">{streak} {streak === 1 ? 'day' : 'days'}</span>!</p>
              {/* progress toward a 30-day milestone */}
              <div className="h-2 bg-on-tertiary-container/10 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-tertiary rounded-full transition-all" style={{ width: `${Math.min(streak / 30, 1) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-lg text-on-surface">Recent Activity</h3>
          <button onClick={onNavigateToTransactions} className="text-primary text-sm font-medium hover:bg-primary/10 px-4 py-1.5 rounded-full transition-colors">See All</button>
        </div>
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 bg-surface-container-lowest rounded-[24px] border border-outline-variant/30">
              <p className="text-on-surface-variant text-sm">No transactions for this period.</p>
            </div>
          ) : (
            filteredTransactions.slice(0, 5).map((t: any) => {
              const category = allCategories.find(c => c.id === t.category);
              return (
                <div key={t.id} className="flex items-center gap-4 p-4 bg-surface-container-lowest border border-outline-variant/30 rounded-[20px] hover:shadow-md hover:border-outline-variant/50 transition-all cursor-pointer">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm", category?.color || 'bg-surface-container')}>
                    {category?.icon || '📦'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-base text-on-surface">{t.title}</p>
                    <p className="text-xs text-on-surface-variant mt-1 font-medium">
                      {t.date} • {category?.name || t.category} {t.paymentMethod && `• ${t.paymentMethod}`}
                    </p>
                  </div>
                  <p className={cn("font-bold text-base", t.type === 'income' ? 'text-emerald-600' : 'text-on-surface')}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

const TransactionList = ({ data, onDelete, onAdd, onUpdate, showAdd: externalShowAdd, setShowAdd: externalSetShowAdd, customCategories }: { data: any, onDelete: (id: string) => void, onAdd: (e: any) => void, onUpdate: (id: string, e: any) => void, showAdd?: boolean, setShowAdd?: (val: boolean) => void, customCategories: CustomCategory[] }) => {
  const [search, setSearch] = useState('');
  const [internalShowAdd, setInternalShowAdd] = useState(false);
  const [viewTransaction, setViewTransaction] = useState<any | null>(null);
  const [editTransactionId, setEditTransactionId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'delete' | 'edit' } | null>(null);
  
  const showAdd = externalShowAdd !== undefined ? externalShowAdd : internalShowAdd;
  const setShowAdd = externalSetShowAdd || setInternalShowAdd;

  const [newTransaction, setNewTransaction] = useState({ 
    title: '', 
    amount: '', 
    category: 'Food', 
    date: getCurrentDate(),
    paymentMethod: 'UPI',
    note: '',
    type: 'expense' as 'income' | 'expense'
  });

  const allCategories = Array.from(new Map([...CATEGORIES, ...customCategories].map(c => [c.id, c])).values());
  const availableCategories = allCategories.filter(c => c.type === newTransaction.type);

  // Ensure selected category is valid for the current type
  if (!availableCategories.find(c => c.id === newTransaction.category) && availableCategories.length > 0) {
    setNewTransaction(prev => ({ ...prev, category: availableCategories[0].id }));
  }

  // Calculate running balance
  const sortedForBalance = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
  let currentBalance = 0;
  const balanceMap = new Map();
  sortedForBalance.forEach(t => {
    if (t.type === 'income') currentBalance += t.amount;
    else currentBalance -= t.amount;
    balanceMap.set(t.id, currentBalance);
  });

  const filteredTransactions = data.transactions
    .filter((t: any) => {
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                           t.category.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  const handleAdd = () => {
    if (!newTransaction.title || !newTransaction.amount) return;
    
    if (editTransactionId) {
      onUpdate(editTransactionId, {
        ...newTransaction,
        amount: parseFloat(newTransaction.amount)
      });
      setToast({ 
        message: `${newTransaction.type === 'income' ? 'Income' : 'Expense'} changes added successfully`, 
        type: 'edit' 
      });
    } else {
      onAdd({
        ...newTransaction,
        amount: parseFloat(newTransaction.amount)
      });
      setToast({ 
        message: `${newTransaction.type === 'income' ? 'Income' : 'Expense'} added successfully`, 
        type: 'success' 
      });
    }
    
    setNewTransaction({ title: '', amount: '', category: 'Food', date: getCurrentDate(), paymentMethod: 'UPI', note: '', type: 'expense' });
    setEditTransactionId(null);
    setShowAdd(false);

    setTimeout(() => setToast(null), 3000);
  };

  const handleEditClick = (transaction: any) => {
    setNewTransaction({
      title: transaction.title,
      amount: transaction.amount.toString(),
      category: transaction.category,
      date: transaction.date,
      paymentMethod: transaction.paymentMethod || 'UPI',
      note: transaction.note || '',
      type: transaction.type || 'expense'
    });
    setEditTransactionId(transaction.id);
    setViewTransaction(null);
    setShowAdd(true);
  };

  const handleCloseAdd = () => {
    setShowAdd(false);
    setEditTransactionId(null);
    setNewTransaction({ title: '', amount: '', category: 'Food', date: getCurrentDate(), paymentMethod: 'UPI', note: '', type: 'expense' });
  };

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-surface-container-low min-h-screen">
      
      <div className="px-4 pt-6 pb-12 space-y-6 bg-surface-container-low">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-on-surface">Transactions</h1>
            <p className="text-xs text-on-surface-variant mt-1">Manage your income and expenses</p>
          </div>
          <button 
            onClick={() => setShowAdd(true)}
            className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {(['all', 'income', 'expense'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap capitalize",
                filterType === type 
                  ? "bg-primary-container border-primary text-on-primary-container" 
                  : "bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-container"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input 
            type="text" 
            placeholder="Search transactions..."
            className="w-full bg-surface border-none rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary outline-none text-sm font-medium transition-all shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-surface rounded-t-[32px] px-4 pt-6 pb-6 min-h-[60vh] shadow-[0_-8px_20px_rgba(0,0,0,0.04)] relative z-10 -mt-6">
        <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-6" />
        
        {/* Table-like Header for Desktop/Tablet */}
        <div className="hidden sm:grid grid-cols-5 gap-4 px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-on-surface-variant border-b border-outline-variant/30 mb-2">
          <span>Date</span>
          <span>Description</span>
          <span className="text-right">Income</span>
          <span className="text-right">Expense</span>
          <span className="text-right">Balance</span>
        </div>

        <div className="space-y-3">
          {filteredTransactions.map((t: any) => {
            const category = allCategories.find(c => c.id === t.category);
            const balanceAtTime = balanceMap.get(t.id);
            
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={t.id} 
                onClick={() => setViewTransaction(t)}
                className="flex flex-col sm:grid sm:grid-cols-5 items-start sm:items-center gap-2 sm:gap-4 p-3.5 bg-surface-container-lowest border border-outline-variant/30 rounded-[20px] group relative overflow-hidden hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                {/* Mobile View */}
                <div className="flex items-center gap-4 w-full sm:contents">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl sm:hidden", category?.color)}>
                    {category?.icon}
                  </div>
                  
                  <div className="hidden sm:block text-xs text-on-surface-variant font-medium">
                    {t.date}
                  </div>

                  <div className="flex-1 sm:flex-none">
                    <p className="font-medium text-base sm:text-sm text-on-surface">{t.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 sm:hidden">
                      {t.date} • {category?.name}
                    </p>
                    <p className="hidden sm:block text-[10px] text-on-surface-variant">
                      {category?.name} {t.paymentMethod && `• ${t.paymentMethod}`}
                    </p>
                  </div>

                  <div className="text-right sm:block hidden">
                    <p className={cn("font-medium text-sm", t.type === 'income' ? 'text-green-600' : 'text-transparent')}>
                      {t.type === 'income' ? formatCurrency(t.amount) : '-'}
                    </p>
                  </div>

                  <div className="text-right sm:block hidden">
                    <p className={cn("font-medium text-sm", t.type === 'expense' ? 'text-red-600' : 'text-transparent')}>
                      {t.type === 'expense' ? formatCurrency(t.amount) : '-'}
                    </p>
                  </div>

                  <div className="text-right sm:block hidden">
                    <p className="font-medium text-sm text-on-surface">
                      {formatCurrency(balanceAtTime)}
                    </p>
                  </div>

                  {/* Mobile Amount & Balance */}
                  <div className="flex flex-col items-end gap-1 sm:hidden">
                    <p className={cn("font-medium text-base", t.type === 'income' ? 'text-green-600' : 'text-on-surface')}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                    <p className="text-[10px] text-on-surface-variant font-medium">
                      Bal: {formatCurrency(balanceAtTime)}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {filteredTransactions.length === 0 && (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant opacity-40">
                <ReceiptText size={32} />
              </div>
              <p className="text-sm text-on-surface-variant">No transactions found</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseAdd}
              className="fixed inset-0 bg-scrim/40 z-[60] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="app-keyboard-avoid fixed bottom-0 left-0 right-0 bg-surface-container-lowest rounded-t-[32px] p-6 pb-12 z-[60] shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-6" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-medium tracking-tight">{editTransactionId ? 'Edit Transaction' : 'Add Transaction'}</h2>
                <button onClick={handleCloseAdd} className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="flex p-1 bg-surface-container rounded-2xl mb-2">
                  {(['expense', 'income'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setNewTransaction(prev => ({ ...prev, type }));
                        // When type changes, we need to update the category to a valid one
                        const newAvailableCategories = allCategories.filter(c => c.type === type);
                        if (newAvailableCategories.length > 0) {
                          setNewTransaction(prev => ({ ...prev, type, category: newAvailableCategories[0].id }));
                        } else {
                          setNewTransaction(prev => ({ ...prev, type }));
                        }
                      }}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize",
                        newTransaction.type === type 
                          ? "bg-surface text-primary shadow-sm" 
                          : "text-on-surface-variant hover:text-on-surface"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="text-center space-y-2 mb-2">
                  <label className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">Amount (INR)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full bg-transparent text-center text-4xl font-medium outline-none text-on-surface placeholder:text-outline-variant"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant ml-1">Title</label>
                  <input 
                    type="text" 
                    placeholder="What was this for?"
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-2xl p-3.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium transition-all"
                    value={newTransaction.title}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-on-surface-variant ml-1">Category</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-surface-container-low border border-outline-variant/50 rounded-2xl p-3.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none font-medium transition-all"
                        value={newTransaction.category}
                        onChange={(e) => setNewTransaction(prev => ({ ...prev, category: e.target.value }))}
                      >
                        {availableCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-on-surface-variant ml-1">Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-2xl p-3.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium transition-all"
                      value={newTransaction.date}
                      onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant ml-1">Payment Method</label>
                  <div className="flex gap-2">
                    {['UPI', 'Card', 'Cash'].map(method => (
                      <button
                        key={method}
                        onClick={() => setNewTransaction(prev => ({ ...prev, paymentMethod: method }))}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border",
                          newTransaction.paymentMethod === method 
                            ? "bg-primary-container text-on-primary-container border-primary-container" 
                            : "bg-surface-container-lowest border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low"
                        )}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant ml-1">Notes (Optional)</label>
                  <textarea 
                    placeholder="Add details..."
                    rows={2}
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-2xl p-3.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium transition-all resize-none"
                    value={newTransaction.note}
                    onChange={(e) => setNewTransaction(prev => ({ ...prev, note: e.target.value }))}
                  />
                </div>

                <button 
                  onClick={handleAdd}
                  disabled={!newTransaction.title || !newTransaction.amount}
                  className="w-full py-4 rounded-full bg-primary text-on-primary font-medium text-base hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm mt-2"
                >
                  {editTransactionId ? 'Save Changes' : 'Save Transaction'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewTransaction && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewTransaction(null)}
              className="fixed inset-0 bg-scrim/40 z-[60] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest rounded-t-[32px] p-6 pb-12 z-[60] shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-6" />
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-3xl", allCategories.find(c => c.id === viewTransaction.category)?.color)}>
                    {allCategories.find(c => c.id === viewTransaction.category)?.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-medium tracking-tight">{viewTransaction.title}</h2>
                    <p className="text-sm text-on-surface-variant mt-0.5">{viewTransaction.date} • {allCategories.find(c => c.id === viewTransaction.category)?.name}</p>
                  </div>
                </div>
                <button onClick={() => setViewTransaction(null)} className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-surface-container-low rounded-[24px] p-5 mb-6">
                <p className="text-sm font-medium text-on-surface-variant mb-1">Amount</p>
                <p className={cn("text-4xl font-medium tracking-tight mb-4", viewTransaction.type === 'income' ? 'text-green-600' : 'text-on-surface')}>
                  {viewTransaction.type === 'income' ? '+' : '-'}{formatCurrency(viewTransaction.amount)}
                </p>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 pt-4 border-t border-outline-variant/30">
                  <div>
                    <p className="text-xs font-medium text-on-surface-variant mb-1">Type</p>
                    <p className="text-sm font-medium text-on-surface capitalize">{viewTransaction.type}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-on-surface-variant mb-1">Payment Method</p>
                    <p className="text-sm font-medium text-on-surface">{viewTransaction.paymentMethod || 'UPI'}</p>
                  </div>
                </div>
              </div>

              {viewTransaction.note && (
                <div className="bg-surface-container-low rounded-[24px] p-5 mb-6">
                  <p className="text-xs font-medium text-on-surface-variant mb-1">Note</p>
                  <p className="text-sm text-on-surface">{viewTransaction.note}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    onDelete(viewTransaction.id);
                    setViewTransaction(null);
                    setToast({ message: 'Deleted successfully', type: 'delete' });
                    setTimeout(() => setToast(null), 3000);
                  }}
                  className="flex-1 py-4 rounded-full border border-outline-variant text-error font-medium hover:bg-error/5 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={20} />
                  Delete
                </button>
                <button 
                  onClick={() => handleEditClick(viewTransaction)}
                  className="flex-1 py-4 rounded-full bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 size={20} />
                  Edit
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-4 right-4 z-[100] flex justify-center pointer-events-none"
          >
            <div className={cn(
              "px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 pointer-events-auto border",
              toast.type === 'delete' ? "bg-error-container border-error/20 text-on-error-container" : "bg-surface-container-highest border-outline-variant/30 text-on-surface"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                toast.type === 'delete' ? "bg-error text-on-error" : "bg-primary text-on-primary"
              )}>
                {toast.type === 'delete' ? <Trash2 size={16} /> : <Check size={16} />}
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BudgetScreen = ({ data, onUpdateBudget, onDeleteBudget, customCategories, onAddCategory, selectedMonth, onMonthChange: setSelectedMonth }: { data: any, onUpdateBudget: (m: string, c: string, a: number) => void, onDeleteBudget: (id: string) => void, customCategories: CustomCategory[], onAddCategory: (cat: any) => Promise<string | undefined>, selectedMonth: string, onMonthChange: (m: string) => void }) => {
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const allCategories = Array.from(new Map([...CATEGORIES, ...customCategories].map(c => [c.id, c])).values());
  const expenseCategories = allCategories.filter(c => c.type === 'expense');

  const budgets = data.budgets.filter((b: any) => b.month === selectedMonth);
  // Filter budgets to only include those that have a valid category or are 'expected_salary'
  const validBudgets = budgets.filter((b: any) => 
    allCategories.some(c => c.id === b.category)
  );

  const expenses = data.transactions.filter((t: any) => t.type === 'expense' && t.date.startsWith(selectedMonth));

  const incomes = data.transactions.filter((t: any) => t.type === 'income' && t.date.startsWith(selectedMonth));
  const expectedIncome = incomes.reduce((sum: number, t: any) => sum + t.amount, 0);
  const expenseBudgets = validBudgets.filter((b: any) => b.category !== 'expected_salary');

  const totalBudget = expenseBudgets.reduce((sum: number, b: any) => sum + b.amount, 0);
  const totalSpent = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

  const isOverBudget = expectedIncome > 0 && totalBudget > expectedIncome;
  const remainingToBudget = Math.max(0, expectedIncome - totalBudget);

  const categoryBudgets: Record<string, number> = {};
  expenseBudgets.forEach((b: any) => {
    categoryBudgets[b.category] = (categoryBudgets[b.category] || 0) + b.amount;
  });

  const pieData = Object.entries(categoryBudgets).map(([categoryId, amount]) => {
    const cat = expenseCategories.find(c => c.id === categoryId);
    return {
      id: categoryId,
      name: cat ? cat.name : categoryId,
      value: amount,
      hex: cat ? cat.hex : '#94a3b8'
    };
  }).filter((d: any) => d.value > 0);

  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState(expenseCategories[0]?.id || '');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'delete' | 'edit' } | null>(null);

  const handleSaveEdit = (categoryId: string) => {
    onUpdateBudget(selectedMonth, categoryId, parseFloat(editAmount) || 0);
    setEditingBudget(null);
    setToast({ message: 'Budget updated successfully', type: 'edit' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSavingCategory(true);
    try {
      const newId = await onAddCategory({
        name: newCatName.trim(),
        icon: newCatIcon,
        color: 'bg-gray-100 text-gray-700',
        hex: '#70757A',
        type: 'expense'
      });
      if (newId) {
        setNewBudgetCategory(newId);
        setToast({ message: 'Category created successfully', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }
      setIsCreatingCategory(false);
      setNewCatName('');
      setNewCatIcon('📦');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleAddBudget = () => {
    const categoryToSave = newBudgetCategory && newBudgetCategory !== 'create_new'
      ? newBudgetCategory 
      : availableCategoriesForNewBudget[0]?.id;

    if (categoryToSave && newBudgetAmount) {
      onUpdateBudget(selectedMonth, categoryToSave, parseFloat(newBudgetAmount) || 0);
      setIsAddingBudget(false);
      setNewBudgetAmount('');
      setNewBudgetCategory('');
      setToast({ message: 'Budget created successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteBudget = (categoryId: string) => {
    const budget = budgets.find((b: any) => b.category === categoryId);
    if (budget) {
      onDeleteBudget(budget.id);
      setToast({ message: 'Budget deleted successfully', type: 'delete' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Filter out categories that already have a budget for the dropdown
  const availableCategoriesForNewBudget = expenseCategories.filter(
    cat => !expenseBudgets.some((b: any) => b.category === cat.id)
  );

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-4 pt-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-on-surface">Budget Planning</h1>
            <p className="text-xs text-on-surface-variant mt-1">Manage your monthly budget</p>
          </div>
          <div className="relative flex items-center gap-2 bg-surface-container-low border border-outline-variant/50 px-3 py-1.5 rounded-full text-[10px] font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
            <Calendar size={12} /> 
            <span>{formatMonth(selectedMonth, 'short')}</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-4">
        {/* Expected Income Card - Redesigned for compactness and beauty */}
        <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-on-primary rounded-[32px] p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-12 -mb-12 blur-3xl" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-lg shrink-0">
                <ArrowUpRight size={24} className="text-emerald-300" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest opacity-80 mb-1">Total Income</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-3xl font-semibold text-white">{formatCurrency(expectedIncome)}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-widest opacity-60 mb-1">Remaining</p>
              <p className="text-sm font-semibold">{formatCurrency(remainingToBudget)}</p>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <AnimatePresence>
          {isOverBudget && (
            <motion.div 
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="bg-error-container text-on-error-container p-4 rounded-[20px] flex items-start gap-3 shadow-sm"
            >
              <AlertTriangle size={20} className="shrink-0 mt-0.5 text-error" />
              <div>
                <p className="text-sm font-semibold text-error">Budget Exceeds Income</p>
                <p className="text-xs opacity-90 mt-0.5">You are setting budget more than your income. Please adjust your allocations.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Cards - Refined styling with remaining amounts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 size={14} className="text-primary" />
              </div>
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">Budgeted</p>
            </div>
            <p className="text-xl font-semibold text-on-surface tracking-tight">{formatCurrency(totalBudget)}</p>
            <div className="mt-3 h-1 bg-surface-container rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: expectedIncome > 0 ? `${Math.min(100, (totalBudget / expectedIncome) * 100)}%` : '0%' }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <p className="text-[10px] mt-3 font-medium text-on-surface-variant opacity-70">
              {expectedIncome > 0 ? `${formatCurrency(remainingToBudget)} left to allocate` : 'Set income first'}
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-tertiary/10 flex items-center justify-center">
                <ReceiptText size={14} className="text-tertiary" />
              </div>
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">Spent</p>
            </div>
            <p className="text-xl font-semibold text-on-surface tracking-tight">{formatCurrency(totalSpent)}</p>
            <div className="mt-3 h-1 bg-surface-container rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: totalBudget > 0 ? `${Math.min(100, (totalSpent / totalBudget) * 100)}%` : '0%' }}
                className="h-full bg-tertiary rounded-full"
              />
            </div>
            <p className="text-[10px] mt-3 font-medium text-on-surface-variant opacity-70">
              {formatCurrency(Math.max(0, totalBudget - totalSpent))} remaining
            </p>
          </div>
        </div>

        {/* Budget Allocation Chart - Full detailed list below donut */}
        {pieData.length > 0 && (
          <div className="bg-surface-container-lowest rounded-[28px] p-6 shadow-sm border border-outline-variant/30 mt-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Budget Allocation</h3>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                <PieChartIcon size={12} />
                <span>Distribution</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center mb-8">
              <div className="w-full h-56 relative min-w-0">
                {isMounted && (
                  <InteractiveDonutChart 
                    data={pieData} 
                    totalValue={totalBudget} 
                    innerRadius={60} 
                    outerRadius={85} 
                    centerLabel="Budget"
                  />
                )}
              </div>
            </div>

            {/* Detailed Category List */}
            <div className="space-y-3 pt-4 border-t border-outline-variant/30">
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest px-1 mb-4">Category Breakdown</p>
              <div className="space-y-2">
                {[...pieData].sort((a: any, b: any) => b.value - a.value).map((entry: any) => {
                  const cat = expenseCategories.find(c => c.id === entry.id);
                  return (
                    <div key={entry.id} className="flex items-center justify-between p-2 hover:bg-surface-container-low rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: `${entry.hex}20`, color: entry.hex }}>
                          {cat?.icon || '📦'}
                        </div>
                        <span className="text-sm font-medium text-on-surface">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-on-surface">{formatCurrency(entry.value)}</span>
                        <span className="text-[10px] font-medium text-on-surface-variant w-12 text-right bg-surface-container px-1.5 py-0.5 rounded-md">
                          {totalBudget > 0 ? ((entry.value / totalBudget) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 px-4 mt-8">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-medium text-base text-on-surface">Allocate Budget</h3>
          {!isAddingBudget && (
            <button 
              onClick={() => {
                setNewBudgetCategory(availableCategoriesForNewBudget[0]?.id || 'create_new');
                setIsAddingBudget(true);
                setIsCreatingCategory(availableCategoriesForNewBudget.length === 0);
              }}
              className="text-primary text-sm font-medium flex items-center gap-1"
            >
              <Plus size={16} /> Add
            </button>
          )}
        </div>

        <AnimatePresence>
          {isAddingBudget && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-surface-container-lowest border border-outline-variant/50 rounded-[24px] p-4 shadow-sm"
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant ml-1">Category</label>
                  {isCreatingCategory ? (
                    <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/30 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-on-surface">New Category</h4>
                        <button onClick={() => setIsCreatingCategory(false)} className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-16">
                          <label className="text-[10px] font-medium text-on-surface-variant ml-1">Icon</label>
                          <input 
                            type="text" 
                            value={newCatIcon}
                            onChange={(e) => setNewCatIcon(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg p-2 text-center text-lg outline-none focus:border-primary"
                            placeholder="📦"
                            maxLength={10}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-medium text-on-surface-variant ml-1">Name</label>
                          <input 
                            type="text" 
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-lg p-2 text-sm outline-none focus:border-primary"
                            placeholder="e.g. Subscriptions"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handleCreateCategory}
                        disabled={!newCatName.trim() || isSavingCategory}
                        className="w-full py-2 bg-primary text-on-primary rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        {isSavingCategory ? 'Saving...' : 'Save Category'}
                      </button>
                    </div>
                  ) : (
                    <select 
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl p-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none font-medium text-sm"
                      value={newBudgetCategory}
                      onChange={(e) => {
                        if (e.target.value === 'create_new') {
                          setIsCreatingCategory(true);
                        } else {
                          setNewBudgetCategory(e.target.value);
                        }
                      }}
                    >
                      {availableCategoriesForNewBudget.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      <option value="create_new">+ Create New Category</option>
                    </select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant ml-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-medium">₹</span>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl py-3 pl-8 pr-3 font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm"
                      value={newBudgetAmount}
                      placeholder="0"
                      onChange={(e) => setNewBudgetAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setIsAddingBudget(false);
                      setIsCreatingCategory(false);
                      setNewCatName('');
                      setNewCatIcon('📦');
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-outline-variant/50 text-on-surface-variant font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddBudget}
                    disabled={!newBudgetCategory || !newBudgetAmount || isCreatingCategory}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Budget
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {Object.entries(categoryBudgets).map(([categoryId, amount]) => {
            const cat = expenseCategories.find(c => c.id === categoryId);
            if (!cat) return null;
            
            const spent = expenses.filter((e: any) => e.category === cat.id).reduce((sum: number, e: any) => sum + e.amount, 0);
            const percent = amount > 0 ? (spent / amount) * 100 : 0;
            const isEditingThis = editingBudget === cat.id;

            return (
              <div key={categoryId} className="p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] hover:bg-surface-container-low transition-all shadow-sm group">
                <div className="flex items-center gap-4 mb-5">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner", cat.color)}>
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-on-surface">{cat.name}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium uppercase tracking-wider opacity-60">
                          {formatCurrency(spent)} of {formatCurrency(amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5">
                            <div className="relative w-20">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-[10px] font-medium">₹</span>
                              <input 
                                type="number" 
                                min="0"
                                step="0.01"
                                className="w-full bg-surface-container-low border border-primary rounded-lg py-1 pl-4 pr-1 text-right font-medium outline-none text-xs text-on-surface"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <button disabled={!editAmount} onClick={() => handleSaveEdit(cat.id)} className="p-1.5 bg-primary text-on-primary rounded-lg disabled:opacity-50 transition-colors">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingBudget(null)} className="p-1.5 bg-surface-container-high text-on-surface-variant rounded-lg">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => {
                                setEditingBudget(cat.id);
                                setEditAmount(amount.toString());
                              }} 
                              className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteBudget(cat.id)} 
                              className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-end px-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        percent > 100 ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
                      )}>
                        {Math.round(percent)}%
                      </span>
                      <span className="text-[10px] font-medium text-on-surface-variant opacity-60 uppercase tracking-widest">Utilized</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-medium text-on-surface-variant opacity-60 uppercase tracking-widest leading-none mb-1">Remaining</p>
                      <p className={cn("text-xs font-semibold leading-none", amount - spent < 0 ? "text-error" : "text-emerald-600")}>
                        {formatCurrency(Math.max(0, amount - spent))}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, percent)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        percent > 100 ? "bg-error shadow-[0_0_8px_rgba(239,68,68,0.4)]" : percent > 80 ? "bg-budget-watch" : "bg-primary shadow-[0_0_8px_rgba(11,87,208,0.3)]"
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {expenseBudgets.length === 0 && !isAddingBudget && (
            <div className="text-center py-8 text-on-surface-variant">
              <p className="text-sm font-medium">No budgets set for this month.</p>
              <button 
                onClick={() => {
                  setNewBudgetCategory(availableCategoriesForNewBudget[0]?.id || 'create_new');
                  setIsAddingBudget(true);
                  setIsCreatingCategory(availableCategoriesForNewBudget.length === 0);
                }}
                className="mt-2 text-primary text-sm font-medium"
              >
                Create your first budget
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-4 right-4 z-[100] flex justify-center pointer-events-none"
          >
            <div className={cn(
              "px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 pointer-events-auto border",
              toast.type === 'delete' ? "bg-error-container border-error/20 text-on-error-container" : "bg-surface-container-highest border-outline-variant/30 text-on-surface"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                toast.type === 'delete' ? "bg-error text-on-error" : "bg-primary text-on-primary"
              )}>
                {toast.type === 'delete' ? <Trash2 size={16} /> : <Check size={16} />}
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SavingsScreen = ({ data, userProfile, onUpdateSavingsCategories, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onUpdateSavingsPlan, onUpdateYearlySavingsPlan, onUpdateFullSavingsPlan, selectedMonth, onMonthChange: setSelectedMonth }: {
  data: any,
  userProfile: any,
  onUpdateSavingsCategories: (ids: string[]) => void,
  onAddTransaction: (t: any) => void,
  onUpdateTransaction: (id: string, t: any) => void,
  onDeleteTransaction: (id: string) => void,
  onUpdateSavingsPlan: (month: string, categoryId: string, amount: number) => void,
  onUpdateYearlySavingsPlan: (year: string, categoryId: string, amount: number) => void,
  onUpdateFullSavingsPlan: (fullPlan: any) => void,
  selectedMonth: string,
  onMonthChange: (m: string) => void
}) => {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'delete' | 'edit' } | null>(null);

  // Savings Plan State
  const [planMonth, setPlanMonth] = useState(selectedMonth);
  const [planAmounts, setPlanAmounts] = useState<{ [month: string]: { [categoryId: string]: string } }>({});
  const [applyToYear, setApplyToYear] = useState(false);

  // Historical Savings Form State
  const [histAmount, setHistAmount] = useState('');
  const [histCategory, setHistCategory] = useState('');
  const [histDate, setHistDate] = useState(getCurrentMonth());
  const [histTitle, setHistTitle] = useState('Historical Savings');
  const [histNote, setHistNote] = useState('');

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize planAmounts from userProfile when modal opens
  React.useEffect(() => {
    if (isPlanModalOpen && userProfile?.savingsPlan) {
      const initialPlan: { [month: string]: { [categoryId: string]: string } } = {};
      Object.entries(userProfile.savingsPlan).forEach(([month, monthPlan]: [string, any]) => {
        initialPlan[month] = {};
        Object.entries(monthPlan).forEach(([id, amount]) => {
          initialPlan[month][id] = amount.toString();
        });
      });
      setPlanAmounts(initialPlan);
      setPlanMonth(selectedMonth);
    }
  }, [isPlanModalOpen, userProfile, selectedMonth]);

  const savingsCategoryIds = userProfile?.savingsCategoryIds || [];
  const allCategories = Array.from(new Map([...CATEGORIES, ...(data.categories || [])].map(c => [c.id, c])).values());
  const savingsCategories = allCategories.filter(c => savingsCategoryIds.includes(c.id));
  
  const allSavingsTransactions = data.transactions
    .filter((t: any) => savingsCategoryIds.includes(t.category))
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredTransactions = data.transactions.filter((t: any) => t.date.startsWith(selectedMonth));
  
  const totalSavings = filteredTransactions
    .filter((t: any) => savingsCategoryIds.includes(t.category))
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const overallSavings = data.transactions
    .filter((t: any) => savingsCategoryIds.includes(t.category))
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const savingsByCategory = savingsCategoryIds.map(id => {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return null;
    const amount = filteredTransactions
      .filter((t: any) => t.category === id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    return { ...cat, amount };
  }).filter((c): c is any => c !== null && (c.amount > 0 || savingsCategoryIds.includes(c.id)));

  const overallSavingsByCategory = savingsCategoryIds.map(id => {
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return null;
    const amount = data.transactions
      .filter((t: any) => t.category === id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    return { ...cat, amount };
  }).filter((c): c is any => c !== null && c.amount > 0);

  const handlePrevMonth = () => {
    let year = parseInt(selectedMonth.slice(0, 4));
    let month = parseInt(selectedMonth.slice(5, 7));
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    let year = parseInt(selectedMonth.slice(0, 4));
    let month = parseInt(selectedMonth.slice(5, 7));
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const toggleCategory = (id: string) => {
    const newIds = savingsCategoryIds.includes(id)
      ? savingsCategoryIds.filter((cid: string) => cid !== id)
      : [...savingsCategoryIds, id];
    onUpdateSavingsCategories(newIds);
  };

  const handleAddHistorical = () => {
    if (!histAmount || !histCategory || !histDate) return;
    
    const categoryDetails = savingsCategories.find(c => c.id === histCategory);
    
    const transactionData = {
      title: histTitle || 'Historical Savings',
      amount: parseFloat(histAmount),
      type: categoryDetails?.type || 'expense', 
      category: histCategory,
      date: histDate.length === 7 ? `${histDate}-01` : histDate, // Ensure full date
      note: histNote || 'Added as historical savings data'
    };

    if (editingTransaction) {
      onUpdateTransaction(editingTransaction.id, transactionData);
    } else {
      onAddTransaction(transactionData);
    }

    closeHistoricalModal();
  };

  const closeHistoricalModal = () => {
    setIsHistoricalModalOpen(false);
    setEditingTransaction(null);
    setHistAmount('');
    setHistTitle('Historical Savings');
    setHistCategory('');
    setHistDate(getCurrentMonth());
    setHistNote('');
  };

  const handleEditClick = (t: any) => {
    setEditingTransaction(t);
    setHistAmount(t.amount.toString());
    setHistTitle(t.title);
    setHistCategory(t.category);
    setHistDate(t.date.slice(0, 7)); // Use month for the picker
    setHistNote(t.note || '');
    setIsHistoricalModalOpen(true);
  };

  const handleSavePlan = () => {
    const fullPlan = { ...(userProfile?.savingsPlan || {}) };
    
    Object.entries(planAmounts).forEach(([month, monthPlan]) => {
      const numericMonthPlan: { [key: string]: number } = {};
      Object.entries(monthPlan).forEach(([id, amount]) => {
        numericMonthPlan[id] = parseFloat(amount) || 0;
      });
      fullPlan[month] = { ...(fullPlan[month] || {}), ...numericMonthPlan };
    });

    if (applyToYear) {
      const year = planMonth.slice(0, 4);
      const currentMonthPlan = planAmounts[planMonth] || {};
      const numericMonthPlan: { [key: string]: number } = {};
      Object.entries(currentMonthPlan).forEach(([id, amount]) => {
        numericMonthPlan[id] = parseFloat(amount) || 0;
      });

      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${m.toString().padStart(2, '0')}`;
        fullPlan[month] = { ...(fullPlan[month] || {}), ...numericMonthPlan };
      }
    }

    onUpdateFullSavingsPlan(fullPlan);
    setIsPlanModalOpen(false);
    setToast({ message: 'Savings plan saved successfully', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const currentYear = selectedMonth.slice(0, 4);
  const savingsPlan = userProfile?.savingsPlan?.[selectedMonth] || {};
  const totalMonthlyPlan = Object.entries(savingsPlan)
    .filter(([catId]) => savingsCategoryIds.includes(catId) && allCategories.some(c => c.id === catId))
    .reduce((sum: number, [_, val]: [string, any]) => sum + (Number(val) || 0), 0);
  
  // Calculate yearly plan by summing all months in currentYear, filtered by current savings categories
  const yearlyPlanData = userProfile?.savingsPlan || {};
  const totalYearlyPlan = Object.entries(yearlyPlanData)
    .filter(([month]) => month.length === 7 && month.startsWith(currentYear))
    .reduce((yearSum, [_, monthPlan]: [string, any]) => {
      const monthSum = Object.entries(monthPlan)
        .filter(([catId]) => savingsCategoryIds.includes(catId) && allCategories.some(c => c.id === catId))
        .reduce((mSum: number, [_, val]: [string, any]) => mSum + (Number(val) || 0), 0);
      return yearSum + monthSum;
    }, 0);

  const monthlyActualSavings = totalSavings;
  const monthlyProgress = totalMonthlyPlan > 0 ? (monthlyActualSavings / totalMonthlyPlan) * 100 : 0;

  const yearlyActualSavings = data.transactions
    .filter((t: any) => t.date.startsWith(currentYear) && savingsCategoryIds.includes(t.category))
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const yearlyProgress = totalYearlyPlan > 0 ? (yearlyActualSavings / totalYearlyPlan) * 100 : 0;

  const yearlyCategoryData = savingsCategories.map(cat => {
    const actual = data.transactions
      .filter((t: any) => t.date.startsWith(currentYear) && t.category === cat.id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const plan = Object.entries(yearlyPlanData)
      .filter(([month]) => month.length === 7 && month.startsWith(currentYear))
      .reduce((sum, [_, monthPlan]: [string, any]) => sum + (Number(monthPlan[cat.id]) || 0), 0);
    return { ...cat, actual, plan };
  });

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-4 pt-6 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-on-surface">Savings</h1>
            <p className="text-xs text-on-surface-variant mt-1">Track your investments & goals</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsHistoricalModalOpen(true)}
              className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold hover:bg-emerald-200 transition-colors"
            >
              Add Past Data
            </button>
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="p-2.5 bg-surface-container-high text-primary rounded-full hover:bg-primary hover:text-on-primary transition-all"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-surface-container-low p-2 rounded-full border border-outline-variant/30 mb-4">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <ChevronLeft size={20} />
          </button>
          <div className="relative flex items-center">
            <span className="font-medium text-sm text-on-surface">{formatMonth(selectedMonth, 'long')}</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Prominent Savings Plan CTA */}
        <button 
          onClick={() => setIsPlanModalOpen(true)}
          className="w-full mb-6 p-5 bg-surface-container-high text-on-surface rounded-[32px] border border-outline-variant/30 flex items-center gap-5 hover:bg-primary-container hover:border-primary/20 transition-all group text-left"
        >
          <div className="w-14 h-14 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform">
            <Calendar size={28} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold tracking-tight">Set Savings Targets</h3>
            <p className="text-[11px] text-on-surface-variant">Plan your savings for {formatMonth(selectedMonth, 'long')} or the entire year</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <ChevronRight size={16} />
          </div>
        </button>

        {/* Beautiful Savings Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-[32px] p-8 shadow-xl shadow-emerald-900/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-12 -mb-12 blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-8">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                <PiggyBank size={32} className="text-white" />
              </div>
              <div className="px-4 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-[10px] font-semibold uppercase tracking-wider">
                {formatMonth(selectedMonth, 'short')}
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm font-medium opacity-90 mb-1">Monthly Savings</p>
                <h2 className="text-4xl font-bold tracking-tight">{formatCurrency(totalSavings)}</h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium opacity-80 mb-1">Overall Savings</p>
                <h2 className="text-xl font-bold tracking-tight opacity-90">{formatCurrency(overallSavings)}</h2>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="px-4 space-y-4">
        <SavingsPortfolioCard 
          totalSavings={totalSavings}
          overallSavings={overallSavings}
          savingsByCategory={savingsByCategory}
          overallSavingsByCategory={overallSavingsByCategory}
          allCategories={allCategories}
          isMounted={isMounted}
        />

        {/* Savings Plan Tracking */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-on-surface">Savings Plan {currentYear}</h3>
              <p className="text-xs text-on-surface-variant">Monthly Target: {formatCurrency(totalMonthlyPlan)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Yearly Progress</p>
              <p className="text-sm font-bold text-primary">{yearlyProgress.toFixed(1)}%</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Yearly Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                <span>Actual: {formatCurrency(yearlyActualSavings)}</span>
                <span>Goal: {formatCurrency(totalYearlyPlan)}</span>
              </div>
              <div className="h-3 bg-surface-container rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(yearlyProgress, 100)}%` }}
                  className="h-full bg-primary"
                />
              </div>
            </div>

            {/* Category-wise Plan vs Actual */}
            <div className="space-y-4 pt-4 border-t border-outline-variant/30">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Yearly Category Tracking</h4>
              {yearlyCategoryData.map(cat => {
                const progress = cat.plan > 0 ? (cat.actual / cat.plan) * 100 : 0;
                
                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-xs font-medium text-on-surface">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-on-surface">{formatCurrency(cat.actual)}</span>
                        <span className="text-[10px] text-on-surface-variant ml-1.5">/ {formatCurrency(cat.plan)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        className={cn("h-full", progress >= 100 ? "bg-emerald-500" : "bg-primary/60")}
                      />
                    </div>
                  </div>
                );
              })}
              {savingsCategories.length === 0 && (
                <p className="text-xs text-on-surface-variant text-center py-4">No categories selected for tracking.</p>
              )}
            </div>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Yearly Breakdown</h3>
        
        {yearlyCategoryData.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {yearlyCategoryData.map(cat => (
              <div key={cat.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl", cat.color)}>
                    {cat.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-on-surface">{cat.name}</h4>
                    <p className="text-[10px] text-on-surface-variant font-medium">Yearly Contribution</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-on-surface">{formatCurrency(cat.actual)}</p>
                  <p className="text-[10px] text-emerald-600 font-bold">
                    {yearlyActualSavings > 0 ? ((cat.actual / yearlyActualSavings) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-[32px] p-12 text-center border border-dashed border-outline-variant/50">
            <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center mx-auto mb-4 text-on-surface-variant/30">
              <PiggyBank size={32} />
            </div>
            <p className="text-on-surface font-medium">No savings tracked yet</p>
            <p className="text-xs text-on-surface-variant mt-1 mb-6">Select categories to start tracking your savings</p>
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium shadow-lg shadow-primary/20"
            >
              Select Categories
            </button>
          </div>
        )}

        <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider ml-1 mt-6">Overall Breakdown</h3>
        {overallSavingsByCategory.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {overallSavingsByCategory.map(cat => (
              <div key={cat.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl", cat.color)}>
                    {cat.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-on-surface">{cat.name}</h4>
                    <p className="text-[10px] text-on-surface-variant font-medium">Total Invested</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-on-surface">{formatCurrency(cat.amount)}</p>
                  <p className="text-[10px] text-emerald-600 font-bold">
                    {overallSavings > 0 ? ((cat.amount / overallSavings) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant text-center py-8 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/50">
            No overall savings data available.
          </p>
        )}

        <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider ml-1 mt-8">Savings History</h3>
        <div className="space-y-3 mt-4">
          {allSavingsTransactions.map((t: any) => {
            const cat = allCategories.find(c => c.id === t.category);
            return (
              <div 
                key={t.id} 
                onClick={() => handleEditClick(t)}
                className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xl", cat?.color || 'bg-gray-100')}>
                    {cat?.icon || '📦'}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-on-surface">{t.title}</h4>
                    <p className="text-[10px] text-on-surface-variant">{t.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-emerald-600">+{formatCurrency(t.amount)}</p>
                  <ChevronRight size={16} className="text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
          {allSavingsTransactions.length === 0 && (
            <p className="text-xs text-on-surface-variant text-center py-8 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/50">
              No savings entries yet.
            </p>
          )}
        </div>
      </section>

      {/* Savings Plan Modal */}
      <AnimatePresence>
        {isPlanModalOpen && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-surface-container-lowest rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl max-h-[85vh] overflow-y-auto sm:max-w-md sm:mx-auto sm:w-full"
            >
              <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-surface-container-lowest z-10 py-2">
                <h2 className="text-2xl font-medium tracking-tight">Set Savings Plan</h2>
                <button onClick={() => setIsPlanModalOpen(false)} className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6 space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Select Month</label>
                <div className="flex items-center justify-between bg-surface-container p-2 rounded-2xl border border-outline-variant/30">
                  <button 
                    onClick={() => {
                      let [y, m] = planMonth.split('-').map(Number);
                      m -= 1; if (m === 0) { m = 12; y -= 1; }
                      setPlanMonth(`${y}-${m.toString().padStart(2, '0')}`);
                    }}
                    className="p-2 rounded-xl hover:bg-surface-container-high transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="relative flex items-center">
                    <span className="font-bold text-sm text-on-surface">{formatMonth(planMonth, 'long')}</span>
                    <input 
                      type="month" 
                      value={planMonth}
                      onChange={(e) => setPlanMonth(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      let [y, m] = planMonth.split('-').map(Number);
                      m += 1; if (m === 13) { m = 1; y += 1; }
                      setPlanMonth(`${y}-${m.toString().padStart(2, '0')}`);
                    }}
                    className="p-2 rounded-xl hover:bg-surface-container-high transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-on-surface-variant mb-6">Set your savings target for {formatMonth(planMonth, 'long')}.</p>

              <div className="mb-6 flex items-center gap-3 p-4 bg-surface-container rounded-2xl border border-outline-variant/30 cursor-pointer" onClick={() => setApplyToYear(!applyToYear)}>
                <div className={cn(
                  "w-5 h-5 rounded flex items-center justify-center transition-colors",
                  applyToYear ? "bg-primary text-on-primary" : "border-2 border-outline-variant"
                )}>
                  {applyToYear && <Check size={14} strokeWidth={3} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Apply to entire year</p>
                  <p className="text-[10px] text-on-surface-variant">Set this plan for all 12 months of {planMonth.slice(0, 4)}</p>
                </div>
              </div>

              <div className="space-y-4">
                {savingsCategories.map(cat => (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex items-center gap-2 ml-1">
                      <span className="text-xl">{cat.icon}</span>
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{cat.name}</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium">₹</span>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={planAmounts[planMonth]?.[cat.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPlanAmounts(prev => ({
                            ...prev,
                            [planMonth]: {
                              ...(prev[planMonth] || {}),
                              [cat.id]: val
                            }
                          }));
                        }}
                        className="w-full bg-surface-container border border-outline-variant/50 rounded-2xl pl-8 pr-4 py-4 outline-none focus:border-primary text-lg font-bold"
                      />
                    </div>
                  </div>
                ))}
                
                {savingsCategories.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-on-surface-variant mb-4">You haven't selected any savings categories yet.</p>
                    <button 
                      onClick={() => { setIsPlanModalOpen(false); setIsCategoryModalOpen(true); }}
                      className="text-primary font-bold text-sm"
                    >
                      Select Categories
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleSavePlan}
                  className="w-full py-4 bg-primary text-on-primary rounded-2xl font-bold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all mt-6"
                >
                  Save Yearly Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Historical Savings Modal */}
      <AnimatePresence>
        {isHistoricalModalOpen && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-surface-container-lowest rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl max-h-[85vh] overflow-y-auto sm:max-w-md sm:mx-auto sm:w-full"
            >
              <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-surface-container-lowest z-10 py-2">
                <h2 className="text-2xl font-medium tracking-tight">{editingTransaction ? 'Edit Savings' : 'Add Past Savings'}</h2>
                <button onClick={closeHistoricalModal} className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium">₹</span>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={histAmount}
                      onChange={(e) => setHistAmount(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant/50 rounded-2xl pl-8 pr-4 py-4 outline-none focus:border-primary text-lg font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {savingsCategories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setHistCategory(cat.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                          histCategory === cat.id ? "bg-primary/10 border-primary" : "bg-surface-container border-outline-variant/30"
                        )}
                      >
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-[10px] font-medium truncate w-full text-center">{cat.name}</span>
                      </button>
                    ))}
                    {savingsCategories.length === 0 && (
                      <p className="col-span-3 text-xs text-on-surface-variant text-center py-4">
                        Please select savings categories in settings first.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Month</label>
                    <input 
                      type="month" 
                      value={histDate}
                      onChange={(e) => setHistDate(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant/50 rounded-2xl px-4 py-3 outline-none focus:border-primary text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Initial Savings"
                      value={histTitle}
                      onChange={(e) => setHistTitle(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant/50 rounded-2xl px-4 py-3 outline-none focus:border-primary text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Note (Optional)</label>
                  <textarea 
                    placeholder="Add a note..."
                    value={histNote}
                    onChange={(e) => setHistNote(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/50 rounded-2xl px-4 py-3 outline-none focus:border-primary text-sm min-h-[80px] resize-none"
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  {editingTransaction && (
                    <button 
                      onClick={() => {
                        onDeleteTransaction(editingTransaction.id);
                        closeHistoricalModal();
                      }}
                      className="flex-1 py-4 bg-error-container text-on-error-container rounded-2xl font-bold text-base shadow-lg shadow-error/10 active:scale-[0.98] transition-all"
                    >
                      Delete
                    </button>
                  )}
                  <button 
                    onClick={handleAddHistorical}
                    disabled={!histAmount || !histCategory || !histDate}
                    className={cn(
                      "py-4 bg-primary text-on-primary rounded-2xl font-bold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50",
                      editingTransaction ? "flex-[2]" : "w-full"
                    )}
                  >
                    {editingTransaction ? 'Update Entry' : 'Save Entry'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Selection Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-surface rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-on-surface">Savings Categories</h3>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-sm text-on-surface-variant mb-6">
                  Choose the categories that represent your savings or investments.
                </p>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {allCategories.map(cat => (
                    <label 
                      key={cat.id} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
                        savingsCategoryIds.includes(cat.id) 
                          ? "bg-primary/5 border-primary shadow-sm" 
                          : "bg-surface-container-lowest border-outline-variant/30 hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xl", cat.color)}>
                          {cat.icon}
                        </div>
                        <span className="font-medium text-on-surface">{cat.name}</span>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        savingsCategoryIds.includes(cat.id) 
                          ? "bg-primary border-primary" 
                          : "border-outline-variant"
                      )}>
                        {savingsCategoryIds.includes(cat.id) && <Check size={14} className="text-on-primary" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={savingsCategoryIds.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                    </label>
                  ))}
                </div>
                <button 
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="w-full mt-8 py-4 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-4 right-4 z-[100] flex justify-center pointer-events-none"
          >
            <div className={cn(
              "px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 pointer-events-auto border",
              toast.type === 'delete' ? "bg-error-container border-error/20 text-on-error-container" : "bg-surface-container-highest border-outline-variant/30 text-on-surface"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                toast.type === 'delete' ? "bg-error text-on-error" : "bg-primary text-on-primary"
              )}>
                {toast.type === 'delete' ? <Trash2 size={16} /> : <Check size={16} />}
              </div>
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CompareScreen = ({ data, selectedMonth, onMonthChange: setSelectedMonth }: { data: any, selectedMonth: string, onMonthChange: (m: string) => void }) => {
  const [selectedCategoryForDetails, setSelectedCategoryForDetails] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const handlePrevMonth = () => {
    let year = parseInt(selectedMonth.slice(0, 4));
    let month = parseInt(selectedMonth.slice(5, 7));
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    let year = parseInt(selectedMonth.slice(0, 4));
    let month = parseInt(selectedMonth.slice(5, 7));
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const formattedMonth = formatMonth(selectedMonth, 'long');

  const budgets = data.budgets.filter((b: any) => b.month === selectedMonth);
  const expenses = data.transactions.filter((t: any) => t.type === 'expense' && t.date.startsWith(selectedMonth));
  const incomes = data.transactions.filter((t: any) => t.type === 'income' && t.date.startsWith(selectedMonth));

  const allCategories = Array.from(new Map([...CATEGORIES, ...(data.categories || [])].map(c => [c.id, c])).values());

  // Expense Breakdown
  const expenseCategoryIds = new Set<string>([
    ...budgets.map((b: any) => b.category),
    ...expenses.map((e: any) => e.category)
  ]);

  const compareData = Array.from(expenseCategoryIds)
    .filter(catId => allCategories.some(c => c.id === catId)) // Filter out deleted categories
    .map(catId => {
      const cat = allCategories.find(c => c.id === catId);
      const budget = budgets.find((b: any) => b.category === catId)?.amount || 0;
      
      // Calculate both spent and earned for this category to be safe
      const spent = expenses.filter((e: any) => e.category === catId).reduce((sum: number, e: any) => sum + e.amount, 0);
      const earned = incomes.filter((i: any) => i.category === catId).reduce((sum: number, i: any) => sum + i.amount, 0);
      
      // If it's an income category, 'Actual' is earned, otherwise it's spent
      const actual = cat?.type === 'income' ? earned : spent;

      return {
        id: catId,
        name: cat?.name || catId,
        icon: cat?.icon || '📦',
        color: cat?.color || 'bg-surface-container',
        type: cat?.type || 'expense',
        Budget: budget,
        Actual: actual,
        hex: cat?.hex || '#70757A'
      };
    }).filter(d => d.Budget > 0 || d.Actual > 0);

  const pieData = compareData
    .filter(d => d.type === 'expense')
    .map(d => ({
      id: d.id,
      name: d.name,
      value: d.Actual,
      hex: d.hex
    })).filter(d => d.value > 0);

  // Income Breakdown
  const incomeCategoryIds = new Set<string>(incomes.map((i: any) => i.category));
  const incomeData = Array.from(incomeCategoryIds).map(catId => {
    const cat = allCategories.find(c => c.id === catId);
    const earned = incomes.filter((i: any) => i.category === catId).reduce((sum: number, i: any) => sum + i.amount, 0);
    return {
      id: catId,
      name: cat?.name || catId,
      Earned: earned,
      hex: cat?.hex || '#70757A'
    };
  }).filter(d => d.Earned > 0);

  const baseTrendData = expenses.reduce((acc: any[], expense: any) => {
    const date = expense.date;
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.amount += expense.amount;
    } else {
      acc.push({ date, amount: expense.amount });
    }
    return acc;
  }, []).sort((a, b) => a.date.localeCompare(b.date));

  let year = parseInt(selectedMonth.slice(0, 4));
  let month = parseInt(selectedMonth.slice(5, 7));
  let daysInMonth = new Date(year, month, 0).getDate();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = (i + 1).toString().padStart(2, '0');
    return `${selectedMonth}-${d}`;
  });
  
  const trendData = days.map(d => {
    const existing = baseTrendData.find(data => data.date === d);
    return existing || { date: d, amount: 0 };
  });

  const paymentModeTotals: Record<string, number> = {};
  expenses.forEach((t: any) => {
    const mode = t.paymentMethod || 'Other';
    paymentModeTotals[mode] = (paymentModeTotals[mode] || 0) + t.amount;
  });

  const paymentModeColors: Record<string, string> = {
    'Cash': '#10B981',
    'Card': '#3B82F6',
    'UPI': '#8B5CF6',
    'Net Banking': '#F59E0B',
    'Other': '#6B7280'
  };

  const paymentModeData = Object.entries(paymentModeTotals).map(([mode, amount]) => ({
    id: mode,
    name: mode,
    value: amount,
    hex: paymentModeColors[mode] || paymentModeColors['Other']
  })).sort((a, b) => b.value - a.value);

  const totalSpent = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalIncome = incomes.reduce((sum: number, i: any) => sum + i.amount, 0);

  // Selected Category Transactions
  const selectedCategoryTransactions = selectedCategoryForDetails 
    ? data.transactions.filter((t: any) => t.category === selectedCategoryForDetails && t.date.startsWith(selectedMonth))
    : [];
  const selectedCategoryInfo = allCategories.find(c => c.id === selectedCategoryForDetails);

  return (
    <>
      <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="px-4 pt-4">
          <h1 className="text-2xl font-medium tracking-tight text-on-surface">Analytics</h1>
          <p className="text-xs text-on-surface-variant mt-1">Deep dive into your spending habits</p>
        </header>

        <div className="px-4 space-y-4 mt-6">
        {/* Month Filter */}
        <div className="flex items-center justify-between mb-4 bg-surface-container-low p-2 rounded-full border border-outline-variant/30">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="relative flex items-center">
            <span className="font-medium text-sm text-on-surface cursor-pointer">{formattedMonth}</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <AIAnalyzer data={data} selectedMonth={selectedMonth} allCategories={allCategories} />

        {/* Summary Card */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[28px] flex flex-col items-center justify-center py-8 shadow-sm">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Total Spent in {formatMonth(selectedMonth, 'short')}</p>
          <h2 className="text-4xl font-medium text-on-surface tracking-tight">{formatCurrency(totalSpent)}</h2>
        </section>

        {/* Spending Trend */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
          <h3 className="text-base font-medium text-on-surface">Spending Trend</h3>
          <div className="w-full h-[240px] min-w-0">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B57D0" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0B57D0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val.split('-')[2]} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: '1px solid #C4C7C5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="amount" stroke="#0B57D0" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-4">
          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-medium text-on-surface">Expense Category Breakdown</h3>
            <div className="space-y-4">
              {pieData.sort((a, b) => b.value - a.value).map((d) => {
                const percentage = totalSpent > 0 ? (d.value / totalSpent) * 100 : 0;
                const cat = allCategories.find(c => c.id === d.id);
                return (
                  <div 
                    key={d.id} 
                    className="flex items-center gap-4 cursor-pointer hover:bg-surface-container-low p-2 rounded-xl transition-colors"
                    onClick={() => setSelectedCategoryForDetails(d.id)}
                  >
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl", cat?.color)}>
                      {cat?.icon}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm text-on-surface">{d.name}</span>
                        <span className="font-medium text-sm text-on-surface">{formatCurrency(d.value)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full rounded-full" 
                            style={{ backgroundColor: d.hex }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-on-surface-variant w-8 text-right">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-medium text-on-surface">Income Category Breakdown</h3>
            <div className="space-y-4">
              {incomeData.sort((a, b) => b.Earned - a.Earned).map((d) => {
                const percentage = totalIncome > 0 ? (d.Earned / totalIncome) * 100 : 0;
                const cat = allCategories.find(c => c.id === d.id);
                return (
                  <div 
                    key={d.id} 
                    className="flex items-center gap-4 cursor-pointer hover:bg-surface-container-low p-2 rounded-xl transition-colors"
                    onClick={() => setSelectedCategoryForDetails(d.id)}
                  >
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl", cat?.color)}>
                      {cat?.icon}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm text-on-surface">{d.name}</span>
                        <span className="font-medium text-sm text-on-surface">{formatCurrency(d.Earned)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full rounded-full" 
                            style={{ backgroundColor: d.hex }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-on-surface-variant w-8 text-right">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {incomeData.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-4">No income recorded for this month.</p>
              )}
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-medium text-on-surface">Budget vs Actual</h3>
            <div className="h-64 w-full min-w-0">
              {isMounted && (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1E3E1" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => val.length > 8 ? val.substring(0, 8) + '...' : val} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #C4C7C5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="Budget" fill="#C2E7FF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#0B57D0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-medium text-on-surface">Payment Modes</h3>
            <div className="h-48 w-full relative min-w-0">
              {isMounted && (
                <InteractiveDonutChart 
                  data={paymentModeData} 
                  totalValue={totalSpent} 
                  innerRadius={50} 
                  outerRadius={70} 
                  centerLabel="Modes"
                />
            )}
          </div>

            <div className="w-full space-y-3 mt-4">
              {paymentModeData.map((d) => {
                const percentage = totalSpent > 0 ? ((d.value / totalSpent) * 100).toFixed(1) : 0;
                return (
                  <div key={d.id} className="flex items-center justify-between p-2 hover:bg-surface-container-low rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.hex }} />
                      <span className="text-sm font-medium text-on-surface">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-on-surface">{formatCurrency(d.value)}</span>
                      <span className="text-xs font-medium text-on-surface-variant w-10 text-right bg-surface-container px-1.5 py-0.5 rounded-md">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Detailed Table */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[28px] p-5 space-y-4 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-base font-semibold text-on-surface">Detailed Breakdown</h3>
            <div className="px-2.5 py-0.5 bg-surface-container rounded-full text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              Budget vs Actual
            </div>
          </div>
          
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-on-surface-variant border-b border-outline-variant/30">
                  <th className="text-left pb-3 font-bold uppercase tracking-widest text-[9px] pl-2">Category</th>
                  <th className="text-right pb-3 font-bold uppercase tracking-widest text-[9px]">Budget</th>
                  <th className="text-right pb-3 font-bold uppercase tracking-widest text-[9px]">Actual</th>
                  <th className="text-right pb-3 font-bold uppercase tracking-widest text-[9px] pr-2">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {compareData.sort((a, b) => b.Actual - a.Actual).map((d) => {
                  const diff = d.type === 'income' ? d.Actual - d.Budget : d.Budget - d.Actual;
                  const isPositive = diff >= 0;
                  
                  return (
                    <tr key={d.id} className="group hover:bg-surface-container-low transition-colors">
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base shadow-sm shrink-0", d.color)}>
                            {d.icon}
                          </div>
                          <span className="font-semibold text-on-surface truncate max-w-[100px]">{d.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-on-surface-variant font-medium text-xs">{formatCurrency(d.Budget)}</td>
                      <td className="py-3 text-right font-bold text-on-surface text-xs">{formatCurrency(d.Actual)}</td>
                      <td className="py-3 text-right pr-2">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap",
                          isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {isPositive ? '+' : ''}{formatCurrency(diff)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-container-low/30 font-bold border-t border-outline-variant/30">
                  <td className="py-3 pl-4 rounded-l-2xl text-xs">Total</td>
                  <td className="py-3 text-right text-xs">{formatCurrency(compareData.reduce((sum, d) => sum + d.Budget, 0))}</td>
                  <td className="py-3 text-right text-xs">{formatCurrency(compareData.reduce((sum, d) => sum + d.Actual, 0))}</td>
                  <td className="py-3 text-right pr-4 rounded-r-2xl text-xs">
                    {formatCurrency(compareData.reduce((sum, d) => {
                      const diff = d.type === 'income' ? d.Actual - d.Budget : d.Budget - d.Actual;
                      return sum + diff;
                    }, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </div>

      {/* Category Details Modal */}
      <AnimatePresence>
        {selectedCategoryForDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-0"
            onClick={() => setSelectedCategoryForDetails(null)}
          >
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-surface w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xl", selectedCategoryInfo?.color)}>
                    {selectedCategoryInfo?.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-on-surface">{selectedCategoryInfo?.name}</h2>
                    <p className="text-xs text-on-surface-variant">{formatMonth(selectedMonth, 'long')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCategoryForDetails(null)}
                  className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {selectedCategoryTransactions.length > 0 ? (
                  <div className="space-y-4">
                    {selectedCategoryTransactions.sort((a: any, b: any) => b.date.localeCompare(a.date)).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl">
                        <div>
                          <p className="text-sm font-medium text-on-surface">{t.title}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{t.date} • {t.paymentMethod || 'Other'}</p>
                        </div>
                        <span className={cn("font-semibold", t.type === 'income' ? "text-tertiary" : "text-on-surface")}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-on-surface-variant text-sm">No transactions found for this category.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const ReportScreen = ({ data, userProfile, selectedMonth, onMonthChange: setSelectedMonth }: { data: any, userProfile: any, selectedMonth: string, onMonthChange: (m: string) => void }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const allCategories = Array.from(new Map([...CATEGORIES, ...(data.categories || [])].map(c => [c.id, c])).values());
  const savingsCategoryIds = userProfile?.savingsCategoryIds || [];

  const monthlyTransactions = data.transactions.filter((t: any) => t.date.startsWith(selectedMonth));
  const monthlyExpenses = monthlyTransactions.filter((t: any) => t.type === 'expense');
  const monthlyIncome = monthlyTransactions.filter((t: any) => t.type === 'income');
  
  const totalSpent = monthlyExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const totalIncome = monthlyIncome.reduce((sum: number, e: any) => sum + e.amount, 0);
  const netSavings = totalIncome - totalSpent;

  // Savings Data
  const monthlySavings = monthlyTransactions
    .filter((t: any) => savingsCategoryIds.includes(t.category))
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const overallSavings = data.transactions
    .filter((t: any) => savingsCategoryIds.includes(t.category))
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const monthlyBudgets = data.budgets.filter((b: any) => b.month === selectedMonth);
  const expenseBudgets = monthlyBudgets.filter((b: any) => b.category !== 'expected_salary');
  const totalBudgetFramed = expenseBudgets.reduce((sum: number, b: any) => sum + b.amount, 0);

  const categoryTotals: Record<string, number> = {};
  monthlyExpenses.forEach((e: any) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  const pieData = Object.entries(categoryTotals).map(([catId, amount]) => {
    const cat = allCategories.find(c => c.id === catId);
    return {
      id: catId,
      name: cat?.name || catId,
      value: amount,
      hex: cat?.hex || '#70757A'
    };
  }).sort((a, b) => b.value - a.value);

  const paymentModeTotals: Record<string, number> = {};
  monthlyExpenses.forEach((t: any) => {
    const mode = t.paymentMethod || 'Other';
    paymentModeTotals[mode] = (paymentModeTotals[mode] || 0) + t.amount;
  });

  const paymentModeColors: Record<string, string> = {
    'Cash': '#10B981',
    'Card': '#3B82F6',
    'UPI': '#8B5CF6',
    'Net Banking': '#F59E0B',
    'Other': '#6B7280'
  };

  const paymentModeData = Object.entries(paymentModeTotals).map(([mode, amount]) => ({
    id: mode,
    name: mode,
    value: amount,
    hex: paymentModeColors[mode] || paymentModeColors['Other']
  })).sort((a, b) => b.value - a.value);

  const incomeVsExpenseData = [
    { name: 'Income', amount: totalIncome, fill: '#10B981' },
    { name: 'Expense', amount: totalSpent, fill: '#EF4444' }
  ];

  const budgetVsExpenseData = [
    { name: 'Budget Framed', amount: totalBudgetFramed, fill: '#C2E7FF' },
    { name: 'Actual Spent', amount: totalSpent, fill: '#0B57D0' }
  ];

  // Savings Plan Analytics
  const currentYear = selectedMonth.slice(0, 4);
  const savingsPlan = userProfile?.savingsPlan?.[selectedMonth] || {};
  const monthlyPlanTotal = Object.entries(savingsPlan)
    .filter(([catId]) => savingsCategoryIds.includes(catId))
    .reduce((sum: number, [_, val]: [string, any]) => sum + (Number(val) || 0), 0);
  
  const savingsPlanVsActualData = [
    { name: 'Monthly Plan', amount: monthlyPlanTotal, fill: '#C2E7FF' },
    { name: 'Actual Saved', amount: monthlySavings, fill: '#10B981' }
  ];

  const generatePDF = async (action: 'download' | 'share' = 'download') => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const monthName = formatMonth(selectedMonth, 'long');
      
      let topCategory = 'None';
      let maxAmount = 0;
      Object.entries(categoryTotals).forEach(([catId, amount]) => {
        if (amount > maxAmount) {
          maxAmount = amount;
          topCategory = allCategories.find(c => c.id === catId)?.name || catId;
        }
      });

      const formatPDFCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

      // Title
      doc.setFontSize(22);
      doc.setTextColor(11, 87, 208); // Primary color
      doc.text('Flux Financial Report', 14, 22);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
      doc.text(`Report Period: ${monthName}`, 14, 37);
      
      // Analytics Summary Section
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('1. Executive Summary', 14, 50);
      
      doc.setFontSize(11);
      const summaryData = [
        ['Total Income', formatPDFCurrency(totalIncome)],
        ['Total Expenses', formatPDFCurrency(totalSpent)],
        ['Net Savings (Income - Expense)', formatPDFCurrency(netSavings)],
        ['Budget Set', formatPDFCurrency(totalBudgetFramed)],
        ['Monthly Savings (Investments)', formatPDFCurrency(monthlySavings)],
        ['Overall Savings (Cumulative)', formatPDFCurrency(overallSavings)],
        ['Top Expense Category', `${topCategory} (${formatPDFCurrency(maxAmount)})`]
      ];

      autoTable(doc, {
        body: summaryData,
        startY: 55,
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      // Category Breakdown Section
      doc.setFontSize(16);
      doc.text('2. Category Breakdown', 14, currentY);
      currentY += 10;

      const categoryRows = pieData.map(d => [
        d.name,
        formatPDFCurrency(d.value),
        `${(totalSpent > 0 ? (d.value / totalSpent) * 100 : 0).toFixed(1)}%`
      ]);

      autoTable(doc, {
        head: [['Category', 'Amount Spent', 'Percentage']],
        body: categoryRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [11, 87, 208] },
        styles: { fontSize: 10 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Payment Mode Section
      doc.setFontSize(16);
      doc.text('3. Payment Mode Analysis', 14, currentY);
      currentY += 10;

      const paymentRows = paymentModeData.map(d => [
        d.name,
        formatPDFCurrency(d.value),
        `${(totalSpent > 0 ? (d.value / totalSpent) * 100 : 0).toFixed(1)}%`
      ]);

      autoTable(doc, {
        head: [['Payment Method', 'Amount', 'Percentage']],
        body: paymentRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // Emerald color
        styles: { fontSize: 10 }
      });

      // New Page for detailed transactions
      doc.addPage();
      doc.setFontSize(16);
      doc.text('4. Detailed Transaction History', 14, 22);

      const tableColumn = ["Date", "Title", "Category", "Method", "Amount"];
      const tableRows = monthlyTransactions
        .sort((a: any, b: any) => b.date.localeCompare(a.date))
        .map((t: any) => {
          const categoryName = allCategories.find(c => c.id === t.category)?.name || t.category;
          return [
            t.date,
            t.title,
            categoryName,
            t.paymentMethod || 'Other',
            `${t.type === 'income' ? '+' : '-'}${formatPDFCurrency(t.amount)}`
          ];
        });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [11, 87, 208] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const text = data.cell.raw as string;
            if (text.startsWith('+')) {
              data.cell.styles.textColor = [16, 185, 129];
            } else {
              data.cell.styles.textColor = [239, 68, 68];
            }
          }
        }
      });

      const fileName = `flux_comprehensive_report_${monthName.replace(' ', '_').toLowerCase()}.pdf`;
      
      if (Capacitor.isNativePlatform()) {
        // Blob downloads don't work in the Android WebView: write the PDF to
        // the app cache and open the system share sheet (covers both saving
        // via Files/Drive and sharing) for either action.
        const base64 = (doc.output('datauristring') as string).split(',')[1];
        const { uri } = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        try {
          await CapacitorShare.share({
            title: `Flux Report - ${monthName}`,
            text: `Here is the financial report for ${monthName}.`,
            files: [uri],
          });
        } catch (shareErr) {
          // User dismissed the share sheet — not an error.
          const msg = shareErr instanceof Error ? shareErr.message : String(shareErr);
          if (!/cancel/i.test(msg)) throw shareErr;
        }
      } else if (action === 'share') {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Flux Report - ${monthName}`,
            text: `Here is the financial report for ${monthName}.`,
            files: [file],
          });
        } else {
          // Fallback to download if sharing is not supported
          doc.save(fileName);
        }
      } else {
        doc.save(fileName);
      }
    } catch (err) {
      console.error("Error generating PDF", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrevMonth = () => {
    let year = parseInt(selectedMonth.slice(0, 4));
    let month = parseInt(selectedMonth.slice(5, 7));
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    let year = parseInt(selectedMonth.slice(0, 4));
    let month = parseInt(selectedMonth.slice(5, 7));
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const formattedMonth = formatMonth(selectedMonth, 'long');

  return (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="px-4 pt-6">
        <h1 className="text-2xl font-medium tracking-tight text-on-surface">Reports</h1>
        <p className="text-xs text-on-surface-variant mt-1">Export your financial data</p>
      </header>

      <div className="px-4 space-y-4 mt-6">
        <div className="flex items-center justify-between mb-4 bg-surface-container-low p-2 rounded-full border border-outline-variant/30">
          <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="relative flex items-center">
            <span className="font-medium text-sm text-on-surface cursor-pointer">{formattedMonth}</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <ExpenseInsightsCard 
          pieData={pieData}
          paymentModeData={paymentModeData}
          totalExpenses={totalSpent}
          allCategories={allCategories}
          isMounted={isMounted}
        />

        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
          <h3 className="text-base font-medium text-on-surface">Income vs Expense</h3>
          <div className="w-full h-48 min-w-0">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpenseData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={60} fontSize={12} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #C4C7C5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
                  {incomeVsExpenseData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
          <h3 className="text-base font-medium text-on-surface">Savings Plan vs Actual</h3>
          <div className="w-full h-48 min-w-0">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savingsPlanVsActualData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} fontSize={12} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #C4C7C5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
                  {savingsPlanVsActualData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-5 space-y-4 shadow-sm">
          <h3 className="text-base font-medium text-on-surface">Budget Framed vs Actual Spent</h3>
          <div className="w-full h-48 min-w-0">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsExpenseData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} fontSize={12} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #C4C7C5', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
                  {budgetVsExpenseData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        </section>

        <section className="bg-primary-container text-on-primary-container text-center border border-outline-variant/30 rounded-[28px] p-6 shadow-sm">
          <div className="w-16 h-16 bg-primary text-on-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <FileText size={32} />
          </div>
          <h2 className="text-xl font-medium mb-2">Monthly PDF Report</h2>
          <p className="text-sm opacity-90 mb-6">Export a detailed PDF report of all your transactions for {formattedMonth}.</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => generatePDF('download')}
              disabled={isGenerating}
              className="w-full py-4 rounded-full bg-primary text-on-primary font-medium text-base hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Download size={20} />
              {isGenerating ? "Generating..." : "Save Offline"}
            </button>
            <button 
              onClick={() => generatePDF('share')}
              disabled={isGenerating}
              className="w-full py-4 rounded-full bg-surface-container text-on-surface font-medium text-base hover:bg-surface-container-high border-2 border-primary/20 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Share size={20} />
              {isGenerating ? "Generating..." : "Share"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, customCategories, onAddCategory, onDeleteCategory, userProfile, onUpdateSavingsCategories }: { 
  isOpen: boolean, 
  onClose: () => void, 
  customCategories: CustomCategory[], 
  onAddCategory: (cat: any) => void, 
  onDeleteCategory: (id: string) => void, 
  userProfile?: any,
  onUpdateSavingsCategories: (ids: string[]) => void
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📦');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(auth.currentUser?.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);
  
  const savingsCategoryIds = userProfile?.savingsCategoryIds || [];
  const allCategories = Array.from(new Map([...CATEGORIES, ...customCategories].map(c => [c.id, c])).values());

  if (!isOpen) return null;

  const toggleSavingsCategory = (categoryId: string) => {
    const newIds = savingsCategoryIds.includes(categoryId)
      ? savingsCategoryIds.filter((id: string) => id !== categoryId)
      : [...savingsCategoryIds, categoryId];
    onUpdateSavingsCategories(newIds);
  };

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      onAddCategory({
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatType === 'expense' ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-700',
        hex: newCatType === 'expense' ? '#70757A' : '#10B981',
        type: newCatType
      });
      setNewCatName('');
      setNewCatIcon('📦');
    }
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || !auth.currentUser) return;
    setIsSavingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: editedName.trim() });
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || '',
          displayName: editedName.trim()
        }, { merge: true });
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.WRITE, `users/${auth.currentUser.uid}`);
      }
      setIsEditingName(false);
    } catch (error) {
      console.error("Error updating profile", error);
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-surface-container-lowest rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl max-h-[85vh] overflow-y-auto sm:max-w-md sm:mx-auto sm:w-full"
      >
        <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mb-6 sm:hidden" />
        
        <div className="flex justify-between items-center mb-6 sticky top-0 bg-surface-container-lowest z-10 py-2">
          <h2 className="text-2xl font-medium tracking-tight">Settings</h2>
          <button onClick={onClose} className="p-2 bg-surface-container hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-8">
          {/* Profile Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Profile</h3>
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant font-bold overflow-hidden text-2xl shrink-0">
                  {auth.currentUser?.photoURL ? (
                    <img src={auth.currentUser.photoURL} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    auth.currentUser?.displayName?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="flex-1 bg-surface-container border border-outline-variant/50 rounded-lg px-2 py-1 outline-none focus:border-primary text-sm font-medium w-full"
                        autoFocus
                      />
                      <button 
                        onClick={handleSaveName}
                        disabled={isSavingName || !editedName.trim()}
                        className="text-xs bg-primary text-on-primary px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                      >
                        {isSavingName ? '...' : 'Save'}
                      </button>
                      <button 
                        onClick={() => { setIsEditingName(false); setEditedName(auth.currentUser?.displayName || ''); }}
                        className="text-xs bg-surface-container-high text-on-surface px-3 py-1.5 rounded-lg font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="truncate pr-2">
                        <h3 className="font-medium text-on-surface text-lg truncate">{auth.currentUser?.displayName || 'User'}</h3>
                        <p className="text-sm text-on-surface-variant truncate">{auth.currentUser?.email}</p>
                      </div>
                      <button 
                        onClick={() => setIsEditingName(true)}
                        className="text-xs text-primary font-medium hover:bg-primary/10 px-2 py-1 rounded-md transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Preferences</h3>
            <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-on-surface text-sm">Currency</p>
                  <p className="text-xs text-on-surface-variant">Default currency for transactions</p>
                </div>
                <span className="text-sm font-medium bg-surface-container px-3 py-1 rounded-lg">INR (₹)</span>
              </div>
              <div className="h-px bg-outline-variant/30 w-full" />
              <div className="flex items-center justify-between opacity-50">
                <div>
                  <p className="font-medium text-on-surface text-sm">Dark Mode</p>
                  <p className="text-xs text-on-surface-variant">Coming soon</p>
                </div>
                <div className="w-10 h-6 bg-surface-container-highest rounded-full" />
              </div>
            </div>
          </section>

          {/* Categories Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Custom Categories</h3>
            
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 space-y-4">
              <h4 className="font-medium text-on-surface text-sm">Add New Category</h4>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setNewCatType('expense')}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-medium border transition-all", newCatType === 'expense' ? "bg-error/10 border-error/30 text-error" : "border-outline-variant/50 text-on-surface-variant")}
                >
                  Expense
                </button>
                <button
                  onClick={() => setNewCatType('income')}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-medium border transition-all", newCatType === 'income' ? "bg-emerald-100/50 border-emerald-500/30 text-emerald-700" : "border-outline-variant/50 text-on-surface-variant")}
                >
                  Income
                </button>
              </div>

              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="w-12 text-center bg-surface-container border border-outline-variant/50 rounded-xl outline-none focus:border-primary text-xl"
                  maxLength={2}
                />
                <input 
                  type="text" 
                  placeholder="Category Name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 bg-surface-container border border-outline-variant/50 rounded-xl px-3 py-2 outline-none focus:border-primary text-sm font-medium"
                />
              </div>
              <button 
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
                className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm disabled:opacity-50"
              >
                Add Category
              </button>
            </div>

            <div className="space-y-3">
              {customCategories.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">No custom categories added yet.</p>
              ) : (
                <div className="space-y-2">
                  {customCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm", cat.color)}>
                          {cat.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-on-surface">{cat.name}</p>
                          <p className="text-[10px] text-on-surface-variant capitalize">{cat.type}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => onDeleteCategory(cat.id)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-4">
            <button 
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  // Also clear the native session so the account picker shows
                  // again on the next Google sign-in.
                  try { await FirebaseAuthentication.signOut(); } catch { /* native session may not exist */ }
                }
                signOut(auth);
                onClose();
              }}
              className="w-full py-4 rounded-xl border border-error/30 text-error font-medium hover:bg-error/5 transition-colors flex items-center justify-center gap-2"
            >
              Logout
            </button>
          </section>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

import { AuthScreen } from './components/AuthScreen';

const MainApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  // Month selection is shared app-wide: changing it on any screen changes it everywhere.
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const { data, addTransaction, deleteTransaction, updateTransaction, updateBudget, deleteBudget, addCustomCategory, deleteCustomCategory, updateSavingsCategories, updateSavingsPlan, updateYearlySavingsPlan, updateFullSavingsPlan, userId, isAuthReady, userProfile } = useFluxData();

  // Android hardware back button: close the topmost open modal first,
  // then return to the dashboard tab, then exit the app.
  const backStateRef = React.useRef({ activeTab, showAIChat, showSettings, showAddTransaction });
  backStateRef.current = { activeTab, showAIChat, showSettings, showAddTransaction };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      if (runBackHandlers()) return;
      const s = backStateRef.current;
      if (s.showAIChat) { setShowAIChat(false); return; }
      if (s.showSettings) { setShowSettings(false); return; }
      if (s.showAddTransaction) { setShowAddTransaction(false); return; }
      if (s.activeTab !== 'dashboard') { setActiveTab('dashboard'); return; }
      CapacitorApp.exitApp();
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  const handleNavigateToAdd = () => {
    setActiveTab('expenses');
    setShowAddTransaction(true);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userId) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-surface max-w-md mx-auto relative shadow-2xl overflow-x-hidden">
      <ScreenHeader onOpenSettings={() => setShowSettings(true)} />
      <main className="min-h-screen pb-24">
        {activeTab === 'dashboard' && <Dashboard data={data} onNavigateToAdd={handleNavigateToAdd} onNavigateToTransactions={() => setActiveTab('expenses')} userProfile={userProfile} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />}
        {activeTab === 'expenses' && <TransactionList data={data} onDelete={deleteTransaction} onAdd={addTransaction} onUpdate={updateTransaction} showAdd={showAddTransaction} setShowAdd={setShowAddTransaction} customCategories={data.categories || []} />}
        {activeTab === 'savings' && <SavingsScreen data={data} userProfile={userProfile} onUpdateSavingsCategories={updateSavingsCategories} onAddTransaction={addTransaction} onUpdateTransaction={updateTransaction} onDeleteTransaction={deleteTransaction} onUpdateSavingsPlan={updateSavingsPlan} onUpdateYearlySavingsPlan={updateYearlySavingsPlan} onUpdateFullSavingsPlan={updateFullSavingsPlan} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />}
        {activeTab === 'budget' && <BudgetScreen data={data} onUpdateBudget={updateBudget} onDeleteBudget={deleteBudget} customCategories={data.categories || []} onAddCategory={addCustomCategory} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />}
        {activeTab === 'compare' && <CompareScreen data={data} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />}
        {activeTab === 'report' && <ReportScreen data={data} userProfile={userProfile} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Floating AI Chat Button */}
      <button
        onClick={() => setShowAIChat(true)}
        className="app-ai-fab fixed bottom-[100px] right-6 z-40 bg-primary text-on-primary w-14 h-14 rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
      >
        <Bot size={28} />
      </button>

      <AIChatModal 
        isOpen={showAIChat} 
        onClose={() => setShowAIChat(false)} 
        onAddTransaction={addTransaction}
        customCategories={data.categories || []}
      />

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        customCategories={data.categories || []}
        onAddCategory={addCustomCategory}
        onDeleteCategory={deleteCustomCategory}
        userProfile={userProfile}
        onUpdateSavingsCategories={updateSavingsCategories}
      />
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  // Native init, then the animated splash timer: the timer must start only
  // AFTER the native splash is hidden, otherwise the native splash covers most
  // of the 2.5s animation and the user never sees it.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Light });

          Keyboard.addListener('keyboardWillShow', (info) => {
            document.body.classList.add('keyboard-open');
            document.documentElement.style.setProperty('--keyboard-height', `${info?.keyboardHeight ?? 0}px`);
          });
          Keyboard.addListener('keyboardWillHide', () => {
            document.body.classList.remove('keyboard-open');
            document.documentElement.style.setProperty('--keyboard-height', '0px');
          });

          await SplashScreen.hide();
        } catch (e) {
          console.warn('Capacitor plugins not available:', e);
        }
      }
      timer = setTimeout(() => setShowSplash(false), 2500);
    };
    init();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-surface flex flex-col items-center justify-center z-50 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex flex-wrap justify-center items-center gap-8 p-4">
          {Array.from({ length: 100 }).map((_, i) => {
            const symbols = ['₹', '$', '€', '¥', '£'];
            return (
              <span key={i} className="text-4xl font-bold text-on-surface">
                {symbols[i % symbols.length]}
              </span>
            );
          })}
        </div>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          <FluxLogo className="w-48 h-48 drop-shadow-2xl" />
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="text-5xl font-bold text-on-surface mt-6 tracking-tight"
        >
          Flux
        </motion.h1>
        <SloganAnimation variant="splash" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
