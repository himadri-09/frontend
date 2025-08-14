import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Layout from '@/components/Layout';
import DocumentUpload from '@/components/DocumentUpload';
import { FileText, Trash2, Eye, Clock, RefreshCw } from 'lucide-react';
import { apiService, Document, ProcessingJob } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

const Documents = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [processingJobs, setProcessingJobs] = useState<Map<string, ProcessingJob>>(new Map());
  const { toast } = useToast();

  // Helper function to get processing jobs from localStorage
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

  // Helper function to save processing jobs to localStorage
  const saveProcessingJobs = (jobs: Map<string, ProcessingJob>) => {
    try {
      const jobsArray = Array.from(jobs.values());
      localStorage.setItem('processingJobs', JSON.stringify(jobsArray));
    } catch (error) {
      console.error('Error saving jobs:', error);
    }
  };

  const fetchDocuments = async (showLoadingState = false) => {
    if (showLoadingState) {
      setLoading(true);
    }
    
    try {
      const docs = await apiService.getAllDocuments();
      setDocuments(docs);
      
      // Check if any previously processing jobs are now complete
      const currentJobs = new Map(processingJobs);
      let jobsUpdated = false;
      
      for (const [jobId, job] of currentJobs.entries()) {
        const matchingDoc = docs.find(doc => doc.pdf_name === job.pdf_name);
        if (matchingDoc && (matchingDoc.status === 'Analyzed' || matchingDoc.status === 'Failed')) {
          // Job is complete, remove from processing
          currentJobs.delete(jobId);
          jobsUpdated = true;
        }
      }
      
      if (jobsUpdated) {
        setProcessingJobs(currentJobs);
        saveProcessingJobs(currentJobs);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  // Load processing jobs from localStorage on component mount
  useEffect(() => {
    const storedJobs = getStoredProcessingJobs();
    setProcessingJobs(storedJobs);
    
    // Start polling for any stored jobs
    storedJobs.forEach((job, jobId) => {
      if (job.status !== 'completed' && job.status !== 'failed') {
        pollJobStatus(jobId);
      }
    });
  }, []);

  useEffect(() => {
    fetchDocuments(true); // Show loading state on initial load
  }, []);

  // ❌ REMOVED: Auto-refresh every 30 seconds
  // This was causing unnecessary backend calls
  // Now documents are only refreshed when:
  // 1. Component mounts
  // 2. User clicks refresh button
  // 3. After upload/delete operations
  // 4. After processing job completes

  const deleteDocument = async (id: string) => {
    try {
      await apiService.deleteDocument(id);
      await fetchDocuments(false); // Refresh only after successful delete
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async (files: File[]) => {
    for (const file of files) {
      try {
        const job = await apiService.uploadDocument(file);
        
        // Add to processing jobs (uploadDocument now includes pdf_name and file_name)
        const newJobs = new Map(processingJobs.set(job.job_id, job));
        setProcessingJobs(newJobs);
        saveProcessingJobs(newJobs);
        
        // Poll for status updates
        pollJobStatus(job.job_id);
        
        toast({
          title: "Upload Started",
          description: `Processing ${file.name}...`,
        });
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
    setShowUpload(false);
  };

  const pollJobStatus = async (jobId: string) => {
    let pollCount = 0;
    const maxPolls = 300; // Maximum 10 minutes (300 * 2 seconds)
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      try {
        const status = await apiService.getJobStatus(jobId);
        
        // Update processing jobs
        const newJobs = new Map(processingJobs.set(jobId, status));
        setProcessingJobs(newJobs);
        saveProcessingJobs(newJobs);
        
        if (status.status === 'completed' || status.status === 'failed' || pollCount >= maxPolls) {
          clearInterval(pollInterval);
          
          // Remove from processing jobs after a delay to show completion
          setTimeout(() => {
            setProcessingJobs(prev => {
              const updated = new Map(prev);
              updated.delete(jobId);
              saveProcessingJobs(updated);
              return updated;
            });
          }, 3000);
          
          // ✅ ONLY refresh documents when job actually completes
          await fetchDocuments(false);
          
          if (pollCount < maxPolls) {
            toast({
              title: status.status === 'completed' ? "Processing Complete" : "Processing Failed",
              description: status.message || status.error || 
                          `${status.pdf_name || 'Document'} ${status.status === 'completed' ? 'processed successfully' : 'processing failed'}`,
              variant: status.status === 'completed' ? "default" : "destructive",
            });
          } else {
            // Timeout case
            toast({
              title: "Processing Timeout",
              description: "Processing is taking longer than expected. Please check back later.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Don't stop polling on network errors, just log them
        // Only stop if we can't reach the server for too long
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setProcessingJobs(prev => {
            const updated = new Map(prev);
            updated.delete(jobId);
            saveProcessingJobs(updated);
            return updated;
          });
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  // Get combined processing status for documents
  const getDocumentStatus = (doc: Document) => {
    // Check if there's an active processing job for this document
    const activeJob = Array.from(processingJobs.values()).find(
      job => job.pdf_name === doc.pdf_name || job.file_name === doc.name
    );
    
    if (activeJob && (activeJob.status === 'pending' || activeJob.status === 'processing')) {
      return {
        status: 'Processing' as const,
        stage: activeJob.stage || 'Processing...'
      };
    }
    
    // Return the document's actual status from backend
    return {
      status: doc.status,
      stage: null
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Analyzed':
        return 'bg-green-100 text-green-800';
      case 'Processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin h-8 w-8" />
          <span className="ml-2">Loading documents...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Documents</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => fetchDocuments(true)} // Manual refresh only
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-primary text-primary-foreground hover:bg-primary-800"
            >
              <FileText className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>

        {showUpload && (
          <DocumentUpload
            onUpload={handleUpload}
            onClose={() => setShowUpload(false)}
          />
        )}

        {/* Processing Jobs */}
        {processingJobs.size > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Currently Processing</h2>
            {Array.from(processingJobs.values()).map((job) => (
              <div key={job.job_id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {job.file_name || job.pdf_name || 'Processing...'}
                  </span>
                  <span className="text-sm text-gray-600">{job.stage || 'Processing...'}</span>
                </div>
                <Progress 
                  value={
                    job.status === 'processing' ? 50 : 
                    job.status === 'pending' ? 10 : 
                    job.status === 'completed' ? 100 : 25
                  } 
                  className="w-full" 
                />
                {job.elapsed_time && (
                  <div className="text-xs text-gray-500 mt-1">
                    Elapsed: {Math.round(job.elapsed_time)}s
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Documents Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
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
              {documents.map((doc) => {
                const { status, stage } = getDocumentStatus(doc);
                return (
                  <tr key={doc.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                        {status}
                      </span>
                      {stage && (
                        <div className="text-xs text-gray-500 mt-1">
                          {stage}
                        </div>
                      )}
                      {doc.chunk_count && status === 'Analyzed' && (
                        <div className="text-xs text-gray-500 mt-1">
                          {doc.chunk_count} chunks
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {doc.blob_url && status === 'Analyzed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.blob_url, '_blank')}
                          >
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
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by uploading a document.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Documents;