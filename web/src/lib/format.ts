const numberFmt = new Intl.NumberFormat("es-CR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(raw: string, currency = ""): string {
  const value = Number(raw);
  if (Number.isNaN(value)) return raw;
  const text = numberFmt.format(value);
  return currency ? `${text} ${currency}` : text;
}

export function formatDate(iso: string): string {
  // iso: "YYYY-MM-DD"
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function savingsRateText(rate: number | null): string {
  if (rate === null || rate === undefined) return "—";
  return `${Math.round(rate * 100)}%`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Primer día del mes de `d`. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Rango [primer día, último día] del mes de `d` en formato YYYY-MM-DD. */
export function monthRange(d: Date): { from: string; to: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad2(m + 1)}-01`, to: `${y}-${pad2(m + 1)}-${pad2(last)}` };
}

/** "Agosto 2026" a partir de un Date. */
export function monthLabel(d: Date): string {
  return d
    .toLocaleDateString("es", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** "ago" a partir de "2026-08". */
export function shortMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es", { month: "short" }).replace(".", "");
}

/** ¿`d` es el mes actual o uno futuro? (para no navegar al futuro) */
export function isCurrentOrFutureMonth(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() > now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() >= now.getMonth());
}
