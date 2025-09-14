import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Alert, LoadingSpinner } from '../ui';

// API Test View Component
export function ApiTestView() {
  const { token } = useAuth();
  const [apiData, setApiData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [callCount, setCallCount] = useState(0);

  const testApiCall = async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/protected-data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('API call failed');
      }

      const data = await response.json();
      setApiData(data);
      setCallCount(prev => prev + 1);
    } catch (error) {
      console.error('API call failed:', error);
      setError('Failed to fetch data from main backend');
    } finally {
      setLoading(false);
    }
  };

  const clearData = () => {
    setApiData(null);
    setError('');
    setCallCount(0);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-br from-info/5 to-primary/5">
          <CardHeader className="text-center">
            <div className="text-4xl sm:text-6xl mb-4 animate-pulse-gentle" role="img" aria-label="Rocket">🚀</div>
            <CardTitle className="text-2xl sm:text-3xl mb-2">
              API Testing Center
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Test authenticated API calls to verify backend connectivity and token validation.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* API Testing Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span role="img" aria-label="Link">🔗</span>
              <span>API Testing</span>
            </CardTitle>
            <CardDescription>
              Make authenticated requests to protected endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Button
                onClick={testApiCall}
                disabled={loading}
                loading={loading}
                variant="primary"
                size="lg"
                icon="🎯"
                className="w-full sm:w-auto"
              >
                {loading ? 'Calling API...' : 'Test Protected API Call'}
              </Button>
              
              {(apiData || error) && (
                <Button
                  onClick={clearData}
                  variant="secondary"
                  size="lg"
                  icon="🗑️"
                  className="w-full sm:w-auto"
                >
                  Clear Results
                </Button>
              )}
            </div>
            
            {callCount > 0 && (
              <div className="mt-4 text-center">
                <span className="text-sm text-muted-foreground">
                  API calls made: <strong className="text-primary">{callCount}</strong>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent>
              <LoadingSpinner size="lg" text="Making authenticated API request..." />
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="error" title="API Error">
            {error}
          </Alert>
        )}

        {/* Success Response */}
        {apiData && (
          <Card className="border-success/20 bg-success/5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-success">
                <span role="img" aria-label="Success">✅</span>
                <span>API Response</span>
              </CardTitle>
              <CardDescription>
                Successful authenticated request to main backend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-background rounded-lg p-4 border border-border overflow-x-auto">
                <pre className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words">
                  {JSON.stringify(apiData, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span role="img" aria-label="Lock">🔐</span>
                <span>Authentication</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Token Status:</span>
                  <span className="text-success font-medium">Active ✅</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Auth Method:</span>
                  <span className="text-foreground font-medium">Bearer JWT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Protected:</span>
                  <span className="text-success font-medium">Server Validated ✅</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span role="img" aria-label="Settings">⚙️</span>
                <span>Endpoint Info</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="text-primary font-mono">GET</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Endpoint:</span>
                  <span className="text-foreground font-mono text-xs break-all">/api/protected-data</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Response:</span>
                  <span className="text-accent font-medium">JSON</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}