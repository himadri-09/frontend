import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Layout from '@/components/Layout';
import DocumentUpload from '@/components/DocumentUpload';
import { FileText, Globe, Trash2, Eye, RefreshCw, Info } from 'lucide-react';
import { apiService, Document, ProcessingJob } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

const Documents = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [processingJobs, setProcessingJobs] = useState<Map<string, ProcessingJob>>(new Map());
  const [showTooltip, setShowTooltip] = useState(false);
  const { toast } = useToast();

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

  const fetchDocuments = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const docs = await apiService.getAllDocuments();
      setDocuments(docs);

      const currentJobs = new Map(processingJobs);
      let jobsUpdated = false;
      for (const [jobId, job] of currentJobs.entries()) {
        const matchingDoc = docs.find(doc => doc.pdf_name === job.pdf_name);
        if (matchingDoc && (matchingDoc.status === 'Analyzed' || matchingDoc.status === 'Failed')) {
          currentJobs.delete(jobId);
          jobsUpdated = true;
        }
      }
      if (jobsUpdated) {
        setProcessingJobs(currentJobs);
        saveProcessingJobs(currentJobs);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch knowledge sources', variant: 'destructive' });
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  useEffect(() => {
    const storedJobs = getStoredProcessingJobs();
    setProcessingJobs(storedJobs);
    storedJobs.forEach((job, jobId) => {
      if (job.status !== 'completed' && job.status !== 'failed') pollJobStatus(jobId);
    });
  }, []);

  useEffect(() => { fetchDocuments(true); }, []);

  const deleteDocument = async (id: string) => {
    try {
      await apiService.deleteDocument(id);
      await fetchDocuments(false);
      toast({ title: 'Deleted', description: 'Knowledge source removed successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  // ── Upload handler — supports both PDF and web crawl ──────────────
  const handleUpload = async (files: File[], websiteUrl?: string) => {
    // Website crawl path
    if (websiteUrl) {
      try {
        const response = await apiService.crawlWebsite(websiteUrl);

        if (response.status === 'started') {
          const newJobs = new Map(processingJobs.set(response.job_id, {
            job_id:    response.job_id,
            status:    'processing',
            pdf_name:  response.site_slug,
            file_name: websiteUrl,
            stage:     'Starting crawl...',
          }));
          setProcessingJobs(newJobs);
          saveProcessingJobs(newJobs);
          pollJobStatus(response.job_id, true);

          toast({ title: 'Crawl started', description: `Crawling ${websiteUrl}…` });
        }
      } catch (error) {
        toast({ title: 'Crawl failed', description: `Could not crawl ${websiteUrl}`, variant: 'destructive' });
      }
      setShowUpload(false);
      return;
    }

    // PDF upload path (unchanged)
    for (const file of files) {
      try {
        const response = await apiService.uploadDocument(file);
        const chunkCount = response.chunks_processed || response.chunk_count || 0;

        if (response.status === 'already_exists') {
          toast({ title: 'Already indexed', description: `"${response.pdf_name}" has ${chunkCount} chunks ready.` });
          await fetchDocuments(false);
        } else if (response.status === 'newly_processed') {
          toast({ title: 'Upload complete', description: `"${response.pdf_name}" — ${chunkCount} chunks indexed.` });
          await fetchDocuments(false);
        } else if (response.status === 'started') {
          const newJobs = new Map(processingJobs.set(response.job_id, response));
          setProcessingJobs(newJobs);
          saveProcessingJobs(newJobs);
          pollJobStatus(response.job_id);
          toast({ title: 'Processing started', description: `Processing "${file.name}"…` });
        } else {
          toast({ title: 'Upload complete', description: response.message || `Uploaded ${file.name}` });
          await fetchDocuments(false);
        }
      } catch (error) {
        toast({ title: 'Upload failed', description: `Failed to upload ${file.name}`, variant: 'destructive' });
      }
    }
    setShowUpload(false);
  };

  const pollJobStatus = async (jobId: string, isWebCrawl = false) => {
    let pollCount = 0;
    const maxPolls = 300;
    const pollFn = isWebCrawl ? apiService.getCrawlStatus.bind(apiService) : apiService.getJobStatus.bind(apiService);

    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        const status = await pollFn(jobId);
        const newJobs = new Map(processingJobs.set(jobId, status));
        setProcessingJobs(newJobs);
        saveProcessingJobs(newJobs);

        if (status.status === 'completed' || status.status === 'failed' || pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setProcessingJobs(prev => {
            const updated = new Map(prev);
            updated.delete(jobId);
            saveProcessingJobs(updated);
            return updated;
          });
          await fetchDocuments(false);
          if (pollCount < maxPolls) {
            toast({
              title: status.status === 'completed' ? 'Ready' : 'Failed',
              description: status.message || status.error || `${status.pdf_name || 'Source'} ${status.status}`,
              variant: status.status === 'completed' ? 'default' : 'destructive',
            });
          }
        }
      } catch (error) {
        if (pollCount >= maxPolls) clearInterval(pollInterval);
      }
    }, 2000);
  };

  const getDocumentStatus = (doc: Document) => {
    const activeJob = Array.from(processingJobs.values()).find(
      job => job.pdf_name === doc.pdf_name || job.file_name === doc.name
    );
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'processing')) {
      return { status: 'Processing' as const, stage: activeJob.stage || 'Processing...' };
    }
    return { status: doc.status, stage: null };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Analyzed':   return 'bg-green-100 text-green-800';
      case 'Processing': return 'bg-yellow-100 text-yellow-800';
      case 'Failed':     return 'bg-red-100 text-red-800';
      default:           return 'bg-gray-100 text-gray-800';
    }
  };

  // Detect if a document is a web crawl by checking if name looks like a URL
  // or if original_filename starts with http (from source_type field if available)
  const isWebSource = (doc: Document) => {
    const name = doc.name || '';
    return (
      (doc as any).source_type === 'web' ||
      name.startsWith('http://') ||
      name.startsWith('https://')
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin h-8 w-8" />
          <span className="ml-2">Loading knowledge sources…</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">

        {/* ── Header ── */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Knowledge Sources</h1>

            {/* Tooltip */}
            <div className="relative">
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <Info className="h-5 w-5" />
              </button>
              {showTooltip && (
                <div className="absolute left-7 top-0 z-10 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm text-gray-600">
                  <p className="font-medium text-gray-900 mb-1">Supported sources</p>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span><span className="font-medium">PDF documents</span> — upload any PDF up to 50 MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span><span className="font-medium">Websites</span> — crawl any public URL and all its sub-pages</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => fetchDocuments(true)} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowUpload(true)} className="bg-primary text-primary-foreground hover:bg-primary-800">
              <FileText className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </div>
        </div>

        {/* ── Upload modal ── */}
        {showUpload && (
          <DocumentUpload onUpload={handleUpload} onClose={() => setShowUpload(false)} />
        )}

        {/* ── In-progress jobs ── */}
        {processingJobs.size > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Currently Processing</h2>
            {Array.from(processingJobs.values()).map((job) => (
              <div key={job.job_id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {(job.file_name || '').startsWith('http')
                      ? <Globe className="h-4 w-4 text-blue-500" />
                      : <FileText className="h-4 w-4 text-gray-500" />
                    }
                    <span className="font-medium text-sm">{job.file_name || job.pdf_name || 'Processing…'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{job.stage || 'Processing…'}</span>
                </div>
                <Progress
                  value={
                    job.status === 'processing' ? 50 :
                    job.status === 'pending'    ? 10 :
                    job.status === 'completed'  ? 100 : 25
                  }
                  className="w-full"
                />
                {job.elapsed_time && (
                  <p className="text-xs text-gray-400 mt-1">Elapsed: {Math.round(job.elapsed_time)}s</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Table ── */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => {
                const { status, stage } = getDocumentStatus(doc);
                const webSource = isWebSource(doc);
                return (
                  <tr key={doc.id}>
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {webSource
                          ? <Globe className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          : <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {doc.name}
                          </p>
                          {webSource && (
                            <p className="text-xs text-gray-400 truncate max-w-xs">
                              {(doc as any).source_url || doc.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {webSource ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Globe className="h-3 w-3" /> Website
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <FileText className="h-3 w-3" /> PDF
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.date}</td>

                    {/* Size — hide "0 B" for web sources */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {webSource ? '—' : doc.size}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                        {status}
                      </span>
                      {stage && <p className="text-xs text-gray-500 mt-1">{stage}</p>}
                      {doc.chunk_count && status === 'Analyzed' && (
                        <p className="text-xs text-gray-500 mt-1">{doc.chunk_count} chunks</p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {doc.blob_url && status === 'Analyzed' && !webSource && (
                          <Button variant="ghost" size="sm" onClick={() => window.open(doc.blob_url, '_blank')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDocument(doc.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={status === 'Processing'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {documents.length === 0 && processingJobs.size === 0 && (
            <div className="text-center py-12">
              <div className="flex justify-center gap-3 mb-3">
                <FileText className="h-8 w-8 text-gray-300" />
                <Globe className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">No knowledge sources yet</h3>
              <p className="mt-1 text-sm text-gray-500">Upload a PDF or crawl a website to get started.</p>
              <Button className="mt-4" onClick={() => setShowUpload(true)}>Add your first source</Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Documents;