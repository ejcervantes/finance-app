import type { ChartColors } from "../../lib/chartColors";
import type { TrendItem } from "../../lib/types";
import { formatMoney, shortMonth } from "../../lib/format";

const nf = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 });
const kAxis = (v: number) => `${nf.format(Math.round(v / 1000))}k`;
const axisText = { fill: "var(--muted)" } as const;
const gridLine = { stroke: "var(--border)" } as const;

/* ---------- Barras agrupadas: ingresos vs gastos ---------- */
export function GroupedBars({ trend, colors }: { trend: TrendItem[]; colors: ChartColors }) {
  const W = 640, H = 250, padL = 8, padR = 8, padT = 14, padB = 28;
  const plotH = H - padT - padB, plotW = W - padL - padR;
  const max = Math.max(1, ...trend.flatMap((t) => [Number(t.income), Number(t.expense)]));
  const gw = plotW / Math.max(1, trend.length), bw = Math.min(26, gw / 3.4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 1, 2, 3].map((i) => {
        const y = padT + plotH * (i / 3);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} style={gridLine} strokeOpacity={0.7} />
            <text x={padL} y={y - 4} style={axisText} fontSize={11} fontWeight={600}>{kAxis(max * (1 - i / 3))}</text>
          </g>
        );
      })}
      {trend.map((t, i) => {
        const cx = padL + gw * i + gw / 2;
        const bars: [number, string, number][] = [
          [Number(t.income), colors.income, -1],
          [Number(t.expense), colors.expense, 1],
        ];
        return (
          <g key={t.month}>
            {bars.map(([val, col, side], j) => {
              const h = (val / max) * plotH;
              const x = cx + side * 3 + (side < 0 ? -bw : 0);
              return (
                <rect key={j} x={x} y={padT + plotH - h} width={bw} height={h} rx={4} fill={col}>
                  <title>{`${shortMonth(t.month)} · ${j === 0 ? "Ingresos" : "Gastos"}: ${formatMoney(String(val))}`}</title>
                </rect>
              );
            })}
            <text x={cx} y={H - 9} textAnchor="middle" style={axisText} fontSize={11} fontWeight={600}>{shortMonth(t.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Dona por categoría ---------- */
function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  const rad = ((a - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
export function Donut({
  data,
  colors,
  totalLabel,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  totalLabel: string;
}) {
  const S = 190, th = 30, cx = S / 2, cy = S / 2, r = (S - th) / 2;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let ang = 0;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S}>
      {data.map((d, i) => {
        const frac = d.value / total, gap = 2.5;
        const a0 = ang + gap, a1 = ang + frac * 360 - gap;
        ang += frac * 360;
        const [x0, y0] = polar(cx, cy, r, a0);
        const [x1, y1] = polar(cx, cy, r, a1);
        const large = a1 - a0 > 180 ? 1 : 0;
        return (
          <path key={i} d={`M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`} fill="none" stroke={colors[i % colors.length]} strokeWidth={th}>
            <title>{`${d.name}: ${formatMoney(String(d.value))}`}</title>
          </path>
        );
      })}
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={12} fontWeight={600} style={axisText}>Gasto</text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize={16} fontWeight={800} style={{ fill: "var(--fg)" }}>{totalLabel}</text>
    </svg>
  );
}

/* ---------- Barra apilada (naturaleza) ---------- */
export function StackedBar({
  data,
  colors,
  dark,
}: {
  data: { name: string; value: number }[];
  colors: string[];
  dark: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex h-11 gap-0.5 overflow-hidden rounded-xl">
      {data.map((d, i) => {
        const pct = Math.round((d.value / total) * 100);
        return (
          <div
            key={i}
            className="grid min-w-[26px] place-items-center text-xs font-extrabold"
            style={{ flex: d.value || 0.001, background: colors[i % colors.length], color: dark ? "#0d363f" : "#fff" }}
            title={`${d.name}: ${formatMoney(String(d.value))} (${pct}%)`}
          >
            {pct >= 10 ? `${pct}%` : ""}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Área: ahorro acumulado ---------- */
export function AreaChart({ trend, colors }: { trend: TrendItem[]; colors: ChartColors }) {
  const W = 1000, H = 220, padL = 58, padR = 14, padT = 16, padB = 28;
  const plotH = H - padT - padB, plotW = W - padL - padR;
  const vals = trend.map((t) => Number(t.cumulative));
  const min = Math.min(...vals) * 0.98, max = Math.max(...vals, 1) * 1.02;
  const span = max - min || 1;
  const X = (i: number) => padL + plotW * (i / Math.max(1, trend.length - 1));
  const Y = (v: number) => padT + plotH * (1 - (v - min) / span);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${X(i)} ${Y(v)}`).join(" ");
  const area = `${line} L${X(vals.length - 1)} ${padT + plotH} L${X(0)} ${padT + plotH} Z`;
  const last = vals.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.income} stopOpacity={0.3} />
          <stop offset="100%" stopColor={colors.income} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => {
        const y = padT + plotH * (i / 3);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} style={gridLine} strokeOpacity={0.7} />
            <text x={padL - 8} y={y + 4} textAnchor="end" style={axisText} fontSize={11} fontWeight={600}>{kAxis(max - span * (i / 3))}</text>
          </g>
        );
      })}
      <path d={area} fill="url(#areaGrad)" />
      <path d={line} fill="none" stroke={colors.income} strokeWidth={2.5} strokeLinejoin="round" />
      {trend.map((t, i) => (
        <g key={t.month}>
          <circle cx={X(i)} cy={Y(vals[i])} r={i === last ? 5 : 3} fill={i === last ? colors.income : "var(--surface)"} stroke={colors.income} strokeWidth={2}>
            <title>{`${shortMonth(t.month)}: ${formatMoney(t.cumulative)}`}</title>
          </circle>
          <text x={X(i)} y={H - 9} textAnchor="middle" style={axisText} fontSize={11} fontWeight={600}>{shortMonth(t.month)}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Mini-línea del hero (con meses) ---------- */
export function MiniLine({ trend, colors }: { trend: TrendItem[]; colors: ChartColors }) {
  const W = 360, H = 96, padX = 10, padT = 8, padB = 20;
  const plotH = H - padT - padB;
  const vals = trend.map((t) => Number(t.balance));
  const min = Math.min(...vals), max = Math.max(...vals, 1);
  const span = max - min || 1;
  const X = (i: number) => padX + (W - 2 * padX) * (i / Math.max(1, trend.length - 1));
  const Y = (v: number) => padT + plotH * (1 - (v - min) / span);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${X(i)} ${Y(v)}`).join(" ");
  const last = vals.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <path d={line} fill="none" stroke={colors.income} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {trend.map((t, i) => (
        <g key={t.month}>
          {i === last && <circle cx={X(i)} cy={Y(vals[i])} r={4} fill={colors.income} />}
          <text x={X(i)} y={H - 6} textAnchor="middle" style={axisText} fontSize={11} fontWeight={600}>{shortMonth(t.month)}</text>
        </g>
      ))}
    </svg>
  );
}
