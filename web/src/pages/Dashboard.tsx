import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useMonth } from "../context/MonthContext";
import { useChartColors } from "../lib/chartColors";
import { formatMoney, savingsRateText, shortMonth } from "../lib/format";
import { Card, Spinner } from "../components/ui";
import { ArrowDownIcon, ArrowUpIcon } from "../components/icons";
import { MonthNav } from "../components/MonthNav";
import { GroupedBars, Donut, StackedBar, AreaChart, MiniLine } from "../components/charts/Charts";
import {
  NATURE_LABELS_EXT,
  type BudgetStatusItem,
  type CategoryReportItem,
  type NatureReportItem,
  type Summary,
  type TrendItem,
} from "../lib/types";

const NATURE_ORDER = ["fixed", "variable", "discretionary", "unclassified"];

export function Dashboard() {
  const { user } = useAuth();
  const { range, label } = useMonth();
  const colors = useChartColors();
  const currency = user?.base_currency ?? "";
  const q = { date_from: range.from, date_to: range.to };

  const summaryQ = useQuery({
    queryKey: ["summary", range.from],
    queryFn: () => api.get<Summary>("/reports/summary", q),
  });
  const categoriesQ = useQuery({
    queryKey: ["by-category", range.from],
    queryFn: () => api.get<CategoryReportItem[]>("/reports/by-category", { ...q, type: "expense" }),
  });
  const natureQ = useQuery({
    queryKey: ["by-nature", range.from],
    queryFn: () => api.get<NatureReportItem[]>("/reports/by-nature", q),
  });
  const budgetsQ = useQuery({
    queryKey: ["budgets-report", range.to],
    queryFn: () => api.get<BudgetStatusItem[]>("/reports/budgets", { ref_date: range.to }),
  });
  const trendQ = useQuery({
    queryKey: ["trend"],
    queryFn: () => api.get<TrendItem[]>("/reports/trend", { months: 6 }),
  });

  const summary = summaryQ.data;
  const negative = summary ? Number(summary.balance) < 0 : false;
  const trend = trendQ.data ?? [];

  // Delta vs. mes anterior (desde la tendencia)
  const monthKey = `${range.from.slice(0, 7)}`;
  const idx = trend.findIndex((t) => t.month === monthKey);
  const delta =
    idx > 0 ? Number(trend[idx].balance) - Number(trend[idx - 1].balance) : null;
  const prevLabel = idx > 0 ? shortMonth(trend[idx - 1].month) : "";

  // Naturaleza en orden fijo
  const natureData = NATURE_ORDER.map((n) => ({
    name: NATURE_LABELS_EXT[n] ?? n,
    value: Number(natureQ.data?.find((x) => x.nature === n)?.total ?? 0),
  })).filter((d) => d.value > 0);
  const natureColors = [...colors.nature, colors.dark ? "#8fa0a4" : "#9a978f"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Hola, {user?.first_name} 👋</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">Resumen</h1>
        </div>
        <MonthNav />
      </div>

      {summaryQ.isLoading || trendQ.isLoading ? (
        <div className="grid place-items-center py-24 text-muted"><Spinner className="h-8 w-8" /></div>
      ) : !summary ? (
        <p className="text-danger">No se pudo cargar el resumen.</p>
      ) : (
        <>
          {/* 1. Veredicto */}
          <Card>
            <div className="grid items-center gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted">Balance de {label.toLowerCase()}</p>
                <p className={`mt-1 text-4xl font-extrabold tracking-tight ${negative ? "text-danger" : "text-fg"}`}>
                  {formatMoney(summary.balance, currency)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {summary.savings_rate !== null && (
                    <span className="inline-flex rounded-full bg-success/15 px-3 py-1 text-sm font-bold text-success">
                      Tasa de ahorro {savingsRateText(summary.savings_rate)}
                    </span>
                  )}
                  {delta !== null && delta !== 0 && (
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${delta > 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                      {delta > 0 ? "▲" : "▼"} {formatMoney(String(Math.abs(delta)), currency)} vs. {prevLabel}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-muted">Balance de los últimos meses</p>
                <MiniLine trend={trend} colors={colors} />
              </div>
            </div>
          </Card>

          {/* Ingresos / Gastos */}
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Ingresos" amount={formatMoney(summary.total_income, currency)} icon={<ArrowDownIcon />} tone="success" />
            <StatTile label="Gastos" amount={formatMoney(summary.total_expense, currency)} icon={<ArrowUpIcon />} tone="danger" />
          </div>

          {/* 2 + 3: Cómo vengo / Esencial */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h2 className="text-base font-bold text-fg">Cómo vengo</h2>
              <p className="mb-2 text-sm text-muted">Ingresos vs. gastos por mes</p>
              <div className="mb-2 flex gap-4 text-sm font-semibold">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ background: colors.income }} />Ingresos</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded" style={{ background: colors.expense }} />Gastos</span>
              </div>
              <GroupedBars trend={trend} colors={colors} />
            </Card>
            <Card>
              <h2 className="text-base font-bold text-fg">Esencial vs. prescindible</h2>
              <p className="mb-4 text-sm text-muted">En qué tipo de gasto se te va</p>
              {natureData.length > 0 ? (
                <>
                  <StackedBar data={natureData} colors={natureColors} dark={colors.dark} />
                  <div className="mt-4 flex flex-wrap gap-3">
                    {natureData.map((d, i) => (
                      <span key={d.name} className="flex items-center gap-2 text-sm font-semibold text-fg">
                        <span className="h-3 w-3 rounded" style={{ background: natureColors[i] }} />{d.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-muted">Sin gastos este mes.</p>}
            </Card>
          </div>

          {/* 4 + 5: Dona / Presupuestos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-base font-bold text-fg">A dónde va tu dinero</h2>
              <p className="mb-4 text-sm text-muted">Gasto por categoría</p>
              {(categoriesQ.data?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap items-center gap-4">
                  <Donut
                    data={categoriesQ.data!.map((c) => ({ name: c.category_name, value: Number(c.total) }))}
                    colors={colors.cat}
                    totalLabel={formatMoney(String(categoriesQ.data!.reduce((s, c) => s + Number(c.total), 0)), "")}
                  />
                  <div className="flex min-w-[150px] flex-1 flex-col gap-2">
                    {categoriesQ.data!.map((c, i) => (
                      <div key={c.category_id} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded" style={{ background: colors.cat[i % colors.cat.length] }} />
                        <span className="font-medium text-fg">{c.category_name}</span>
                        <span className="ml-auto font-semibold text-muted">{formatMoney(c.total, currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-sm text-muted">Sin gastos este mes.</p>}
            </Card>
            <Card>
              <h2 className="text-base font-bold text-fg">Presupuestos</h2>
              <p className="mb-4 text-sm text-muted">Qué tan cerca del tope vas</p>
              {(budgetsQ.data?.length ?? 0) > 0 ? (
                <div className="flex flex-col gap-4">
                  {budgetsQ.data!.map((b) => <BudgetBar key={b.budget_id} b={b} colors={colors} currency={currency} />)}
                </div>
              ) : (
                <p className="text-sm text-muted">Aún no tienes presupuestos. Créalos para verlos aquí.</p>
              )}
            </Card>
          </div>

          {/* 6: Ahorro acumulado */}
          <Card>
            <h2 className="text-base font-bold text-fg">Ahorro acumulado</h2>
            <p className="mb-3 text-sm text-muted">Tu colchón creciendo mes a mes</p>
            <AreaChart trend={trend} colors={colors} />
          </Card>
        </>
      )}
    </div>
  );
}

function StatTile({ label, amount, icon, tone }: { label: string; amount: string; icon: React.ReactNode; tone: "success" | "danger" }) {
  const cls = tone === "success" ? "text-success bg-success/15" : "text-danger bg-danger/15";
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${cls}`}>{icon}</span>
        <span className="text-sm font-medium text-muted">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-fg">{amount}</p>
    </Card>
  );
}

function BudgetBar({ b, colors, currency }: { b: BudgetStatusItem; colors: ReturnType<typeof useChartColors>; currency: string }) {
  const pct = (b.percent_used ?? 0) * 100;
  const [color, badge] = pct >= 100 ? [colors.crit, "Excedido"] : pct >= 85 ? [colors.warn, "Ajustado"] : [colors.good, "En orden"];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-bold text-fg">{b.category_name}</span>
        <span className="text-xs font-semibold text-muted">
          {formatMoney(b.spent, currency)} / {formatMoney(b.budget, currency)}
          <span className="ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide" style={{ background: `${color}22`, color }}>{badge}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--muted) 20%, transparent)" }}>
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}
