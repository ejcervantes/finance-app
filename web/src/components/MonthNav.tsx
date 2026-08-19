import { useMonth } from "../context/MonthContext";

export function MonthNav() {
  const { label, prev, next, atCurrentMonth } = useMonth();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1">
      <button
        onClick={prev}
        aria-label="Mes anterior"
        className="grid h-8 w-8 place-items-center rounded-lg text-fg transition hover:bg-surface"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span className="min-w-[7.5rem] text-center text-sm font-bold text-fg">{label}</span>
      <button
        onClick={next}
        disabled={atCurrentMonth}
        aria-label="Mes siguiente"
        className="grid h-8 w-8 place-items-center rounded-lg text-fg transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}
