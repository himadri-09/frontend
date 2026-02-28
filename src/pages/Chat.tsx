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
import { apiService, ChatResponse, Conversation } from '@/services/api';
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

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  sources?: Array<{
    type: string;
    page: number;
    content_preview: string;
  }>;
}

interface Document {
  id: string;
  name: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your Multimodel RAG assistant. How can I help you today?",
      sender: 'ai',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [hasProcessedDocs, setHasProcessedDocs] = useState(false);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchProcessedDocuments();
    fetchConversations();
  }, []);

  const fetchProcessedDocuments = async () => {
    try {
      const docs = await apiService.getProcessedDocuments();
      setDocuments(docs);
      setHasProcessedDocs(docs.length > 0);

      if (activeDocument && !docs.some((d) => d.id === activeDocument)) {
        setActiveDocument(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
      // Fail open: allow chat even if fetch fails
      setHasProcessedDocs(true);
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

      // Transform API messages to UI messages
      const transformedMessages: Message[] = apiMessages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.role === 'user' ? 'user' : 'ai',
        timestamp: new Date(msg.created_at),
        sources: msg.sources,
      }));

      setMessages(transformedMessages);
      setCurrentConversationId(conversationId);

      // Set active document from conversation if available
      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation?.pdf_name) {
        const doc = documents.find((d) => d.name === conversation.pdf_name);
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
    setMessages([
      {
        id: '1',
        content: "Hello! I'm your Multimodel RAG assistant. How can I help you today?",
        sender: 'ai',
        timestamp: new Date(),
      },
    ]);
    setCurrentConversationId(null);
    setActiveDocument(null);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await apiService.deleteConversation(conversationId);

      // Remove from list
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      // If deleting current conversation, start new one
      if (currentConversationId === conversationId) {
        startNewConversation();
      }

      toast({
        title: 'Success',
        description: 'Conversation deleted',
      });
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

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response: ChatResponse = await apiService.queryDocument(
        inputValue,
        activeDocument || undefined,
        currentConversationId || undefined
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.answer,
        sender: 'ai',
        timestamp: new Date(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Update conversation ID if returned (new conversation created)
      if (response.conversation_id && !currentConversationId) {
        setCurrentConversationId(response.conversation_id);
        // Refresh conversations list
        fetchConversations();
      }
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          'Sorry, I encountered an error while processing your question. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: 'Error',
        description: 'Failed to get response',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleDocumentChange = (value: string) => {
    setActiveDocument(value === 'all' ? null : value);
  };

  return (
    <Layout>
      <div className="flex h-screen">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b p-4 bg-white">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Multimodel Chat Assistant</h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Select document:</span>
                <Select
                  value={activeDocument || 'all'}
                  onValueChange={handleDocumentChange}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All documents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All documents</SelectItem>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={fetchProcessedDocuments}
                  variant="outline"
                  size="sm"
                >
                  Refresh
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {activeDocument
                ? `Chatting with ${documents.find(
                    (doc) => doc.id === activeDocument
                  )?.name || ''}`
                : 'Chatting with all documents'}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.sender === 'user' ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-900 prose-li:text-gray-900 prose-strong:text-gray-900">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Custom components for better styling
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-bold mb-1 mt-2">{children}</h3>,
                          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc ml-5 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal ml-5 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          code: ({ className, children }) => {
                            const isInline = !className;
                            return isInline ? (
                              <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                            ) : (
                              <code className={className}>{children}</code>
                            );
                          },
                          pre: ({ children }) => <pre className="bg-gray-200 p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <div className="text-sm font-medium mb-2">Sources:</div>
                      {message.sources.map((source, index) => (
                        <div
                          key={index}
                          className="text-xs bg-white rounded p-2 mb-1"
                        >
                          <div className="font-medium">
                            {source.type.charAt(0).toUpperCase() +
                              source.type.slice(1)}{' '}
                            - Page {source.page}
                          </div>
                          <div className="text-gray-600 mt-1">
                            {source.content_preview}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-xs opacity-70 mt-2">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4 bg-white">
            {!hasProcessedDocs ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className="text-center">
                  <p className="text-gray-600 font-medium mb-2">
                    📄 No Documents Available
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Please upload and process documents before you can start chatting
                  </p>
                  <Button
                    onClick={() => navigate('/documents')}
                    variant="default"
                  >
                    Upload Documents
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                  disabled={isLoading}
                  onKeyDown={(e) => {
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

        {/* Sidebar - Conversation History (Right Side) */}
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
              <div className="p-4 text-center text-sm text-gray-500">
                Loading...
              </div>
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
                        ? 'bg-white border border-primary'
                        : 'hover:border hover:border-gray-200'
                    }`}
                    onClick={() => loadConversation(convo.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="text-sm font-medium truncate">
                          {convo.title}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(convo.updated_at)}
                      </div>
                      {convo.pdf_name && (
                        <div className="text-xs text-blue-600 mt-1 truncate">
                          📄 {convo.pdf_name}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {convo.message_count} messages
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConversationToDelete(convo.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={conversationToDelete !== null}
        onOpenChange={(open) => !open && setConversationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                conversationToDelete && handleDeleteConversation(conversationToDelete)
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
