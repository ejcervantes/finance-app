import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatMoney, formatDate, savingsRateText } from "../lib/format";
import { Card, Spinner } from "../components/ui";
import { ArrowDownIcon, ArrowUpIcon } from "../components/icons";
import type { CategoryReportItem, Summary, TransactionList } from "../lib/types";

export function Dashboard() {
  const { user } = useAuth();
  const currency = user?.base_currency ?? "";

  const summaryQ = useQuery({
    queryKey: ["summary"],
    queryFn: () => api.get<Summary>("/reports/summary"),
  });
  const categoriesQ = useQuery({
    queryKey: ["by-category"],
    queryFn: () => api.get<CategoryReportItem[]>("/reports/by-category"),
  });
  const recentQ = useQuery({
    queryKey: ["recent"],
    queryFn: () =>
      api.get<TransactionList>("/transactions", { page_size: 5, sort: "-transaction_date" }),
  });

  const summary = summaryQ.data;
  const negative = summary ? Number(summary.balance) < 0 : false;
  const maxCat = Math.max(1, ...(categoriesQ.data ?? []).map((c) => Number(c.total)));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Hola, {user?.first_name} 👋</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Resumen del mes</h1>
      </div>

      {summaryQ.isLoading ? (
        <div className="grid place-items-center py-20 text-muted">
          <Spinner className="h-8 w-8" />
        </div>
      ) : summary ? (
        <>
          {/* Balance hero */}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
            <p className="text-sm font-medium text-muted">Balance del mes</p>
            <p
              className={`mt-1 text-4xl font-extrabold tracking-tight ${
                negative ? "text-danger" : "text-fg"
              }`}
            >
              {formatMoney(summary.balance, currency)}
            </p>
            {summary.savings_rate !== null && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success">
                Tasa de ahorro {savingsRateText(summary.savings_rate)}
              </span>
            )}
          </Card>

          {/* Ingresos / Gastos */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile
              label="Ingresos"
              amount={formatMoney(summary.total_income, currency)}
              icon={<ArrowDownIcon />}
              tone="success"
            />
            <StatTile
              label="Gastos"
              amount={formatMoney(summary.total_expense, currency)}
              icon={<ArrowUpIcon />}
              tone="danger"
            />
          </div>

          {/* Gasto por categoría */}
          {(categoriesQ.data?.length ?? 0) > 0 && (
            <Card>
              <h2 className="mb-4 text-base font-bold text-fg">Gasto por categoría</h2>
              <div className="space-y-3">
                {categoriesQ.data!.slice(0, 6).map((c) => (
                  <div key={c.category_id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-fg">{c.category_name}</span>
                      <span className="text-muted">{formatMoney(c.total, currency)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(Number(c.total) / maxCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recientes */}
          {(recentQ.data?.items.length ?? 0) > 0 && (
            <Card>
              <h2 className="mb-3 text-base font-bold text-fg">Movimientos recientes</h2>
              <div className="divide-y divide-border">
                {recentQ.data!.items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full ${
                          t.type === "income"
                            ? "bg-success/15 text-success"
                            : "bg-danger/15 text-danger"
                        }`}
                      >
                        {t.type === "income" ? <ArrowDownIcon width={16} height={16} /> : <ArrowUpIcon width={16} height={16} />}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-fg">
                          {t.description || "Movimiento"}
                        </p>
                        <p className="text-xs text-muted">{formatDate(t.transaction_date)}</p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        t.type === "income" ? "text-success" : "text-fg"
                      }`}
                    >
                      {formatMoney(t.amount, t.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <p className="text-danger">No se pudo cargar el resumen.</p>
      )}
    </div>
  );
}

function StatTile({
  label,
  amount,
  icon,
  tone,
}: {
  label: string;
  amount: string;
  icon: React.ReactNode;
  tone: "success" | "danger";
}) {
  const toneClass = tone === "success" ? "text-success bg-success/15" : "text-danger bg-danger/15";
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneClass}`}>{icon}</span>
        <span className="text-sm font-medium text-muted">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-fg">{amount}</p>
    </Card>
  );
}
