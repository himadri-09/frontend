import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// Backend response interface
interface BackendDocument {
  id: string;
  user_id: string;
  pdf_name: string;
  original_filename: string;
  file_size_bytes: number;
  chunks_count: number;
  upload_status: 'pending' | 'processing' | 'completed' | 'failed';
  uploaded_at: string;
  processed_at: string | null;
  blob_url?: string;
}

// Frontend document interface
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
  status: 'already_exists' | 'newly_processed' | 'started' | 'pending' | 'processing' | 'completed' | 'failed' | string;
  message?: string;
  error?: string;
  stage?: string;
  elapsed_time?: number;
  chunk_count?: number;
  chunks_processed?: number;
  pdf_name?: string;
  file_name?: string;
  file_size_mb?: number;
  cached?: boolean;
  requires_polling?: boolean;
}

export interface ChatResponse {
  answer: string;
  conversation_id?: string;
  sources: Array<{
    type: string;
    page: number;
    content_preview: string;
  }>;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  pdf_name?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: Array<{
    type: string;
    page: number;
    content_preview: string;
  }>;
}

class ApiService {
  /**
   * Get authorization header with Supabase access token
   * This automatically handles token refresh via Supabase SDK
   */
  private async getAuthHeader(): Promise<{ Authorization: string }> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      throw new Error('Not authenticated');
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  /**
   * Fetch with automatic Supabase authentication
   * No manual token refresh needed - Supabase handles it!
   */
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const authHeader = await this.getAuthHeader();

    const headers = {
      ...options.headers,
      ...authHeader,
    };

    const response = await fetch(url, { ...options, headers });

    // If 401, session might be expired - try to refresh
    if (response.status === 401) {
      // Supabase will automatically refresh if possible
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expired. Please login again.');
      }

      // Retry with refreshed token
      const retryHeaders = {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
      };

      return fetch(url, { ...options, headers: retryHeaders });
    }

    return response;
  }

  /**
   * Upload document to backend
   */
  async uploadDocument(file: File): Promise<ProcessingJob> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.fetchWithAuth(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/status/${jobId}`);

    if (!response.ok) {
      throw new Error('Failed to get job status');
    }

    return response.json();
  }

  /**
   * Transform backend document to frontend format
   */
  private transformDocument(backendDoc: BackendDocument): Document {
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const mapStatus = (status: string): 'Processing' | 'Analyzed' | 'Failed' => {
      switch (status) {
        case 'completed':
          return 'Analyzed';
        case 'processing':
        case 'pending':
          return 'Processing';
        case 'failed':
          return 'Failed';
        default:
          return 'Processing';
      }
    };

    return {
      id: backendDoc.id,
      name: backendDoc.original_filename,
      pdf_name: backendDoc.pdf_name,
      date: formatDate(backendDoc.uploaded_at),
      size: formatFileSize(backendDoc.file_size_bytes),
      status: mapStatus(backendDoc.upload_status),
      chunk_count: backendDoc.chunks_count,
      blob_url: backendDoc.blob_url,
    };
  }

  /**
   * Get all documents
   */
  async getAllDocuments(): Promise<Document[]> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/documents`);

    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    const data = await response.json();
    return data.documents.map((doc: BackendDocument) => this.transformDocument(doc));
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/documents/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
  }

  /**
   * Get processed documents
   */
  async getProcessedDocuments(): Promise<Array<{ id: string; name: string }>> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/documents/processed`);

    if (!response.ok) {
      throw new Error('Failed to fetch processed documents');
    }

    const data = await response.json();
    return data.documents;
  }

  /**
   * Query document
   */
  async queryDocument(query: string, pdfName?: string, conversationId?: string): Promise<ChatResponse> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        pdf_name: pdfName,
        conversation_id: conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error('Query failed');
    }

    return response.json();
  }

  /**
   * Get all conversations for the current user
   */
  async getAllConversations(): Promise<Conversation[]> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/conversations`);

    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const data = await response.json();
    return data.conversations;
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}/messages`);

    if (!response.ok) {
      throw new Error('Failed to fetch conversation messages');
    }

    const data = await response.json();
    return data.messages;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/conversations/${conversationId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
  }
}

export const apiService = new ApiService();
