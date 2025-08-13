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

  const fetchDocuments = async () => {
    try {
      const docs = await apiService.getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const deleteDocument = async (id: string) => {
    try {
      await apiService.deleteDocument(id);
      await fetchDocuments(); // Refresh the list
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
        
        // Add to processing jobs
        setProcessingJobs(prev => new Map(prev.set(job.job_id, job)));
        
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
    const pollInterval = setInterval(async () => {
      try {
        const status = await apiService.getJobStatus(jobId);
        
        setProcessingJobs(prev => new Map(prev.set(jobId, status)));
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          setProcessingJobs(prev => {
            const newMap = new Map(prev);
            newMap.delete(jobId);
            return newMap;
          });
          
          // Refresh documents list
          await fetchDocuments();
          
          toast({
            title: status.status === 'completed' ? "Processing Complete" : "Processing Failed",
            description: status.message || status.error,
            variant: status.status === 'completed' ? "default" : "destructive",
          });
        }
      } catch (error) {
        clearInterval(pollInterval);
        setProcessingJobs(prev => {
          const newMap = new Map(prev);
          newMap.delete(jobId);
          return newMap;
        });
      }
    }, 2000); // Poll every 2 seconds
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
              onClick={fetchDocuments}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
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
                  <span className="font-medium">Processing...</span>
                  <span className="text-sm text-gray-600">{job.stage}</span>
                </div>
                <Progress value={job.status === 'processing' ? 50 : 10} className="w-full" />
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
              {documents.map((doc) => (
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      doc.status === 'Analyzed'
                        ? 'bg-green-100 text-green-800'
                        : doc.status === 'Processing'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {doc.status}
                    </span>
                    {doc.chunk_count && (
                      <div className="text-xs text-gray-500 mt-1">
                        {doc.chunk_count} chunks
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {doc.blob_url && (
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {documents.length === 0 && (
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
