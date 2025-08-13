import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Home, FileText, MessageSquare, Menu, User, Settings, LogOut } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigation = [
    { name: 'Chat', href: '/', icon: MessageSquare },
    { name: 'Documents', href: '/documents', icon: FileText },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col h-full border-r border-border bg-card">
          <div className="flex items-center h-16 px-6 border-b border-border">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold">Legal AI</span>
            </Link>
          </div>
          <ScrollArea className="flex-1">
            <nav className="flex-1 px-4 pt-4 pb-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="md:hidden">
          <div className="flex items-center justify-between h-16 px-4 border-b border-border bg-card">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold">Legal AI</span>
            </Link>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center h-16 px-6 border-b border-border">
                    <Link 
                      to="/" 
                      className="flex items-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="text-xl font-bold">Legal AI</span>
                    </Link>
                  </div>
                  <ScrollArea className="flex-1">
                    <nav className="flex-1 px-4 pt-4 pb-4 space-y-1">
                      {navigation.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              isActive(item.href)
                                ? 'bg-primary text-primary-foreground'
                                : 'text-foreground hover:bg-muted'
                            }`}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <Icon className="mr-3 h-5 w-5" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </nav>
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;