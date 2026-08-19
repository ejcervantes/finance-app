import { useTheme } from "../context/ThemeContext";

export interface ChartColors {
  dark: boolean;
  income: string;
  expense: string;
  cat: string[];
  nature: string[]; // fijo, variable, prescindible
  good: string;
  warn: string;
  crit: string;
}

/** Paleta de series validada para daltonismo (adyacencias CVD-seguras). */
export function useChartColors(): ChartColors {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    dark,
    income: dark ? "#6fce9f" : "#1f7a52",
    expense: dark ? "#f0a869" : "#dd8038",
    cat: dark
      ? ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#8fa0a4"]
      : ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#9a978f"],
    nature: dark ? ["#6fb9c7", "#e6c06a", "#ef8a6a"] : ["#134f5c", "#c99a2e", "#c85c3c"],
    good: dark ? "#6fce9f" : "#1f7a52",
    warn: dark ? "#e6c06a" : "#c98a1e",
    crit: dark ? "#f0837a" : "#b4443a",
  };
}
