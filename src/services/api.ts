
// const API_BASE_URL = import.meta.env.VITE_API_BASE_UR;
// const API_BASE_URL ="https://ragpdfsystem.azurewebsites.net/"
const API_BASE_URL="http://127.0.0.1:5000"
export interface Document {
  id: string;
  name: string;
  pdf_name: string;
  date: string;
  size: string;
  status: 'Processing' | 'Analyzed' | 'Failed';
  chunk_count?: number;
  blob_url?: string;
}

export interface ProcessingJob {
  job_id: string;
  status: string;
  message?: string;
  error?: string;
  stage?: string;
  elapsed_time?: number;
  chunk_count?: number;
  pdf_name?: string;
  file_name?: string;
  file_size_mb?: number;
}

export interface ChatResponse {
  answer: string;
  sources: Array<{
    type: string;
    page: number;
    content_preview: string;
  }>;
}


class ApiService {
  async uploadDocument(file: File): Promise<ProcessingJob> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return response.json();
  }
  
  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    const response = await fetch(`${API_BASE_URL}/status/${jobId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get job status');
    }
    
    return response.json();
  }
  
  async getAllDocuments(): Promise<Document[]> {
    const response = await fetch(`${API_BASE_URL}/documents`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    
    const data = await response.json();
    return data.documents;
  }
  
  async deleteDocument(documentId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
  }
  
  async getProcessedDocuments(): Promise<Array<{id: string, name: string}>> {
    const response = await fetch(`${API_BASE_URL}/documents/processed`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch processed documents');
    }
    
    const data = await response.json();
    return data.documents;
  }
  
  async queryDocument(query: string, pdfName?: string): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        pdf_name: pdfName,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Query failed');
    }
    
    return response.json();
  }
}

export const apiService = new ApiService();
