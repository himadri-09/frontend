import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, X, FileText } from 'lucide-react';

interface DocumentUploadProps {
  onUpload: (files: File[]) => void;
  onCancel: () => void;
}

const DocumentUpload = ({ onUpload, onCancel }: DocumentUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (files.length > 0) {
      onUpload(files);
    }
  };

  return (
    <Card className="p-6">
      <div
        className={`upload-area ${isDragging ? 'border-primary' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        <p className="mt-2 text-center">Drag and drop files here or click to browse</p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.txt"
        />
        <Button
          onClick={() => document.getElementById('file-upload')?.click()}
          className="upload-button mt-4"
        >
          Select Files
        </Button>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Selected Files</h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="h-8 w-8 text-muted-foreground hover:text-error hover:bg-error-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <Button
              variant="outline"
              onClick={onCancel}
              className="bg-background text-foreground border-border hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              className="bg-primary text-primary-foreground hover:bg-primary-800"
            >
              Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DocumentUpload;
