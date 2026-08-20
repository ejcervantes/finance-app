import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useMonth } from "../context/MonthContext";
import { formatMoney, formatDate, todayISO } from "../lib/format";
import { Button, Card, Field, Input, Spinner } from "../components/ui";
import { Modal } from "../components/Modal";
import { MonthNav } from "../components/MonthNav";
import { ArrowDownIcon, ArrowUpIcon, CameraIcon, PlusIcon, UploadIcon } from "../components/icons";
import {
  NATURE_LABELS,
  type Category,
  type ExpenseNature,
  type ReceiptScanResponse,
  type Transaction,
  type TransactionCreate,
  type TransactionList,
  type TransactionType,
} from "../lib/types";

const INVALIDATE = ["transactions", "summary", "by-category", "by-nature", "trend", "budgets-report"];

interface ModalState {
  open: boolean;
  editing: Transaction | null;
  draft: ReceiptScanResponse | null;
}

export function Transactions() {
  const { range, label } = useMonth();
  const navigate = useNavigate();
  const [modal, setModal] = useState<ModalState>({ open: false, editing: null, draft: null });
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const txQ = useQuery({
    queryKey: ["transactions", range.from],
    queryFn: () => api.get<TransactionList>("/transactions", { page_size: 100, date_from: range.from, date_to: range.to }),
  });
  const catQ = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });
  const catName = (id: string) => catQ.data?.find((c) => c.id === id)?.name ?? "";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanError(null);
    setScanning(true);
    try {
      const draft = await api.uploadImage<ReceiptScanResponse>("/transactions/scan", file);
      setModal({ open: true, editing: null, draft });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "No se pudo escanear el recibo.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Movimientos</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNav />
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <Button variant="secondary" onClick={() => navigate("/importar")}>
            <UploadIcon width={18} height={18} />
            Importar
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <CameraIcon width={18} height={18} />
            Escanear
          </Button>
          <Button onClick={() => setModal({ open: true, editing: null, draft: null })}>
            <PlusIcon width={18} height={18} />
            Nuevo
          </Button>
        </div>
      </div>

      {scanError && <p className="text-sm font-medium text-danger">{scanError}</p>}

      {txQ.isLoading ? (
        <div className="grid place-items-center py-20 text-muted"><Spinner className="h-8 w-8" /></div>
      ) : (txQ.data?.items.length ?? 0) === 0 ? (
        <Card className="py-14 text-center">
          <p className="text-fg">Sin movimientos en {label.toLowerCase()}.</p>
          <p className="mt-1 text-sm text-muted">Agrega uno con “Nuevo”, escanea un recibo, o cambia de mes.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {txQ.data!.items.map((t) => (
              <li key={t.id}>
                <button onClick={() => setModal({ open: true, editing: t, draft: null })} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-surface-2">
                  <span className={`grid h-10 w-10 flex-none place-items-center rounded-full ${t.type === "income" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                    {t.type === "income" ? <ArrowDownIcon width={18} height={18} /> : <ArrowUpIcon width={18} height={18} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg">{t.description || catName(t.category_id)}</span>
                    <span className="block text-xs text-muted">{catName(t.category_id)}{t.source === "receipt_scan" && " · 📷"} · {formatDate(t.transaction_date)}</span>
                  </span>
                  <span className={`ml-auto text-sm font-semibold ${t.type === "income" ? "text-success" : "text-fg"}`}>{formatMoney(t.amount, t.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {scanning && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-8 py-6 shadow-xl">
            <Spinner className="h-7 w-7 text-primary" />
            <p className="text-sm font-semibold text-fg">Analizando recibo con IA…</p>
          </div>
        </div>
      )}

      {modal.open && (
        <TransactionModal
          editing={modal.editing}
          draft={modal.draft}
          categories={catQ.data ?? []}
          defaultDate={range.to > todayISO() ? todayISO() : range.to}
          onClose={() => setModal({ open: false, editing: null, draft: null })}
        />
      )}
    </div>
  );
}

function TransactionModal({
  editing,
  draft,
  categories,
  defaultDate,
  onClose,
}: {
  editing: Transaction | null;
  draft: ReceiptScanResponse | null;
  categories: Category[];
  defaultDate: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<TransactionType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing?.amount ?? draft?.amount ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? draft?.suggested_category_id ?? "");
  const [nature, setNature] = useState<ExpenseNature>(editing?.expense_nature ?? draft?.suggested_expense_nature ?? "fixed");
  const [date, setDate] = useState(editing?.transaction_date ?? draft?.transaction_date ?? defaultDate);
  const [description, setDescription] = useState(editing?.description ?? draft?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const options = categories.filter((c) => c.type === type && !c.is_archived);

  function pickType(t: TransactionType) {
    setType(t);
    if (categoryId && !categories.some((c) => c.id === categoryId && c.type === t)) setCategoryId("");
  }
  function pickCategory(id: string) {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    if (type === "expense" && cat?.default_nature) setNature(cat.default_nature);
  }

  const save = useMutation({
    mutationFn: (payload: TransactionCreate) =>
      editing ? api.patch<Transaction>(`/transactions/${editing.id}`, payload) : api.post<Transaction>("/transactions", payload),
    onSuccess: () => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Error"),
  });
  const del = useMutation({
    mutationFn: () => api.del(`/transactions/${editing!.id}`),
    onSuccess: () => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onClose(); },
  });

  function submit() {
    setError(null);
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) return setError("Ingresa un monto válido.");
    if (!categoryId) return setError("Selecciona una categoría.");
    save.mutate({
      type,
      amount,
      transaction_date: date,
      category_id: categoryId,
      expense_nature: type === "expense" ? nature : null,
      description: description || null,
      receipt_id: draft?.receipt_id ?? null,
    });
  }

  const title = editing ? "Editar movimiento" : draft ? "Confirmar recibo" : "Nuevo movimiento";

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        {draft && (
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-fg">✨ Escaneado con IA — revisa y confirma</p>
            {draft.reasoning && <p className="mt-1 text-xs text-muted">{draft.reasoning}</p>}
            {draft.confidence !== null && <p className="mt-1 text-xs text-muted">Confianza: {Math.round(draft.confidence * 100)}%</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["income", "expense"] as const).map((t) => (
            <button key={t} onClick={() => pickType(t)} className={`rounded-lg py-2 text-sm font-semibold transition ${type === t ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}>
              {t === "income" ? "Ingreso" : "Gasto"}
            </button>
          ))}
        </div>

        <Field label="Monto"><Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>

        <Field label="Categoría">
          <select value={categoryId} onChange={(e) => pickCategory(e.target.value)} className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-fg focus:border-primary/50 focus:outline-none">
            <option value="">Selecciona…</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        {type === "expense" && (
          <Field label="Naturaleza del gasto">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
              {(["fixed", "variable", "discretionary"] as const).map((n) => (
                <button key={n} onClick={() => setNature(n)} className={`rounded-lg py-2 text-xs font-semibold transition ${nature === n ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}>{NATURE_LABELS[n]}</button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Descripción"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" /></Field>
        </div>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          {editing && (
            <Button variant="ghost" onClick={() => del.mutate()} className="text-danger hover:bg-danger/10" disabled={del.isPending}>Eliminar</Button>
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
