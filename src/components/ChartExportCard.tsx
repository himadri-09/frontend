// src/components/ChartExportCard.tsx
import React, { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ResultChart from '@/components/ResultChart';
import { detectChartType } from '@/lib/chartDetector';

interface ChartExportCardProps {
  /** The user's original question — shown as the export header. */
  question: string;
  /** SQL result rows (passed straight through to ResultChart). */
  rows: Array<Record<string, unknown>>;
  /** Optional source label (e.g., table name) for the footer. */
  sourceLabel?: string;
  /** Optional timestamp; defaults to now() at component mount. */
  timestamp?: Date;
}

// Sanitize a question into a safe file name fragment
const slugify = (s: string, max = 60): string => {
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, max) || 'chart';
};

const formatTimestamp = (d: Date): string => {
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Wraps a ResultChart with the question text + timestamp + source label,
 * and provides a "Download as PNG" button that snapshots the entire card.
 *
 * The captured DOM node is the inner card div — clean, no extraneous chrome.
 */
const ChartExportCard: React.FC<ChartExportCardProps> = ({
  question,
  rows,
  sourceLabel,
  timestamp,
}) => {
  const captureRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Detect once so we can decide whether the export button makes sense
  const spec = detectChartType(rows);
  const ts = timestamp ?? new Date();

  // Don't render at all if there's nothing to chart
  if (!rows || rows.length === 0) return null;

  const handleExport = async () => {
    if (!captureRef.current) return;
    setExporting(true);
    try {
      // pixelRatio = 2 → retina-quality export
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        // Skip elements with this class (e.g., the export button itself)
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return !node.classList.contains('export-exclude');
        },
      });

      // Trigger download
      const link = document.createElement('a');
      link.download = `${slugify(question)}-${ts.getTime()}.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: 'Exported',
        description: 'Chart saved as PNG',
      });
    } catch (err) {
      console.error('Chart export failed:', err);
      toast({
        title: 'Export failed',
        description: 'Could not generate the PNG. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* This div is what gets captured to PNG */}
      <div ref={captureRef} className="bg-white">
        {/* Header — question */}
        <div className="px-4 pt-4 pb-2 border-b border-gray-100">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
            Question
          </p>
          <p className="text-sm font-medium text-gray-900 leading-snug">
            {question}
          </p>
        </div>

        {/* Chart body */}
        <div className="px-2 py-2">
          <ResultChart rows={rows} />
        </div>

        {/* Footer — source + timestamp */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span className="truncate">
            {sourceLabel ? `Source: ${sourceLabel}` : `${rows.length} row${rows.length !== 1 ? 's' : ''}`}
          </span>
          <span>{formatTimestamp(ts)}</span>
        </div>
      </div>

      {/* Export button — outside the captured area (.export-exclude is the safety net) */}
      {spec.kind !== 'table' && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex justify-end export-exclude">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="export-exclude h-7 text-xs"
          >
            {exporting ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-3 w-3 mr-1.5" />
                Export as PNG
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChartExportCard;