// src/pages/Documents.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Layout from '@/components/Layout';
import DocumentUpload from '@/components/DocumentUpload';
import {
  FileText,
  Globe,
  FileSpreadsheet,
  Trash2,
  Eye,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  apiService,
  Document,
  ProcessingJob,
  TabularSource,
} from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

// Unified row shape for rendering all three kinds of sources in one table
interface KnowledgeRow {
  kind: 'pdf' | 'web' | 'tabular';
  id: string;             // row-unique id (doc.id for PDF/web, tabular source id for tabular)
  name: string;           // filename or URL
  sub_label?: string;     // sheet name, etc.
  date: string;
  size: string;
  status: 'Processing' | 'Analyzed' | 'Failed';
  rowCount?: number;      // for tabular
  chunkCount?: number;    // for pdf/web
  blob_url?: string;
  source_url?: string;
}

const Documents = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tabularSources, setTabularSources] = useState<TabularSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [processingJobs, setProcessingJobs] = useState<Map<string, ProcessingJob>>(
    new Map(),
  );
  const [showTooltip, setShowTooltip] = useState(false);
  const { toast } = useToast();

  // ─────────────────────────────────────────────────────────────────────────
  // Processing jobs persistence
  // ─────────────────────────────────────────────────────────────────────────

  const getStoredProcessingJobs = (): Map<string, ProcessingJob> => {
    try {
      const stored = localStorage.getItem('processingJobs');
      if (stored) {
        const jobsArray = JSON.parse(stored);
        return new Map(jobsArray.map((job: ProcessingJob) => [job.job_id, job]));
      }
    } catch (error) {
      console.error('Error loading stored jobs:', error);
    }
    return new Map();
  };

  const saveProcessingJobs = (jobs: Map<string, ProcessingJob>) => {
    try {
      const jobsArray = Array.from(jobs.values());
      localStorage.setItem('processingJobs', JSON.stringify(jobsArray));
    } catch (error) {
      console.error('Error saving jobs:', error);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch
  // ─────────────────────────────────────────────────────────────────────────

  const fetchAll = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const [docs, sources] = await Promise.allSettled([
        apiService.getAllDocuments(),
        apiService.getTabularSources(),
      ]);

      if (docs.status === 'fulfilled') {
        setDocuments(docs.value);

        // Clean up processing jobs for completed docs
        const currentJobs = new Map(processingJobs);
        let jobsUpdated = false;
        for (const [jobId, job] of currentJobs.entries()) {
          const matchingDoc = docs.value.find(
            (doc) => doc.pdf_name === job.pdf_name,
          );
          if (
            matchingDoc &&
            (matchingDoc.status === 'Analyzed' || matchingDoc.status === 'Failed')
          ) {
            currentJobs.delete(jobId);
            jobsUpdated = true;
          }
        }
        if (jobsUpdated) {
          setProcessingJobs(currentJobs);
          saveProcessingJobs(currentJobs);
        }
      }

      if (sources.status === 'fulfilled') {
        setTabularSources(sources.value);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch knowledge sources',
        variant: 'destructive',
      });
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  useEffect(() => {
    const storedJobs = getStoredProcessingJobs();
    setProcessingJobs(storedJobs);
    storedJobs.forEach((job, jobId) => {
      if (job.status !== 'completed' && job.status !== 'failed') {
        pollJobStatus(jobId);
      }
    });
  }, []);

  useEffect(() => {
    fetchAll(true);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Delete (PDF/web/tabular)
  // ─────────────────────────────────────────────────────────────────────────

  const deleteRow = async (row: KnowledgeRow) => {
    try {
      if (row.kind === 'tabular') {
        await apiService.deleteTabularSource(row.id);
      } else {
        await apiService.deleteDocument(row.id);
      }
      await fetchAll(false);
      toast({ title: 'Deleted', description: 'Knowledge source removed successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Upload handler (PDF / Website / Spreadsheet)
  // ─────────────────────────────────────────────────────────────────────────

  const handleUpload = async (
    files: File[],
    websiteUrl?: string,
    sheetFiles?: File[],
  ) => {
    // ── Spreadsheet path ────────────────────────────────────────────────
    if (sheetFiles && sheetFiles.length > 0) {
      for (const file of sheetFiles) {
        try {
          const response = await apiService.uploadTabular(file);
          toast({
            title: 'Spreadsheet uploaded',
            description: `${response.filename} → ${response.total_tables} table${
              response.total_tables !== 1 ? 's' : ''
            } created`,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Upload failed';
          toast({
            title: 'Spreadsheet upload failed',
            description: `${file.name}: ${msg}`,
            variant: 'destructive',
          });
        }
      }
      await fetchAll(false);
      setShowUpload(false);
      return;
    }

    // ── Website crawl path ──────────────────────────────────────────────
    if (websiteUrl) {
      try {
        const response = await apiService.crawlWebsite(websiteUrl);
        if (response.status === 'started') {
          const newJobs = new Map(
            processingJobs.set(response.job_id, {
              job_id: response.job_id,
              status: 'processing',
              pdf_name: response.site_slug,
              file_name: websiteUrl,
              stage: 'Starting crawl...',
            }),
          );
          setProcessingJobs(newJobs);
          saveProcessingJobs(newJobs);
          pollJobStatus(response.job_id, true);
          toast({ title: 'Crawl started', description: `Crawling ${websiteUrl}…` });
        }
      } catch (error) {
        toast({
          title: 'Crawl failed',
          description: `Could not crawl ${websiteUrl}`,
          variant: 'destructive',
        });
      }
      setShowUpload(false);
      return;
    }

    // ── PDF path ────────────────────────────────────────────────────────
    for (const file of files) {
      try {
        const response = await apiService.uploadDocument(file);
        const chunkCount = response.chunks_processed || response.chunk_count || 0;

        if (response.status === 'already_exists') {
          toast({
            title: 'Already indexed',
            description: `"${response.pdf_name}" has ${chunkCount} chunks ready.`,
          });
          await fetchAll(false);
        } else if (response.status === 'newly_processed') {
          toast({
            title: 'Upload complete',
            description: `"${response.pdf_name}" — ${chunkCount} chunks indexed.`,
          });
          await fetchAll(false);
        } else if (response.status === 'started') {
          const newJobs = new Map(processingJobs.set(response.job_id, response));
          setProcessingJobs(newJobs);
          saveProcessingJobs(newJobs);
          pollJobStatus(response.job_id);
          toast({
            title: 'Processing started',
            description: `Processing "${file.name}"…`,
          });
        } else {
          toast({
            title: 'Upload complete',
            description: response.message || `Uploaded ${file.name}`,
          });
          await fetchAll(false);
        }
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}`,
          variant: 'destructive',
        });
      }
    }
    setShowUpload(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Job polling (unchanged)
  // ─────────────────────────────────────────────────────────────────────────

  const pollJobStatus = async (jobId: string, isWebCrawl = false) => {
    let pollCount = 0;
    const maxPolls = 300;
    const pollFn = isWebCrawl
      ? apiService.getCrawlStatus.bind(apiService)
      : apiService.getJobStatus.bind(apiService);

    const poll = async () => {
      pollCount++;
      if (pollCount > maxPolls) return;

      try {
        const status = await pollFn(jobId);

        setProcessingJobs((prev) => {
          const updated = new Map(prev);
          if (status.status === 'completed' || status.status === 'failed') {
            updated.delete(jobId);
            fetchAll(false);
          } else {
            updated.set(jobId, { ...status, job_id: jobId });
          }
          saveProcessingJobs(updated);
          return updated;
        });

        if (status.status !== 'completed' && status.status !== 'failed') {
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    };

    poll();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Build unified row list
  // ─────────────────────────────────────────────────────────────────────────

  const formatBytes = (n?: number) => {
    if (!n || n === 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const rows: KnowledgeRow[] = [
    // PDFs and web sources from /documents
    ...documents.map<KnowledgeRow>((doc) => ({
      kind: doc.source_type === 'web' ? 'web' : 'pdf',
      id: doc.id,
      name: doc.name,
      date: doc.date,
      size: doc.size,
      status: doc.status,
      chunkCount: doc.chunk_count,
      blob_url: doc.blob_url,
      source_url: doc.source_url,
    })),
    // Tabular sources from /tabular/sources
    ...tabularSources.map<KnowledgeRow>((t) => ({
      kind: 'tabular',
      id: t.id,
      name: t.original_filename,
      sub_label: t.sheet_name || undefined,
      date: formatDate(t.created_at),
      size: `${t.row_count.toLocaleString()} rows`,
      status:
        t.status === 'completed'
          ? 'Analyzed'
          : t.status === 'partial'
            ? 'Analyzed'
            : t.status === 'failed'
              ? 'Failed'
              : 'Processing',
      rowCount: t.row_count,
    })),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    if (status === 'Analyzed') return 'bg-green-100 text-green-800';
    if (status === 'Failed') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const KindIcon = ({ kind }: { kind: KnowledgeRow['kind'] }) => {
    if (kind === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (kind === 'web') return <Globe className="h-4 w-4 text-blue-500" />;
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
  };

  const kindLabel = (kind: KnowledgeRow['kind']) =>
    kind === 'pdf' ? 'PDF' : kind === 'web' ? 'Website' : 'Spreadsheet';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              Knowledge Sources
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="relative text-gray-400"
              >
                <Info className="h-4 w-4" />
                {showTooltip && (
                  <span className="absolute left-6 top-0 bg-black text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                    PDFs · Websites · Spreadsheets
                  </span>
                )}
              </button>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {rows.length} source{rows.length !== 1 ? 's' : ''} ·{' '}
              {documents.filter((d) => d.source_type === 'pdf').length} PDFs,{' '}
              {documents.filter((d) => d.source_type === 'web').length} websites,{' '}
              {tabularSources.length} spreadsheets
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAll(true)}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-primary text-primary-foreground hover:bg-primary-800"
            >
              <FileText className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </div>
        </div>

        {/* ── Upload modal ── */}
        {showUpload && (
          <DocumentUpload
            onUpload={handleUpload}
            onClose={() => setShowUpload(false)}
          />
        )}

        {/* ── In-progress jobs ── */}
        {processingJobs.size > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Currently Processing</h2>
            {Array.from(processingJobs.values()).map((job) => (
              <div
                key={job.job_id}
                className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {(job.file_name || '').startsWith('http') ? (
                      <Globe className="h-4 w-4 text-blue-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-medium text-sm">
                      {job.file_name || job.pdf_name || 'Processing…'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {job.stage || 'Processing…'}
                  </span>
                </div>
                <Progress
                  value={
                    job.status === 'processing'
                      ? 50
                      : job.status === 'pending'
                        ? 10
                        : job.status === 'completed'
                          ? 100
                          : 0
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Unified sources table ── */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="hover:bg-gray-50">
                  {/* Source */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <KindIcon kind={row.kind} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[320px]">
                          {row.name}
                        </p>
                        {row.sub_label && (
                          <p className="text-xs text-gray-500">
                            Sheet: {row.sub_label}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                      {kindLabel(row.kind)}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.date}
                  </td>

                  {/* Size */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row.size}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                    {row.chunkCount && row.status === 'Analyzed' && (
                      <p className="text-xs text-gray-500 mt-1">
                        {row.chunkCount} chunks
                      </p>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {row.blob_url && row.status === 'Analyzed' && row.kind === 'pdf' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(row.blob_url, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRow(row)}
                        className="text-red-600 hover:text-red-800"
                        disabled={row.status === 'Processing'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && processingJobs.size === 0 && (
            <div className="text-center py-12">
              <div className="flex justify-center gap-3 mb-3">
                <FileText className="h-8 w-8 text-gray-300" />
                <Globe className="h-8 w-8 text-gray-300" />
                <FileSpreadsheet className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">
                No knowledge sources yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload a PDF, crawl a website, or add a spreadsheet to get started.
              </p>
              <Button className="mt-4" onClick={() => setShowUpload(true)}>
                Add your first source
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Documents;