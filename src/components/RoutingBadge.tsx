// src/components/RoutingBadge.tsx
import React from 'react';
import { Database, FileText, Zap, HelpCircle } from 'lucide-react';
import { RoutingStrategy } from '@/services/api';

interface RoutingBadgeProps {
  strategy: RoutingStrategy;
  className?: string;
}

const STRATEGY_CONFIG: Record<
  RoutingStrategy,
  { label: string; icon: React.ReactNode; colorClasses: string; title: string }
> = {
  sql: {
    label: 'SQL',
    icon: <Database className="h-3 w-3" />,
    colorClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    title: 'Answer generated from your uploaded spreadsheet data',
  },
  vector: {
    label: 'Docs',
    icon: <FileText className="h-3 w-3" />,
    colorClasses: 'bg-purple-50 text-purple-700 border-purple-200',
    title: 'Answer retrieved from your PDFs / crawled websites',
  },
  hybrid: {
    label: 'Hybrid',
    icon: <Zap className="h-3 w-3" />,
    colorClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    title: 'Answer combined from spreadsheets and documents',
  },
  none: {
    label: 'No data',
    icon: <HelpCircle className="h-3 w-3" />,
    colorClasses: 'bg-gray-50 text-gray-600 border-gray-200',
    title: 'No matching data sources found',
  },
};

/**
 * Small pill shown next to AI messages to indicate which pipeline
 * produced the answer: SQL / Docs / Hybrid / No data.
 */
const RoutingBadge: React.FC<RoutingBadgeProps> = ({ strategy, className = '' }) => {
  const cfg = STRATEGY_CONFIG[strategy] || STRATEGY_CONFIG.none;

  return (
    <span
      title={cfg.title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.colorClasses} ${className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
};

export default RoutingBadge;