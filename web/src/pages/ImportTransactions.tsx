import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { todayISO } from "../lib/format";
import { Button, Card, Input, Spinner } from "../components/ui";
import { PlusIcon, TrashIcon, UploadIcon } from "../components/icons";
import {
  NATURE_LABELS,
  type BulkResult,
  type Category,
  type ExpenseNature,
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
  id: rid++,
  type: "expense",
  amount: "",
  category_id: "",
  nature: "fixed",
  date: todayISO(),
  description: "",
  ...p,
});

/* ---- Parseo de texto pegado (estado de cuenta) ---- */
function isDateLike(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s);
}
function normalizeDate(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[/-]/).map((p) => p.trim());
  if (parts.length !== 3) return todayISO();
  let [d, m, y] = parts;
  if (y.length === 2) y = "20" + y;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
function normalizeAmount(raw: string): string {
  let s = raw.replace(/[^\d.,-]/g, "");
  s = s.replace(/-/g, "");
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  let dec = "";
  if (lastComma >= 0 && lastDot >= 0) dec = lastComma > lastDot ? "," : ".";
  else if (lastComma >= 0) dec = /,\d{1,2}$/.test(s) ? "," : "";
  else if (lastDot >= 0) dec = /\.\d{1,2}$/.test(s) ? "." : "";
  if (dec === ",") s = s.replace(/\./g, "").replace(",", ".");
  else if (dec === ".") s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  const n = Number(s);
  return Number.isNaN(n) ? "" : String(Math.abs(n));
}
function parsePaste(text: string): Row[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = (line.includes("\t") ? line.split("\t") : line.split(",")).map((f) => f.trim());
      const dateIdx = fields.findIndex(isDateLike);
      const amountIdx = fields.findIndex((f, i) => i !== dateIdx && /\d/.test(f) && normalizeAmount(f) !== "");
      const description = fields.filter((_, i) => i !== dateIdx && i !== amountIdx).join(" ").trim();
      return newRow({
        date: dateIdx >= 0 ? normalizeDate(fields[dateIdx]) : todayISO(),
        amount: amountIdx >= 0 ? normalizeAmount(fields[amountIdx]) : "",
        description,
      });
    });
}

