// src/components/ResultChart.tsx
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { detectChartType, ChartSpec } from '@/lib/chartDetector';

interface ResultChartProps {
  rows: Array<Record<string, unknown>>;
  /** Optional override — if provided, used instead of auto-detection. */
  override?: ChartSpec;
  /** Height in px. Default 300. */
  height?: number;
}

// Color palette — colorblind-safe, looks good on white. Loops if more series.
const SERIES_COLORS = [
  '#2563eb', // blue-600
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#84cc16', // lime-500
];

// ─────────────────────────────────────────────────────────────────────────────
// Value formatting
// ─────────────────────────────────────────────────────────────────────────────

/** Coerce any cell to a number safely (returns 0 on failure — Recharts needs it). */
const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** Pretty-print numbers: 1234567 → "1.23M", 1234 → "1.23K". */
const compactFormat = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/** Full formatting (used in tooltips). */
const fullFormat = (v: number): string =>
  v.toLocaleString(undefined, { maximumFractionDigits: 4 });

// ─────────────────────────────────────────────────────────────────────────────
// Single-value display (1 row, N metrics)
// ─────────────────────────────────────────────────────────────────────────────

const SingleValueDisplay: React.FC<{
  row: Record<string, unknown>;
  yKeys: string[];
}> = ({ row, yKeys }) => {
  return (
    <div className="grid gap-4 py-4" style={{ gridTemplateColumns: `repeat(${Math.min(yKeys.length, 4)}, minmax(0, 1fr))` }}>
      {yKeys.map((key, i) => {
        const num = toNumber(row[key]);
        return (
          <div
            key={key}
            className="text-center px-3 py-2 rounded-lg"
            style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] + '15' }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wide truncate"
              style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}
              title={key}
            >
              {key}
            </p>
            <p className="text-2xl font-semibold text-gray-900 mt-1" title={fullFormat(num)}>
              {compactFormat(num)}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini table fallback (used when no chart applies)
// ─────────────────────────────────────────────────────────────────────────────

const MiniTable: React.FC<{ rows: Array<Record<string, unknown>>; maxRows?: number }> = ({
  rows,
  maxRows = 10,
}) => {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  const visible = rows.slice(0, maxRows);

  return (
    <div className="overflow-x-auto py-2">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold text-gray-600">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              {cols.map((c) => (
                <td
                  key={c}
                  className="px-3 py-2 text-gray-800 max-w-[200px] truncate"
                  title={String(row[c] ?? '—')}
                >
                  {row[c] === null || row[c] === undefined ? '—' : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p className="text-xs text-gray-500 px-3 pt-1">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const ResultChart: React.FC<ResultChartProps> = ({ rows, override, height = 300 }) => {
  const spec = useMemo(() => override ?? detectChartType(rows), [rows, override]);

  // Pre-process rows: ensure y-axis values are numbers (Recharts requires it)
  const chartData = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return rows.map((r) => {
      const out: Record<string, unknown> = { ...r };
      for (const k of spec.yKeys) {
        out[k] = toNumber(r[k]);
      }
      return out;
    });
  }, [rows, spec.yKeys]);

  if (!rows || rows.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-6">No results to chart.</div>
    );
  }

  // ── Single-value (big number(s)) ────────────────────────────────────────
  if (spec.kind === 'single') {
    return <SingleValueDisplay row={rows[0]} yKeys={spec.yKeys} />;
  }

  // ── Table fallback ──────────────────────────────────────────────────────
  if (spec.kind === 'table') {
    return <MiniTable rows={rows} />;
  }

  // ── Bar chart ───────────────────────────────────────────────────────────
  if (spec.kind === 'bar' && spec.xKey) {
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={spec.xKey}
              angle={-30}
              textAnchor="end"
              interval={0}
              tick={{ fontSize: 11, fill: '#374151' }}
              height={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#374151' }}
              tickFormatter={compactFormat}
            />
            <Tooltip
              formatter={(v: unknown) => fullFormat(toNumber(v))}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
            {spec.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {spec.yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Line chart ──────────────────────────────────────────────────────────
  if (spec.kind === 'line' && spec.xKey) {
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={spec.xKey}
              tick={{ fontSize: 11, fill: '#374151' }}
              angle={-15}
              textAnchor="end"
              height={45}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#374151' }}
              tickFormatter={compactFormat}
            />
            <Tooltip
              formatter={(v: unknown) => fullFormat(toNumber(v))}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
            {spec.yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {spec.yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Pie chart ───────────────────────────────────────────────────────────
  if (spec.kind === 'pie' && spec.xKey && spec.yKeys[0]) {
    const yKey = spec.yKeys[0];
    const pieData = chartData.map((r) => ({
      name: String(r[spec.xKey!]),
      value: toNumber(r[yKey]),
    }));
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={Math.min(height, 300) / 2.8}
              label={(props: { name?: string; percent?: number }) =>
                `${props.name ?? ''} (${((props.percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: unknown) => fullFormat(toNumber(v))}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Defensive — should never reach here
  return <MiniTable rows={rows} />;
};

export default ResultChart;