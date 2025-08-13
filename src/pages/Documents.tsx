import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Layout from '@/components/Layout';
import DocumentUpload from '@/components/DocumentUpload';
import { FileText, Trash2, Eye, Clock } from 'lucide-react';

interface Document {
  id: number;
  name: string;
  date: string;
  size: string;
  status: 'Processing' | 'Analyzed' | 'Failed';
  progress?: number;
}

const Documents = () => {
  const [documents, setDocuments] = useState<Document[]>([
    { id: 1, name: 'Contract.pdf', date: '2023-10-15', size: '2.4 MB', status: 'Analyzed' },
    { id: 2, name: 'Agreement.pdf', date: '2023-10-14', size: '1.8 MB', status: 'Processing', progress: 45 },
    { id: 3, name: 'Terms.pdf', date: '2023-10-12', size: '3.2 MB', status: 'Analyzed' },
    { id: 4, name: 'Legal Brief.pdf', date: '2023-10-10', size: '5.1 MB', status: 'Analyzed' },
    { id: 5, name: 'NDA.pdf', date: '2023-10-08', size: '1.2 MB', status: 'Failed' },
  ]);

  const [showUpload, setShowUpload] = useState(false);

  const deleteDocument = (id: number) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const handleUpload = (files: File[]) => {
    const newDocuments = files.map((file, index) => ({
      id: documents.length + index + 1,
      name: file.name,
      date: new Date().toISOString().split('T')[0],
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'Processing' as const,
      progress: 0
    }));
    
    setDocuments([...newDocuments, ...documents]);
    setShowUpload(false);
    
    // Simulate progress
    newDocuments.forEach(doc => {
      const interval = setInterval(() => {
        setDocuments(prev => 
          prev.map(d => {
            if (d.id === doc.id) {
              const newProgress = (d.progress || 0) + 10;
              if (newProgress >= 100) {
                clearInterval(interval);
                return { ...d, progress: 100, status: 'Analyzed' as const };
              }
              return { ...d, progress: newProgress };
            }
            return d;
          })
        );
      }, 1000);
    });
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Documents</h1>
          <Button 
            onClick={() => setShowUpload(true)}
            className="bg-primary text-primary-foreground hover:bg-primary-800"
          >
            Upload Document
          </Button>
        </div>

        {showUpload && (
          <div className="mb-6">
            <DocumentUpload onUpload={handleUpload} onCancel={() => setShowUpload(false)} />
          </div>
        )}

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <tr key={doc.id} className="bg-card hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="font-medium">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{doc.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{doc.size}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.status === 'Processing' ? (
                        <div className="w-full max-w-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3 w-3 text-warning" />
                            <span className="text-xs text-warning">Processing</span>
                            <span className="text-xs text-muted-foreground ml-auto">{doc.progress}%</span>
                          </div>
                          <Progress value={doc.progress} className="h-1.5 bg-muted" />
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          doc.status === 'Analyzed' ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
                        }`}>
                          {doc.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-error hover:text-error hover:bg-error-muted"
                          onClick={() => deleteDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Documents;