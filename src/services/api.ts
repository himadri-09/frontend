import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

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
  source_type?: 'pdf' | 'web';
  source_url?: string;
}

export interface Document {
  id: string;
  name: string;
  pdf_name: string;
  date: string;
  size: string;
  status: 'Processing' | 'Analyzed' | 'Failed';
  chunk_count?: number;
  blob_url?: string;
  source_type?: 'pdf' | 'web';
  source_url?: string;
}

export interface ProcessingJob {
  job_id: string;
  status:
    | 'already_exists'
    | 'newly_processed'
    | 'started'
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | string;
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

export interface CrawlJobResponse {
  job_id: string;
  message: string;
  status: string;
  site_slug: string;
  check_status_url: string;
}

// ── NEW: Tabular data types ─────────────────────────────────────────────────

export interface TabularColumn {
  name: string;
  pg_type?: string;
  nullable?: boolean;
  // LLM-generated schemas use "name"; older code may use "original_name"
  original_name?: string;
}

export interface TabularFkHint {
  column: string;
  refs_table: string;
  refs_column: string;
  reason?: string;
  confidence?: number;
}

export interface TabularSource {
  id: string;
  original_filename: string;
  sheet_name: string | null;
  db_table_name: string;
  row_count: number;
  columns: TabularColumn[];
  fk_hints?: TabularFkHint[];
  status: string;
  created_at: string;
}

export interface TabularTableResult {
  sheet_name: string | null;
  db_table_name: string;
  row_count: number;
  failed_rows: number;
  status: string;
  error?: string | null;
}

export interface TabularUploadResponse {
  message: string;
  filename: string;
  storage_path: string;
  total_tables: number;
  tables: TabularTableResult[];
}

// ── NEW: Query routing types ────────────────────────────────────────────────

export type RoutingStrategy = 'sql' | 'vector' | 'hybrid' | 'none';

export interface RoutingDecision {
  strategy: RoutingStrategy;
  reasoning: string;
  sql_tables: string[];
  vector_sources: string[];
  confidence: number;
}

// ── Extended chat types ─────────────────────────────────────────────────────

export interface ChatResponse {
  answer: string;
  conversation_id?: string;
  sources: Array<{
    type: string;
    page?: number;
    content_preview?: string;
    source_url?: string;
    page_title?: string;
    table?: string;
  }>;
  // NEW transparency fields
  routing?: RoutingDecision;
  sql_used?: string | null;
  sql_rows?: Array<Record<string, unknown>>;
  images?: Array<{ url: string; page?: number | string; caption?: string }>;
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
    page?: number;
    content_preview?: string;
    source_url?: string;
    table?: string;
  }>;
}

// ── NEW: Unified data source (for "do you have any data?" checks) ──────────

export interface UnifiedSource {
  id: string;
  name: string;
  kind: 'pdf' | 'web' | 'tabular';
  sub_label?: string; // sheet name, URL, etc.
}

// ═══════════════════════════════════════════════════════════════════════════
// API Service
// ═══════════════════════════════════════════════════════════════════════════

