// src/pages/Chat.tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Layout from '@/components/Layout';
import { Send, Loader2, Plus, Trash2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  apiService,
  ChatResponse,
  Conversation,
  RoutingDecision,
  UnifiedSource,
} from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import RoutingBadge from '@/components/RoutingBadge';
import SqlResultTable from '@/components/SqlResultTable';
import ChartExportCard from '@/components/ChartExportCard';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  sources?: Array<{
    type: string;
    page?: number;
    content_preview?: string;
    table?: string;
  }>;
  routing?: RoutingDecision;
  sql_used?: string | null;
  sql_rows?: Array<Record<string, unknown>>;
  /** The user's question that produced this AI answer — used for chart export header. */
  question?: string;
}

const WELCOME_MESSAGE: Message = {
  id: '1',
  content:
    "Hello! I'm your Multimodel RAG assistant. I can answer from your PDFs, websites, or spreadsheets — I'll choose the best source automatically.",
  sender: 'ai',
  timestamp: new Date(),
};

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);

  // Unified data sources (PDFs + websites + tabular)
  const [dataSources, setDataSources] = useState<UnifiedSource[]>([]);
  const [hasAnyData, setHasAnyData] = useState(false);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    null,
  );
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchDataSources();
    fetchConversations();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch data sources (PDFs + websites + tabular, unified)
  // ─────────────────────────────────────────────────────────────────────────

  const fetchDataSources = async () => {
    try {
      const sources = await apiService.getAllDataSources();
      setDataSources(sources);
      setHasAnyData(sources.length > 0);

      // Clear active doc if it no longer exists (tabular sources can't be
      // selected as "active" from this dropdown, only PDFs/web can)
      if (activeDocument && !sources.some((s) => s.id === activeDocument)) {
        setActiveDocument(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch data sources',
        variant: 'destructive',
      });
      // Fail open: allow chat even if fetch fails
      setHasAnyData(true);
    }
  };

  const fetchConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const convos = await apiService.getAllConversations();
      setConversations(convos);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch conversations',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    setIsLoading(true);
    try {
      const apiMessages = await apiService.getConversationMessages(conversationId);

      const transformedMessages: Message[] = apiMessages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.role === 'user' ? 'user' : 'ai',
        timestamp: new Date(msg.created_at),
        sources: msg.sources,
        // Historical messages don't have routing info — that's fine
      }));

      setMessages(transformedMessages);
      setCurrentConversationId(conversationId);

      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation?.pdf_name) {
        const doc = dataSources.find((d) => d.name === conversation.pdf_name);
        if (doc) {
          setActiveDocument(doc.id);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load conversation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([WELCOME_MESSAGE]);
    setCurrentConversationId(null);
    setActiveDocument(null);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await apiService.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      if (currentConversationId === conversationId) {
        startNewConversation();
      }

      toast({ title: 'Success', description: 'Conversation deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    } finally {
      setConversationToDelete(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Send message
  // ─────────────────────────────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Capture the question text BEFORE we clear the input — needed both for
    // the user message and (later) for the AI message's chart export header.
    const submittedQuestion = inputValue.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      content: submittedQuestion,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response: ChatResponse = await apiService.queryDocument(
        submittedQuestion,
        activeDocument || undefined,
        currentConversationId || undefined,
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.answer,
        sender: 'ai',
        timestamp: new Date(),
        sources: response.sources,
        routing: response.routing,
        sql_used: response.sql_used,
        sql_rows: response.sql_rows,
        question: submittedQuestion,
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (response.conversation_id && !currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        fetchConversations();
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error while processing your question.',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Filter dropdown options to only PDFs / web (tabular gets auto-selected
  // by the query router — user doesn't need to pick a specific spreadsheet)
  // ─────────────────────────────────────────────────────────────────────────

  const selectableDocuments = dataSources.filter(
    (d) => d.kind === 'pdf' || d.kind === 'web',
  );
  const tabularCount = dataSources.filter((d) => d.kind === 'tabular').length;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {/* Header — document selector */}
          <div className="border-b bg-white p-4 flex items-center gap-4">
            <Select
              value={activeDocument || 'all'}
              onValueChange={(v: string) => setActiveDocument(v === 'all' ? null : v)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {selectableDocuments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.kind === 'web' ? '🌐 ' : '📄 '}
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tabularCount > 0 && (
              <span className="text-xs text-gray-500">
                · {tabularCount} spreadsheet{tabularCount !== 1 ? 's' : ''} queryable automatically
              </span>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {/* Routing badge (AI messages only, if present) */}
                    {message.sender === 'ai' && message.routing && (
                      <div className="mb-2">
                        <RoutingBadge strategy={message.routing.strategy} />
                      </div>
                    )}

                    {/* Message body */}
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {/* SQL results — chart-first, then collapsible table */}
                    {message.sender === 'ai' &&
                      message.sql_rows &&
                      message.sql_rows.length > 0 && (
                        <>
                          <ChartExportCard
                            question={message.question || 'SQL Result'}
                            rows={message.sql_rows}
                            sourceLabel={
                              message.sources?.find((s) => s.type === 'sql')?.table
                            }
                            timestamp={message.timestamp}
                          />
                          <SqlResultTable
                            rows={message.sql_rows}
                            sqlUsed={message.sql_used}
                          />
                        </>
                      )}

                    {/* Sources (vector + sql combined) */}
                    {message.sender === 'ai' &&
                      message.sources &&
                      message.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 mb-1">
                            Sources
                          </p>
                          <ul className="text-xs text-gray-600 space-y-0.5">
                            {message.sources.slice(0, 5).map((src, i) => (
                              <li key={i}>
                                {src.type === 'sql' ? (
                                  <span>📊 Table: {src.table}</span>
                                ) : src.type === 'image' ? (
                                  <span>🖼️ Image (page {src.page ?? '?'})</span>
                                ) : (
                                  <span>
                                    📄 {src.page ? `Page ${src.page}` : 'Source'}
                                  </span>
                                )}
                              </li>
                            ))}
                            {message.sources.length > 5 && (
                              <li className="text-gray-400">
                                …and {message.sources.length - 5} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                    <p className="text-xs opacity-60 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600">Thinking…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t bg-white p-4">
            {!hasAnyData ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className="text-center">
                  <p className="text-gray-600 font-medium mb-2">
                    📄 No Data Sources Available
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Upload a PDF, crawl a website, or add a spreadsheet before you
                    can start chatting
                  </p>
                  <Button onClick={() => navigate('/documents')} variant="default">
                    Add Data Source
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-2">
                <Input
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                  placeholder="Ask a question about your data…"
                  className="flex-1"
                  disabled={isLoading}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                  className="px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — Conversation history */}
        <div className="w-64 border-l bg-gray-50 flex flex-col">
          <div className="p-4 border-b bg-white">
            <Button
              onClick={startNewConversation}
              className="w-full"
              variant="default"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {isLoadingConversations ? (
              <div className="p-4 text-center text-sm text-gray-500">Loading…</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No conversations yet
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {conversations.map((convo) => (
                  <div
                    key={convo.id}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-white transition-colors ${
                      currentConversationId === convo.id
                        ? 'bg-white shadow-sm'
                        : ''
                    }`}
                    onClick={() => loadConversation(convo.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm truncate">{convo.title}</span>
                    </div>
                    <button
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setConversationToDelete(convo.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={conversationToDelete !== null}
        onOpenChange={() => setConversationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                conversationToDelete &&
                handleDeleteConversation(conversationToDelete)
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Chat;