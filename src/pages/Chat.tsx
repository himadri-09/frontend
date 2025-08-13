import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Layout from '@/components/Layout';
import { Send, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiService, ChatResponse } from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your Legal AI assistant. How can I help you today?",
      sender: 'ai',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
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
  }, []);

  const fetchProcessedDocuments = async () => {
    try {
      const docs = await apiService.getProcessedDocuments();
      setDocuments(docs);

      if (activeDocument && !docs.some((d) => d.id === activeDocument)) {
        setActiveDocument(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
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
        activeDocument || undefined
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.answer,
        sender: 'ai',
        timestamp: new Date(),
        sources: response.sources,
      };

      setMessages((prev) => [...prev, aiMessage]);
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

  const handleDocumentChange = (value: string) => {
    setActiveDocument(value === 'all' ? null : value);
  };

  return (
    <Layout>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="border-b p-4 bg-white">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Legal Chat Assistant</h1>
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
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>

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
        </div>
      </div>
    </Layout>
  );
};

export default Chat;