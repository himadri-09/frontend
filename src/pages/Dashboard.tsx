import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Layout from '@/components/Layout';
import { FileText, BarChart2, Clock, AlertCircle } from 'lucide-react';

const Dashboard = () => {
  const [recentDocuments] = useState([
    { id: 1, name: 'Contract.pdf', date: '2023-10-15', status: 'Analyzed' },
    { id: 2, name: 'Agreement.pdf', date: '2023-10-14', status: 'In Progress' },
    { id: 3, name: 'Terms.pdf', date: '2023-10-12', status: 'Analyzed' },
    { id: 4, name: 'Legal Brief.pdf', date: '2023-10-10', status: 'Analyzed' },
  ]);

  const [stats] = useState({
    documentsAnalyzed: 12,
    questionsAnswered: 48,
    averageResponseTime: '1.2s',
    potentialIssues: 3
  });

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Documents Analyzed</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.documentsAnalyzed}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Questions Answered</CardTitle>
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.questionsAnswered}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageResponseTime}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Potential Issues</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.potentialIssues}</div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-surface rounded-md">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">{doc.date}</p>
                      </div>
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        doc.status === 'Analyzed' ? 'bg-success-muted text-success' : 'bg-warning-muted text-warning'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 bg-background text-foreground border-border hover:bg-muted">
                View All Documents
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Document Analysis Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Contract.pdf</span>
                    <span className="text-sm text-muted-foreground">100%</span>
                  </div>
                  <Progress value={100} className="h-2 bg-muted" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Agreement.pdf</span>
                    <span className="text-sm text-muted-foreground">45%</span>
                  </div>
                  <Progress value={45} className="h-2 bg-muted" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Terms.pdf</span>
                    <span className="text-sm text-muted-foreground">100%</span>
                  </div>
                  <Progress value={100} className="h-2 bg-muted" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Legal Brief.pdf</span>
                    <span className="text-sm text-muted-foreground">100%</span>
                  </div>
                  <Progress value={100} className="h-2 bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
