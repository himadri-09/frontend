// src/components/DocumentUpload.tsx
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Upload, FileText, Globe, Link, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export interface DocumentUploadProps {
  /**
   * Called with:
   *   - PDF mode:         files[], no URL, no sheetFiles
   *   - Website mode:     no files, websiteUrl
   *   - Spreadsheet mode: no files, no URL, sheetFiles[]
   * The parent (Documents.tsx) decides which API to hit based on args.
   */
  onUpload: (
    files: File[],
    websiteUrl?: string,
    sheetFiles?: File[],
  ) => Promise<void>;
  onClose: () => void;
}

type Mode = 'pdf' | 'website' | 'spreadsheet';

const SPREADSHEET_EXTS = ['.csv', '.xlsx', '.xlsm', '.xls'];
const SPREADSHEET_MIME = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
];

const isSpreadsheetFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  if (SPREADSHEET_EXTS.some((ext) => name.endsWith(ext))) return true;
  if (SPREADSHEET_MIME.includes(file.type)) return true;
  return false;
};

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUpload, onClose }) => {
  const [mode, setMode] = useState<Mode>('pdf');

  // PDF mode
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Spreadsheet mode
  const [sheetFiles, setSheetFiles] = useState<File[]>([]);

  // Website mode
  const [websiteUrl, setWebsiteUrl] = useState('');

  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // ── PDF handlers ────────────────────────────────────────────────────────
  const handlePdfSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const pdfFiles = files.filter((f) => f.type === 'application/pdf');
      if (pdfFiles.length !== files.length) {
        toast({
          title: 'Invalid files',
          description: 'Only PDF files are allowed in this tab',
          variant: 'destructive',
        });
      }
      setSelectedFiles(pdfFiles);
    },
    [toast],
  );

  const handlePdfDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const pdfFiles = files.filter((f) => f.type === 'application/pdf');
      if (pdfFiles.length !== files.length) {
        toast({
          title: 'Invalid files',
          description: 'Only PDF files are allowed in this tab',
          variant: 'destructive',
        });
      }
      setSelectedFiles(pdfFiles);
    },
    [toast],
  );

  const removePdfFile = (i: number) =>
    setSelectedFiles((fs) => fs.filter((_, idx) => idx !== i));

  // ── Spreadsheet handlers ────────────────────────────────────────────────
  const handleSheetSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const good = files.filter(isSpreadsheetFile);
      if (good.length !== files.length) {
        toast({
          title: 'Invalid files',
          description: 'Only CSV or Excel files are allowed',
          variant: 'destructive',
        });
      }
      setSheetFiles(good);
    },
    [toast],
  );

  const handleSheetDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const good = files.filter(isSpreadsheetFile);
      if (good.length !== files.length) {
        toast({
          title: 'Invalid files',
          description: 'Only CSV or Excel files are allowed',
          variant: 'destructive',
        });
      }
      setSheetFiles(good);
    },
    [toast],
  );

  const removeSheetFile = (i: number) =>
    setSheetFiles((fs) => fs.filter((_, idx) => idx !== i));

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // ── URL validation ──────────────────────────────────────────────────────
  const isValidUrl = (url: string) => {
    try {
      const p = new URL(url);
      return p.protocol === 'http:' || p.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (mode === 'pdf') {
      if (selectedFiles.length === 0) return;
      setUploading(true);
      try {
        await onUpload(selectedFiles, undefined, undefined);
      } catch {
        toast({ title: 'Upload failed', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    } else if (mode === 'website') {
      if (!isValidUrl(websiteUrl)) {
        toast({
          title: 'Invalid URL',
          description: 'Please enter a valid http:// or https:// URL',
          variant: 'destructive',
        });
        return;
      }
      setUploading(true);
      try {
        await onUpload([], websiteUrl, undefined);
      } catch {
        toast({ title: 'Crawl failed', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    } else {
      // spreadsheet
      if (sheetFiles.length === 0) return;
      setUploading(true);
      try {
        await onUpload([], undefined, sheetFiles);
      } catch {
        toast({ title: 'Spreadsheet upload failed', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    }
  };

  const canSubmit =
    mode === 'pdf'
      ? selectedFiles.length > 0
      : mode === 'website'
        ? websiteUrl.length > 0 && isValidUrl(websiteUrl)
        : sheetFiles.length > 0;

  // ── Tab button helper ───────────────────────────────────────────────────
  const TabButton = ({
    value,
    icon,
    label,
    onClick,
  }: {
    value: Mode;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
        mode === value
          ? 'bg-white shadow-sm text-gray-900'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">Add knowledge source</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={uploading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="px-6 pb-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <TabButton
              value="pdf"
              icon={<FileText className="h-4 w-4" />}
              label="PDF"
              onClick={() => {
                setMode('pdf');
                setWebsiteUrl('');
                setSheetFiles([]);
              }}
            />
            <TabButton
              value="website"
              icon={<Globe className="h-4 w-4" />}
              label="Website"
              onClick={() => {
                setMode('website');
                setSelectedFiles([]);
                setSheetFiles([]);
              }}
            />
            <TabButton
              value="spreadsheet"
              icon={<FileSpreadsheet className="h-4 w-4" />}
              label="Spreadsheet"
              onClick={() => {
                setMode('spreadsheet');
                setSelectedFiles([]);
                setWebsiteUrl('');
              }}
            />
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5">
          {/* PDF mode */}
          {mode === 'pdf' && (
            <>
              <div
                onDrop={handlePdfDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 transition-colors cursor-pointer"
                onClick={() => document.getElementById('pdf-upload')?.click()}
              >
                <Upload className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-3">
                  Drag and drop PDF files here, or
                </p>
                <Input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handlePdfSelect}
                  className="hidden"
                  id="pdf-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    document.getElementById('pdf-upload')?.click();
                  }}
                >
                  Browse files
                </Button>
                <p className="text-xs text-gray-400 mt-3">PDF files up to 50 MB</p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      </div>
                      <button
                        onClick={() => removePdfFile(i)}
                        className="text-gray-400 hover:text-gray-600 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Website mode */}
          {mode === 'website' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Website URL
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://docs.example.com/"
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  />
                </div>
                {websiteUrl && !isValidUrl(websiteUrl) && (
                  <p className="text-xs text-red-500 mt-1">
                    Please enter a valid URL starting with http:// or https://
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium text-blue-800">What gets crawled</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    All pages reachable from the URL you enter
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    Text content, headings, and inline images
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    Up to 100 pages by default
                  </li>
                </ul>
                <p className="text-xs text-blue-600 mt-1">
                  Crawling runs in the background. You can leave this page.
                </p>
              </div>
            </div>
          )}

          {/* Spreadsheet mode */}
          {mode === 'spreadsheet' && (
            <>
              <div
                onDrop={handleSheetDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 transition-colors cursor-pointer"
                onClick={() => document.getElementById('sheet-upload')?.click()}
              >
                <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-3">
                  Drag and drop CSV or Excel files here, or
                </p>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xlsm,.xls"
                  multiple
                  onChange={handleSheetSelect}
                  className="hidden"
                  id="sheet-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    document.getElementById('sheet-upload')?.click();
                  }}
                >
                  Browse files
                </Button>
                <p className="text-xs text-gray-400 mt-3">
                  .csv, .xlsx, .xlsm, .xls · up to 100 MB
                </p>
              </div>

              {sheetFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {sheetFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        onClick={() => removeSheetFile(i)}
                        className="text-gray-400 hover:text-gray-600 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 space-y-1.5 mt-4">
                <p className="text-xs font-medium text-emerald-800">
                  How spreadsheet data is used
                </p>
                <ul className="text-xs text-emerald-700 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    CSV → 1 table · Excel → 1 table per sheet
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    Queries like "count", "average", "top N" run as SQL
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    Raw data preserved — no cleaning applied
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || uploading}
            className="min-w-[120px]"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                {mode === 'pdf'
                  ? 'Uploading…'
                  : mode === 'website'
                    ? 'Starting…'
                    : 'Processing…'}
              </span>
            ) : mode === 'pdf' ? (
              `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ''} file${
                selectedFiles.length !== 1 ? 's' : ''
              }`
            ) : mode === 'website' ? (
              'Crawl website'
            ) : (
              `Upload ${sheetFiles.length > 0 ? sheetFiles.length : ''} spreadsheet${
                sheetFiles.length !== 1 ? 's' : ''
              }`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;