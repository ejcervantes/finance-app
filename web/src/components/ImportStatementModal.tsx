import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { todayISO } from "../lib/format";
import { Button, Input, Spinner } from "./ui";
import { Modal } from "./Modal";
import { TrashIcon, UploadIcon } from "./icons";
import {
  NATURE_LABELS,
  type BulkResult,
  type Category,
  type ExpenseNature,
  type StatementImportItem,
  type TransactionType,
} from "../lib/types";

interface Row {
  id: number;
  type: TransactionType;
  amount: string;
  category_id: string;
  nature: ExpenseNature;
  date: string;
  description: string;
  error?: string;
}

let rid = 1;
const newRow = (p: Partial<Row> = {}): Row => ({
  id: rid++, type: "expense", amount: "", category_id: "", nature: "fixed", date: todayISO(), description: "", ...p,
});

const INVALIDATE = ["transactions", "summary", "by-category", "by-nature", "trend", "budgets-report"];

export function ImportStatementModal({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function processPdf(file: File) {
    if (file.type !== "application/pdf") return setError("El archivo debe ser un PDF.");
    setError(null);
    setProcessing(true);
    try {
      const items = await api.uploadFile<StatementImportItem[]>("/transactions/import-statement", file);
      if (items.length === 0) {
        setError("No se reconocieron movimientos en el PDF.");
        return;
      }
      const validIds = new Set(categories.map((c) => c.id));
      setRows(
        items.map((it) =>
          newRow({
            type: it.type,
            amount: it.amount ?? "",
            category_id: it.suggested_category_id && validIds.has(it.suggested_category_id) ? it.suggested_category_id : "",
            nature: it.suggested_expense_nature ?? "fixed",
            date: it.transaction_date ?? todayISO(),
            description: it.description ?? "",
          })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar el PDF.");
    } finally {
      setProcessing(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processPdf(file);
  }

  function update(id: number, patch: Partial<Row>) {
    setRows((rs) => rs!.map((r) => (r.id === id ? { ...r, ...patch, error: undefined } : r)));
  }
  function setType(id: number, type: TransactionType) {
    setRows((rs) =>
      rs!.map((r) => {
        if (r.id !== id) return r;
        const keep = categories.some((c) => c.id === r.category_id && c.type === type);
        return { ...r, type, category_id: keep ? r.category_id : "", error: undefined };
      })
    );
  }
  function setCategory(id: number, category_id: string) {
    const cat = categories.find((c) => c.id === category_id);
    setRows((rs) =>
      rs!.map((r) =>
        r.id === id ? { ...r, category_id, nature: r.type === "expense" && cat?.default_nature ? cat.default_nature : r.nature, error: undefined } : r
      )
    );
  }

  const importMut = useMutation({
    mutationFn: (vars: { items: unknown[]; ids: number[] }) => api.post<BulkResult>("/transactions/bulk", { items: vars.items }),
    onSuccess: (res, vars) => {
      if (res.errors.length === 0) {
        INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        onClose();
      } else {
        setRows((rs) => rs!.map((r) => {
          const i = vars.ids.indexOf(r.id);
          const err = res.errors.find((e) => e.index === i);
          return err ? { ...r, error: err.detail } : r;
        }));
        setMessage({ text: `Corrige las ${res.errors.length} fila(s) marcadas.`, ok: false });
      }
    },
    onError: (e) => setMessage({ text: e instanceof Error ? e.message : "Error", ok: false }),
  });

  function doImport() {
    if (!rows) return;
    setMessage(null);
    let bad = false;
    const marked = rows.map((r) => {
      if (!r.amount.trim() || Number(r.amount) <= 0 || Number.isNaN(Number(r.amount))) { bad = true; return { ...r, error: "Monto inválido" }; }
      if (!r.category_id) { bad = true; return { ...r, error: "Falta categoría" }; }
      return { ...r, error: undefined };
    });
    if (bad) { setRows(marked); return setMessage({ text: "Completa las filas marcadas.", ok: false }); }
    const items = rows.map((r) => ({
      type: r.type, amount: r.amount, category_id: r.category_id,
      expense_nature: r.type === "expense" ? r.nature : null, transaction_date: r.date, description: r.description || null,
    }));
    importMut.mutate({ items, ids: rows.map((r) => r.id) });
  }

  return (
    <Modal open onClose={onClose} title="Importar estado de cuenta" size="xl">
      {!rows ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Sube tu estado de cuenta en <b>PDF</b>. La IA reconocerá cada movimiento y luego lo revisas antes de guardar.
          </p>
          {processing ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-2 py-14">
              <Spinner className="h-7 w-7 text-primary" />
              <p className="text-sm font-semibold text-fg">Analizando el estado de cuenta con IA…</p>
            </div>
          ) : (
            <button
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2 py-14 text-muted transition hover:border-primary/50"
            >
              <UploadIcon width={32} height={32} />
              <span className="text-sm font-semibold text-fg">Haz clic o arrastra un PDF aquí</span>
              <span className="text-xs">Estado de cuenta bancario</span>
            </button>
          )}
          <input ref={fileInput} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) processPdf(f); }} />
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {rows.length} movimiento(s) reconocido(s). Revisa y ajusta antes de guardar.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                  <th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Monto</th><th className="px-2 py-2">Categoría</th>
                  <th className="px-2 py-2">Naturaleza</th><th className="px-2 py-2">Fecha</th><th className="px-2 py-2">Descripción</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const options = categories.filter((c) => c.type === r.type && !c.is_archived);
                  return (
                    <tr key={r.id} className={`border-b border-border/60 ${r.error ? "bg-danger/5" : ""}`}>
                      <td className="px-1 py-1.5">
                        <select value={r.type} onChange={(e) => setType(r.id, e.target.value as TransactionType)} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-fg">
                          <option value="expense">Gasto</option><option value="income">Ingreso</option>
                        </select>
                      </td>
                      <td className="px-1 py-1.5"><Input type="number" step="0.01" value={r.amount} onChange={(e) => update(r.id, { amount: e.target.value })} className="w-24" /></td>
                      <td className="px-1 py-1.5">
                        <select value={r.category_id} onChange={(e) => setCategory(r.id, e.target.value)} className="min-w-[8rem] rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-fg">
                          <option value="">Selecciona…</option>
                          {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        {r.type === "expense" ? (
                          <select value={r.nature} onChange={(e) => update(r.id, { nature: e.target.value as ExpenseNature })} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-fg">
                            {(["fixed", "variable", "discretionary"] as const).map((n) => <option key={n} value={n}>{NATURE_LABELS[n]}</option>)}
                          </select>
                        ) : <span className="text-xs text-muted">—</span>}
                      </td>
                      <td className="px-1 py-1.5"><Input type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} className="w-32" /></td>
                      <td className="px-1 py-1.5">
                        <Input value={r.description} onChange={(e) => update(r.id, { description: e.target.value })} className="min-w-[9rem]" />
                        {r.error && <span className="mt-0.5 block text-xs font-medium text-danger">{r.error}</span>}
                      </td>
                      <td className="px-1 py-1.5">
                        <button onClick={() => setRows((rs) => rs!.filter((x) => x.id !== r.id))} aria-label="Quitar" className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
                          <TrashIcon width={15} height={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            {message && <span className={`text-sm font-medium ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</span>}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={doImport} disabled={importMut.isPending || rows.length === 0}>
                {importMut.isPending ? <Spinner /> : `Importar ${rows.length}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
