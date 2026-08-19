import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatMoney, formatDate, todayISO } from "../lib/format";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import { Modal } from "../components/Modal";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "../components/icons";
import {
  NATURE_LABELS,
  type Category,
  type ExpenseNature,
  type Transaction,
  type TransactionCreate,
  type TransactionList,
  type TransactionType,
} from "../lib/types";

export function Transactions() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const txQ = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.get<TransactionList>("/transactions", { page_size: 100 }),
  });
  const catQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

  const catName = (id: string) =>
    catQ.data?.find((c) => c.id === id)?.name ?? "";

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Movimientos</h1>
        <Button onClick={() => setShowAdd(true)}>
          <PlusIcon width={18} height={18} />
          Nuevo
        </Button>
      </div>

      {txQ.isLoading ? (
        <div className="grid place-items-center py-20 text-muted">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (txQ.data?.items.length ?? 0) === 0 ? (
        <Card className="py-14 text-center">
          <p className="text-fg">Aún no tienes movimientos.</p>
          <p className="mt-1 text-sm text-muted">
            Agrega tu primer ingreso o gasto con el botón “Nuevo”.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="divide-y divide-border">
            {txQ.data!.items.map((t) => (
              <Row
                key={t.id}
                tx={t}
                category={catName(t.category_id)}
                onDelete={() => del.mutate(t.id)}
              />
            ))}
          </div>
        </Card>
      )}

      <AddModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        categories={(catQ.data ?? []).filter((c) => !c.is_archived)}
      />
    </div>
  );
}

function Row({
  tx,
  category,
  onDelete,
}: {
  tx: Transaction;
  category: string;
  onDelete: () => void;
}) {
  const income = tx.type === "income";
  return (
    <div className="group flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-full ${
            income ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
          }`}
        >
          {income ? <ArrowDownIcon width={18} height={18} /> : <ArrowUpIcon width={18} height={18} />}
        </span>
        <div>
          <p className="text-sm font-semibold text-fg">{tx.description || category}</p>
          <p className="text-xs text-muted">
            {category}
            {tx.source === "receipt_scan" && " · 📷"} · {formatDate(tx.transaction_date)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${income ? "text-success" : "text-fg"}`}>
          {formatMoney(tx.amount, tx.currency)}
        </span>
        <button
          onClick={onDelete}
          className="text-xs text-muted opacity-0 transition hover:text-danger group-hover:opacity-100"
          aria-label="Eliminar"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function AddModal({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [nature, setNature] = useState<ExpenseNature>("fixed");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (payload: TransactionCreate) =>
      api.post<Transaction>("/transactions", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["by-category"] });
      qc.invalidateQueries({ queryKey: ["recent"] });
      reset();
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Error"),
  });

  function reset() {
    setType("expense");
    setAmount("");
    setCategoryId("");
    setNature("fixed");
    setDate(todayISO());
    setDescription("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    if (!categoryId) {
      setError("Selecciona una categoría.");
      return;
    }
    create.mutate({
      type,
      amount,
      transaction_date: date,
      category_id: categoryId,
      expense_nature: type === "expense" ? nature : null,
      description: description || null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo movimiento">
      <div className="space-y-4">
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                type === t ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
              }`}
            >
              {t === "income" ? "Ingreso" : "Gasto"}
            </button>
          ))}
        </div>

        <Field label="Monto">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>

        <Field label="Categoría">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-fg focus:border-primary/50 focus:outline-none"
          >
            <option value="">Selecciona…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {type === "expense" && (
          <Field label="Naturaleza del gasto">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
              {(["fixed", "variable", "discretionary"] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setNature(n)}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    nature === n ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  {NATURE_LABELS[n]}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Descripción">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </div>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? <Spinner /> : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
