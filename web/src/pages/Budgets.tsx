import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useChartColors } from "../lib/chartColors";
import { formatMoney, todayISO } from "../lib/format";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import { Modal } from "../components/Modal";
import { PlusIcon } from "../components/icons";
import {
  PERIOD_LABELS,
  type Budget,
  type BudgetCreate,
  type BudgetPeriod,
  type BudgetStatusItem,
  type Category,
} from "../lib/types";

const INVALIDATE = ["budgets", "budgets-report"];

export function Budgets() {
  const { user } = useAuth();
  const currency = user?.base_currency ?? "";
  const [modal, setModal] = useState<{ open: boolean; editing: Budget | null }>({ open: false, editing: null });

  const budgetsQ = useQuery({ queryKey: ["budgets"], queryFn: () => api.get<Budget[]>("/budgets") });
  const statusQ = useQuery({
    queryKey: ["budgets-report", "page"],
    queryFn: () => api.get<BudgetStatusItem[]>("/reports/budgets", { ref_date: todayISO() }),
  });
  const catQ = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });

  const statusOf = (budgetId: string) => statusQ.data?.find((s) => s.budget_id === budgetId);
  const catName = (id: string) => catQ.data?.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">Presupuestos</h1>
          <p className="text-sm text-muted">Define topes por categoría y vigila qué tan cerca vas.</p>
        </div>
        <Button onClick={() => setModal({ open: true, editing: null })}>
          <PlusIcon width={18} height={18} />
          Nuevo
        </Button>
      </div>

      {budgetsQ.isLoading ? (
        <div className="grid place-items-center py-20 text-muted"><Spinner className="h-8 w-8" /></div>
      ) : (budgetsQ.data?.length ?? 0) === 0 ? (
        <Card className="py-14 text-center">
          <p className="text-fg">Aún no tienes presupuestos.</p>
          <p className="mt-1 text-sm text-muted">Crea uno con “Nuevo” para empezar a controlar tus gastos.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {budgetsQ.data!.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              status={statusOf(b.id)}
              name={catName(b.category_id)}
              currency={currency}
              onEdit={() => setModal({ open: true, editing: b })}
            />
          ))}
        </div>
      )}

      {modal.open && (
        <BudgetModal
          editing={modal.editing}
          categories={(catQ.data ?? []).filter((c) => c.type === "expense" && !c.is_archived)}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </div>
  );
}

function BudgetCard({
  budget,
  status,
  name,
  currency,
  onEdit,
}: {
  budget: Budget;
  status?: BudgetStatusItem;
  name: string;
  currency: string;
  onEdit: () => void;
}) {
  const colors = useChartColors();
  const pct = (status?.percent_used ?? 0) * 100;
  const [color, badge] = pct >= 100 ? [colors.crit, "Excedido"] : pct >= 85 ? [colors.warn, "Ajustado"] : [colors.good, "En orden"];
  return (
    <button onClick={onEdit} className="rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition hover:border-primary/40">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-bold text-fg">{name}</p>
          <p className="text-xs font-medium text-muted">{PERIOD_LABELS[budget.period]}</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wide" style={{ background: `${color}22`, color }}>{badge}</span>
      </div>
      <p className="text-lg font-extrabold text-fg">
        {formatMoney(status?.spent ?? "0", currency)}
        <span className="text-sm font-semibold text-muted"> / {formatMoney(budget.amount, currency)}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--muted) 20%, transparent)" }}>
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </button>
  );
}

function BudgetModal({
  editing,
  categories,
  onClose,
}: {
  editing: Budget | null;
  categories: Category[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [amount, setAmount] = useState(editing?.amount ?? "");
  const [period, setPeriod] = useState<BudgetPeriod>(editing?.period ?? "monthly");
  const [startDate, setStartDate] = useState(editing?.start_date ?? todayISO());
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (payload: BudgetCreate) =>
      editing ? api.patch<Budget>(`/budgets/${editing.id}`, payload) : api.post<Budget>("/budgets", payload),
    onSuccess: () => {
      INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Error"),
  });
  const del = useMutation({
    mutationFn: () => api.del(`/budgets/${editing!.id}`),
    onSuccess: () => {
      INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
  });

  function submit() {
    setError(null);
    if (!categoryId) return setError("Selecciona una categoría.");
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) return setError("Ingresa un monto válido.");
    save.mutate({ category_id: categoryId, amount, period, start_date: startDate });
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Editar presupuesto" : "Nuevo presupuesto"}>
      <div className="space-y-4">
        <Field label="Categoría (gasto)">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-fg focus:border-primary/50 focus:outline-none">
            <option value="">Selecciona…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="Monto tope">
          <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>

        <Field label="Período">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {(["weekly", "monthly", "yearly"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg py-2 text-xs font-semibold transition ${period === p ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Desde">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          {editing && (
            <Button variant="ghost" onClick={() => del.mutate()} className="text-danger hover:bg-danger/10" disabled={del.isPending}>
              Eliminar
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Spinner /> : "Guardar"}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
