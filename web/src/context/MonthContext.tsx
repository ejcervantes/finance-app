import { createContext, useContext, useState, type ReactNode } from "react";
import { startOfMonth, monthRange, monthLabel, isCurrentOrFutureMonth } from "../lib/format";

interface MonthContextValue {
  month: Date; // primer día del mes seleccionado
  label: string;
  range: { from: string; to: string };
  atCurrentMonth: boolean;
  prev: () => void;
  next: () => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));

  const shift = (delta: number) =>
    setMonth((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() + delta, 1)));

  const value: MonthContextValue = {
    month,
    label: monthLabel(month),
    range: monthRange(month),
    atCurrentMonth: isCurrentOrFutureMonth(month),
    prev: () => shift(-1),
    next: () => shift(1),
  };

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMonth(): MonthContextValue {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth debe usarse dentro de MonthProvider");
  return ctx;
}