export function ImportTransactions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([newRow(), newRow(), newRow()]);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const catQ = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });
  const cats = catQ.data ?? [];

  function update(id: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, error: undefined } : r)));
  }
  function setType(id: number, type: TransactionType) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const keepCat = cats.some((c) => c.id === r.category_id && c.type === type);
        return { ...r, type, category_id: keepCat ? r.category_id : "", error: undefined };
      })
    );
  }
  function setCategory(id: number, category_id: string) {
    const cat = cats.find((c) => c.id === category_id);
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, category_id, nature: r.type === "expense" && cat?.default_nature ? cat.default_nature : r.nature, error: undefined }
          : r
      )
    );
  }

  const importMut = useMutation({
    mutationFn: (vars: { items: unknown[]; ids: number[] }) =>
      api.post<BulkResult>("/transactions/bulk", { items: vars.items }),
    onSuccess: (res, vars) => {
      const submittedIds = vars.ids;
      if (res.errors.length === 0) {
        ["transactions", "summary", "by-category", "by-nature", "trend", "budgets-report"].forEach((k) =>
          qc.invalidateQueries({ queryKey: [k] })
        );
        setMessage({ text: `Se importaron ${res.created} transacciones.`, ok: true });
        setRows([newRow(), newRow(), newRow()]);
      } else {
        setRows((rs) =>
          rs.map((r) => {
            const i = submittedIds.indexOf(r.id);
            const err = res.errors.find((e) => e.index === i);
            return err ? { ...r, error: err.detail } : r;
          })
        );
        setMessage({ text: `Corrige las ${res.errors.length} fila(s) marcadas. No se importó nada.`, ok: false });
      }
    },
    onError: (e) => setMessage({ text: e instanceof Error ? e.message : "Error", ok: false }),
  });

  function doImport() {
    setMessage(null);
    const toImport = rows.filter((r) => r.amount.trim() || r.category_id || r.description.trim());
    if (toImport.length === 0) return setMessage({ text: "Agrega al menos una fila con datos.", ok: false });

    let hasLocalError = false;
    const marked = rows.map((r) => {
      if (!toImport.includes(r)) return r;
      if (!r.amount.trim() || Number(r.amount) <= 0 || Number.isNaN(Number(r.amount))) {
        hasLocalError = true;
        return { ...r, error: "Monto inválido" };
      }
      if (!r.category_id) {
        hasLocalError = true;
        return { ...r, error: "Falta categoría" };
      }
      return { ...r, error: undefined };
    });
    if (hasLocalError) {
      setRows(marked);
      return setMessage({ text: "Completa las filas marcadas.", ok: false });
    }

    const items = toImport.map((r) => ({
      type: r.type,
      amount: r.amount,
      category_id: r.category_id,
      expense_nature: r.type === "expense" ? r.nature : null,
      transaction_date: r.date,
      description: r.description || null,
    }));
    importMut.mutate({ items, ids: toImport.map((r) => r.id) });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">Importar transacciones</h1>
          <p className="text-sm text-muted">Una fila por movimiento. Revisa y confirma; se importan todas juntas.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/movimientos")}>Volver</Button>
      </div>

      {/* Pegar desde estado de cuenta */}
      <Card className="space-y-3">
        <button onClick={() => setShowPaste((v) => !v)} className="flex w-full items-center gap-2 text-left text-sm font-bold text-fg">
          <UploadIcon width={18} height={18} />
          Pegar desde tu estado de cuenta {showPaste ? "▲" : "▼"}
        </button>
        {showPaste && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Pega las líneas (una por movimiento), con columnas separadas por coma o tabulación.
              Detecta fecha y monto automáticamente; el resto va a la descripción. Luego asigna la
              categoría de cada fila. Ejemplo: <code>20/08/2026, 5000, Supermercado</code>
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder="20/08/2026, 5000, Supermercado&#10;19/08/2026, 12000, Gasolina"
              className="w-full rounded-xl border border-border bg-surface-2 p-3 font-mono text-xs text-fg focus:border-primary/50 focus:outline-none"
            />
            <Button
              variant="secondary"
              onClick={() => {
                const parsed = parsePaste(pasteText);
                if (parsed.length) {
                  setRows((rs) => [...rs.filter((r) => r.amount || r.category_id || r.description), ...parsed]);
                  setPasteText("");
                  setShowPaste(false);
                  setMessage({ text: `${parsed.length} fila(s) agregadas. Asigna sus categorías.`, ok: true });
                }
              }}
            >
              Procesar y agregar filas
            </Button>
          </div>
        )}
      </Card>

      {/* Grilla */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold text-muted">
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Monto</th>
              <th className="px-3 py-3">Categoría</th>
              <th className="px-3 py-3">Naturaleza</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Descripción</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const options = cats.filter((c) => c.type === r.type && !c.is_archived);
              return (
                <tr key={r.id} className={`border-b border-border/60 ${r.error ? "bg-danger/5" : ""}`}>
                  <td className="px-2 py-2">
                    <select value={r.type} onChange={(e) => setType(r.id, e.target.value as TransactionType)} className="rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-fg">
                      <option value="expense">Gasto</option>
                      <option value="income">Ingreso</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" step="0.01" value={r.amount} onChange={(e) => update(r.id, { amount: e.target.value })} placeholder="0.00" className="w-28" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={r.category_id} onChange={(e) => setCategory(r.id, e.target.value)} className="min-w-[9rem] rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-fg">
                      <option value="">Selecciona…</option>
                      {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {r.type === "expense" ? (
                      <select value={r.nature} onChange={(e) => update(r.id, { nature: e.target.value as ExpenseNature })} className="rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-fg">
                        {(["fixed", "variable", "discretionary"] as const).map((n) => <option key={n} value={n}>{NATURE_LABELS[n]}</option>)}
                      </select>
                    ) : <span className="text-xs text-muted">—</span>}
                  </td>
                  <td className="px-2 py-2">
                    <Input type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} className="w-36" />
                  </td>
                  <td className="px-2 py-2">
                    <Input value={r.description} onChange={(e) => update(r.id, { description: e.target.value })} placeholder="Opcional" className="min-w-[10rem]" />
                    {r.error && <span className="mt-1 block text-xs font-medium text-danger">{r.error}</span>}
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label="Quitar fila" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
                      <TrashIcon width={16} height={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setRows((rs) => [...rs, newRow()])}>
          <PlusIcon width={18} height={18} /> Agregar fila
        </Button>
        <div className="flex items-center gap-3">
          {message && <span className={`text-sm font-medium ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</span>}
          <Button onClick={doImport} disabled={importMut.isPending}>
            {importMut.isPending ? <Spinner /> : "Importar transacciones"}
          </Button>
        </div>
      </div>
    </div>
  );
}
