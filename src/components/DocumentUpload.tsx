// components/DocumentUpload.tsx
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Upload, FileText, Globe, Link } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export interface DocumentUploadProps {
  onUpload: (files: File[], websiteUrl?: string) => Promise<void>;
  onClose: () => void;
}

type Mode = 'pdf' | 'website';

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUpload, onClose }) => {
  const [mode, setMode] = useState<Mode>('pdf');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // ── PDF handlers ───────────────────────────────────────────────
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length !== files.length) {
      toast({ title: 'Invalid files', description: 'Only PDF files are allowed', variant: 'destructive' });
    }
    setSelectedFiles(pdfFiles);
  }, [toast]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length !== files.length) {
      toast({ title: 'Invalid files', description: 'Only PDF files are allowed', variant: 'destructive' });
    }
    setSelectedFiles(pdfFiles);
  }, [toast]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const removeFile = (i: number) => setSelectedFiles(fs => fs.filter((_, idx) => idx !== i));

  // ── URL validation ──────────────────────────────────────────────
  const isValidUrl = (url: string) => {
    try {
      const p = new URL(url);
      return p.protocol === 'http:' || p.protocol === 'https:';
    } catch { return false; }
  };

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (mode === 'pdf') {
      if (selectedFiles.length === 0) return;
      setUploading(true);
      try { await onUpload(selectedFiles); }
      catch { toast({ title: 'Upload failed', variant: 'destructive' }); }
      finally { setUploading(false); }
    } else {
      if (!isValidUrl(websiteUrl)) {
        toast({ title: 'Invalid URL', description: 'Please enter a valid http:// or https:// URL', variant: 'destructive' });
        return;
      }
      setUploading(true);
      try { await onUpload([], websiteUrl); }
      catch { toast({ title: 'Crawl failed', variant: 'destructive' }); }
      finally { setUploading(false); }
    }
  };

  const canSubmit = mode === 'pdf' ? selectedFiles.length > 0 : isValidUrl(websiteUrl);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add Knowledge Source</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Mode toggle ── */}
        <div className="px-6 pt-5">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => { setMode('pdf'); setWebsiteUrl(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                mode === 'pdf'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="h-4 w-4" />
              PDF Document
            </button>
            <button
              onClick={() => { setMode('website'); setSelectedFiles([]); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                mode === 'website'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe className="h-4 w-4" />
              Website
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5">

          {/* PDF mode */}
          {mode === 'pdf' && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-3">Drag and drop PDF files here, or</p>
                <Input type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" id="file-upload" />
                <Button variant="outline" size="sm" type="button" onClick={e => { e.stopPropagation(); document.getElementById('file-upload')?.click(); }}>
                  Browse files
                </Button>
                <p className="text-xs text-gray-400 mt-3">PDF files up to 50 MB</p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-gray-600 ml-2">
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
                    onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="https://docs.example.com/"
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  />
                </div>
                {websiteUrl && !isValidUrl(websiteUrl) && (
                  <p className="text-xs text-red-500 mt-1">Please enter a valid URL starting with http:// or https://</p>
                )}
              </div>

              {/* Info box */}
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
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {mode === 'pdf' ? 'Uploading…' : 'Starting…'}
              </span>
            ) : mode === 'pdf' ? (
              `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ''} file${selectedFiles.length !== 1 ? 's' : ''}`
            ) : (
              'Crawl website'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;