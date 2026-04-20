// src/components/SqlResultTable.tsx
import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Table } from 'lucide-react';

interface SqlResultTableProps {
  rows: Array<Record<string, unknown>>;
  /**
   * Kept for backward compatibility with callers that still pass it.
   * No longer rendered — the SQL preview was removed per user request.
   */
  sqlUsed?: string | null;
  maxRowsInitial?: number;
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * Compact, collapsible SQL result table shown under SQL / hybrid answers.
 * Shows "N rows returned" as a header; expands into the full result table.
 */
const SqlResultTable: React.FC<SqlResultTableProps> = ({
  rows,
  maxRowsInitial = 10,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const columns = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    // Preserve column order of the first row
    return Object.keys(rows[0]);
  }, [rows]);

  if (!rows || rows.length === 0) return null;

  const visibleRows = showAll ? rows : rows.slice(0, maxRowsInitial);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Table className="h-4 w-4 text-gray-500" />
          <span className="font-medium">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'} returned
          </span>
          <span className="text-xs text-gray-400">
            · {columns.length} {columns.length === 1 ? 'column' : 'columns'}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-t border-gray-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-2 text-gray-800 whitespace-nowrap max-w-[240px] truncate"
                      title={formatCell(row[col])}
                    >
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Show more */}
          {hiddenCount > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-1.5 text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-200"
            >
              Show {hiddenCount} more {hiddenCount === 1 ? 'row' : 'rows'}
            </button>
          )}

        </div>
      )}
    </div>
  );
};

export default SqlResultTable;