class ApiService {
  private async getAuthHeader(): Promise<{ Authorization: string }> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${session.access_token}` };
  }

  private async fetchWithAuth(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const authHeader = await this.getAuthHeader();
    const headers = { ...options.headers, ...authHeader };
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please login again.');
      const retryHeaders = {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
      };
      return fetch(url, { ...options, headers: retryHeaders });
    }
    return response;
  }

  // ── PDF upload ──────────────────────────────────────────────────────────
  async uploadDocument(file: File): Promise<ProcessingJob> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.fetchWithAuth(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }

  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/status/${jobId}`);
    if (!response.ok) throw new Error('Failed to get job status');
    return response.json();
  }

  // ── Web crawl ───────────────────────────────────────────────────────────
  async crawlWebsite(
    url: string,
    maxPages = 100,
    maxDepth = 5,
  ): Promise<CrawlJobResponse> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, max_pages: maxPages, max_depth: maxDepth }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Crawl failed');
    }
    return response.json();
  }

  async getCrawlStatus(jobId: string): Promise<ProcessingJob> {
    const response = await this.fetchWithAuth(
      `${API_BASE_URL}/crawl/status/${jobId}`,
    );
    if (!response.ok) throw new Error('Failed to get crawl status');
    return response.json();
  }

  // ── NEW: Tabular (CSV / Excel) ──────────────────────────────────────────
  /**
   * Upload a CSV or Excel file. Excel workbooks with multiple sheets
   * create one Postgres table per non-empty sheet.
   */
  async uploadTabular(file: File): Promise<TabularUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.fetchWithAuth(`${API_BASE_URL}/tabular/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Tabular upload failed');
    }
    return response.json();
  }

  /**
   * List every CSV / Excel sheet the user has uploaded, with schema.
   */
  async getTabularSources(): Promise<TabularSource[]> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/tabular/sources`);
    if (!response.ok) throw new Error('Failed to fetch tabular sources');
    return response.json();
  }

  /**
   * Delete one tabular source (drops the Postgres table + file from storage).
   */
  async deleteTabularSource(sourceId: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${API_BASE_URL}/tabular/sources/${sourceId}`,
      { method: 'DELETE' },
    );
    if (!response.ok) throw new Error('Failed to delete tabular source');
  }

  // ── Transform backend doc → frontend doc ───────────────────────────────
  private transformDocument(backendDoc: BackendDocument): Document {
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
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
      source_type: backendDoc.source_type || 'pdf',
      source_url: backendDoc.source_url,
    };
  }

  // ── Documents list ──────────────────────────────────────────────────────
  async getAllDocuments(): Promise<Document[]> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/documents`);
    if (!response.ok) throw new Error('Failed to fetch documents');
    const data = await response.json();
    return data.documents.map((doc: BackendDocument) =>
      this.transformDocument(doc),
    );
  }

  async deleteDocument(documentId: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${API_BASE_URL}/documents/${documentId}`,
      { method: 'DELETE' },
    );
    if (!response.ok) throw new Error('Failed to delete document');
  }

  async getProcessedDocuments(): Promise<
    Array<{ id: string; name: string; source_type?: string }>
  > {
    const response = await this.fetchWithAuth(
      `${API_BASE_URL}/documents/processed`,
    );
    if (!response.ok) throw new Error('Failed to fetch processed documents');
    const data = await response.json();
    return data.documents;
  }

  /**
   * NEW: unified "does the user have ANY data?" check used by Chat page.
   * Returns a flat list of every data source (PDFs, websites, tabular).
   * Individual failures are tolerated — we return what we can get.
   */
  async getAllDataSources(): Promise<UnifiedSource[]> {
    const results = await Promise.allSettled([
      this.getProcessedDocuments(),
      this.getTabularSources(),
    ]);

    const sources: UnifiedSource[] = [];

    if (results[0].status === 'fulfilled') {
      for (const d of results[0].value) {
        sources.push({
          id: d.id,
          name: d.name,
          kind: (d.source_type as 'pdf' | 'web') || 'pdf',
        });
      }
    }

    if (results[1].status === 'fulfilled') {
      for (const t of results[1].value) {
        sources.push({
          id: t.id,
          name: t.original_filename,
          kind: 'tabular',
          sub_label: t.sheet_name
            ? `${t.sheet_name} · ${t.row_count} rows`
            : `${t.row_count} rows`,
        });
      }
    }

    return sources;
  }

  // ── Query ──────────────────────────────────────────────────────────────
  async queryDocument(
    query: string,
    pdfName?: string,
    conversationId?: string,
  ): Promise<ChatResponse> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        pdf_name: pdfName,
        conversation_id: conversationId,
      }),
    });
    if (!response.ok) throw new Error('Query failed');
    return response.json();
  }

  // ── Conversations ──────────────────────────────────────────────────────
  async getAllConversations(): Promise<Conversation[]> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/conversations`);
    if (!response.ok) throw new Error('Failed to fetch conversations');
    const data = await response.json();
    return data.conversations;
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const response = await this.fetchWithAuth(
      `${API_BASE_URL}/conversations/${conversationId}/messages`,
    );
    if (!response.ok) throw new Error('Failed to fetch conversation messages');
    const data = await response.json();
    return data.messages;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await this.fetchWithAuth(
      `${API_BASE_URL}/conversations/${conversationId}`,
      { method: 'DELETE' },
    );
    if (!response.ok) throw new Error('Failed to delete conversation');
  }
}

export const apiService = new ApiService();