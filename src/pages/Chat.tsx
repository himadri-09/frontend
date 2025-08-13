import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Layout from '@/components/Layout';
import { Send, FileText, Paperclip, Loader2, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
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
      timestamp: new Date(Date.now() - 1000 * 60 * 5)
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const documents: Document[] = [
    { id: '1', name: 'Contract.pdf' },
    { id: '2', name: 'Agreement.pdf' },
    { id: '3', name: 'Terms.pdf' },
    { id: '4', name: 'Legal Brief.pdf' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(inputValue, activeDocument),
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAIResponse = (query: string, documentId: string | null): string => {
    if (query.toLowerCase().includes('contract') || documentId === '1') {
      return "Based on the contract you've shared, I notice several key provisions that require attention. The liability clause in section 5.3 appears to be unusually broad and may expose your company to significant risk. I recommend revising this section to include more specific limitations.";
    } else if (query.toLowerCase().includes('agreement') || documentId === '2') {
      return "I've analyzed the agreement and found that the termination conditions in section 8 are ambiguous. This could lead to disputes if either party wishes to end the relationship. Consider adding more explicit language about notice periods and acceptable grounds for termination.";
    } else if (query.toLowerCase().includes('legal') || query.toLowerCase().includes('advice')) {
      return "While I can provide information about legal documents and highlight potential issues, I should note that this doesn't constitute legal advice. For specific legal guidance tailored to your situation, I recommend consulting with a qualified attorney.";
    }
    return "I've analyzed your question. To provide a more specific response, could you share more details or upload a relevant document? I'm designed to help with contract analysis, legal document review, and general legal information.";
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDocumentChange = (value: string) => {
    setActiveDocument(value === "all" ? null : value);
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="border-b border-border">
          <div className="px-6 py-4 flex items-center">
            <div className="flex items-center text-sm text-muted-foreground mr-4">
              <FileText className="h-4 w-4 mr-2" />
              <span>Select document:</span>
            </div>
            <Select value={activeDocument || "all"} onValueChange={handleDocumentChange}>
              <SelectTrigger className="w-[200px]">
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
          </div>
          <div className="px-6 py-2 flex items-center text-sm text-muted-foreground">
            <FileText className="h-4 w-4 mr-2" />
            <span>
              {activeDocument 
                ? `Chatting with ${documents.find(doc => doc.id === activeDocument)?.name}` 
                : "Chatting with all documents"}
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollBehavior: 'smooth' }}>
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-lg p-4 ${message.sender === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-foreground'}`}
                >
                  <div className="mb-1">{message.content}</div>
                  <div className="text-xs text-right mt-1 opacity-70">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground max-w-[80%] rounded-lg p-4">
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        <div className="p-4 border-t border-border bg-background">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputValue.trim() || isLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Chat;