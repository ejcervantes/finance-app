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
