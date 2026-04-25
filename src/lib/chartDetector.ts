// src/lib/chartDetector.ts
/**
 * Pure chart-type detection from SQL result shape.
 *
 * Given the rows returned from a SQL query, decide the best visualization:
 *   - 'single' : one row with 1+ numeric values → big-number display(s)
 *   - 'bar'    : categorical x-axis, 1+ numeric series → bar chart
 *   - 'line'   : date/time x-axis, 1+ numeric series → line chart
 *   - 'pie'    : ONE numeric column + small number of categorical groups
 *   - 'table'  : doesn't fit any chart shape → fall back to data table
 *
 * Returns the chart kind plus which columns to use for axes.
 * Deterministic — same input always returns same output.
 */

export type ChartKind = 'single' | 'bar' | 'line' | 'pie' | 'table';

export interface ChartSpec {
  kind: ChartKind;
  /** The categorical / x-axis column name (for bar/line/pie). */
  xKey?: string;
  /** Numeric columns to plot as series (for bar/line/pie). */
  yKeys: string[];
  /** Human-readable explanation of WHY this chart was chosen. */
  reason: string;
}

// Tunables
const MAX_BAR_CATEGORIES = 30;     // beyond this, bar chart becomes unreadable
const MAX_PIE_SLICES = 8;          // pie charts only legible with few slices
const SYSTEM_COLUMNS = new Set(['_row_id', '_user_id', '_inserted_at', 'primary_key_id']);

// ─────────────────────────────────────────────────────────────────────────────
// Type sniffing
// ─────────────────────────────────────────────────────────────────────────────

const isNumeric = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean') return false;
  if (typeof v === 'string') {
    // Strict numeric check — no NaN, no '12abc'
    const n = Number(v);
    return v.trim() !== '' && Number.isFinite(n);
  }
  return false;
};

const isDateLike = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return false;
  if (v instanceof Date) return !isNaN(v.getTime());
  if (typeof v !== 'string') return false;
  // Common date patterns: ISO 8601, dd/mm/yy, yyyy-mm-dd, etc.
  // Conservative: require at least YYYY or DD-MM-YYYY shape
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(v)) return true;          // 2024-01-15...
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(v)) return true;  // 01/15/24, 15-01-2024
  if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(v)) return true;         // 2024/01/15
  // Bare year? Risky — could be any number. Require 1900-2100 range.
  if (/^(19|20)\d{2}$/.test(v)) return true;
  return false;
};

/**
 * For a column, classify based on what fraction of non-null values look numeric / date-like.
 * Uses a 0.8 threshold to tolerate sparse nulls without misclassifying mixed columns.
 */
type ColumnKind = 'numeric' | 'date' | 'categorical' | 'empty';

const classifyColumn = (rows: Array<Record<string, unknown>>, col: string): ColumnKind => {
  const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== '');
  if (values.length === 0) return 'empty';

  const numCount = values.filter(isNumeric).length;
  const dateCount = values.filter(isDateLike).length;
  const total = values.length;

  // Date check FIRST — date strings can look numeric (e.g., "2024" parses as 2024)
  if (dateCount / total >= 0.8) return 'date';
  if (numCount / total >= 0.8) return 'numeric';
  return 'categorical';
};

// ─────────────────────────────────────────────────────────────────────────────
// Main detector
// ─────────────────────────────────────────────────────────────────────────────

export function detectChartType(rows: Array<Record<string, unknown>>): ChartSpec {
  // Edge cases
  if (!rows || rows.length === 0) {
    return { kind: 'table', yKeys: [], reason: 'No rows returned' };
  }

  // Filter out internal/system columns the LLM might accidentally include
  const allCols = Object.keys(rows[0]).filter((c) => !SYSTEM_COLUMNS.has(c));
  if (allCols.length === 0) {
    return { kind: 'table', yKeys: [], reason: 'No usable columns' };
  }

  // Classify every column
  const kinds: Record<string, ColumnKind> = {};
  for (const c of allCols) kinds[c] = classifyColumn(rows, c);

  const numericCols = allCols.filter((c) => kinds[c] === 'numeric');
  const dateCols = allCols.filter((c) => kinds[c] === 'date');
  const categoricalCols = allCols.filter((c) => kinds[c] === 'categorical');

  // ── Case 1: Single row with numeric values → big-number display ─────────
  if (rows.length === 1 && numericCols.length > 0) {
    return {
      kind: 'single',
      yKeys: numericCols,
      reason: 'Single row with numeric metrics — shown as big numbers',
    };
  }

  // ── Case 2: Date column + numeric column(s) → line chart ────────────────
  if (dateCols.length >= 1 && numericCols.length >= 1) {
    return {
      kind: 'line',
      xKey: dateCols[0],
      yKeys: numericCols,
      reason: `Time series: ${dateCols[0]} on x-axis, ${numericCols.length} numeric series`,
    };
  }

  // ── Case 3: Categorical + numeric, few categories → pie or bar ──────────
  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    const xKey = categoricalCols[0];
    const distinctCats = new Set(rows.map((r) => String(r[xKey]))).size;

    // Pie chart only when: ONE numeric column AND few slices AND values look
    // like "share of a whole" (we can't easily verify this — just use slice count)
    if (numericCols.length === 1 && distinctCats <= MAX_PIE_SLICES && rows.length <= MAX_PIE_SLICES) {
      return {
        kind: 'pie',
        xKey,
        yKeys: numericCols,
        reason: `${distinctCats} categories with single metric — pie chart`,
      };
    }

    if (rows.length <= MAX_BAR_CATEGORIES) {
      return {
        kind: 'bar',
        xKey,
        yKeys: numericCols,
        reason: `${rows.length} categories × ${numericCols.length} metric(s) — bar chart`,
      };
    }

    // Too many categories for a bar chart
    return {
      kind: 'table',
      yKeys: numericCols,
      reason: `${rows.length} categories — too many for a chart, showing table`,
    };
  }

  // ── Case 4: All numeric, multiple rows → bar chart against row index ────
  // (e.g., a query that selects multiple numeric fields for many rows)
  if (numericCols.length > 0 && categoricalCols.length === 0 && dateCols.length === 0) {
    if (rows.length === 1) {
      return {
        kind: 'single',
        yKeys: numericCols,
        reason: 'Single row of numbers',
      };
    }
    // Multiple rows, all numeric — usually means detail data, not a chart
    return {
      kind: 'table',
      yKeys: numericCols,
      reason: 'Numeric detail rows — better shown as table',
    };
  }

  // ── Fallback: table ─────────────────────────────────────────────────────
  return {
    kind: 'table',
    yKeys: numericCols,
    reason: 'No clear chart shape — showing table',
  };
}