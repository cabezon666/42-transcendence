import { Card, CardHeader, CardTitle, CardDescription, CardContent, Alert } from '../ui';

// Protected Area View Component
export function ProtectedAreaView() {
  const protectionFeatures = [
    'Authentication checked before rendering this view',
    'Automatic redirect to login if not authenticated',
    'No page reload required - pure SPA behavior',
    'Auth server validates all access',
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0 space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-br from-success/5 to-primary/5 border-success/20">
          <CardHeader className="text-center">
            <div className="text-6xl mb-4 animate-pulse-gentle">🔐</div>
            <CardTitle className="text-3xl mb-2 text-success">
              Protected Area
            </CardTitle>
            <CardDescription className="text-lg">
              This view is protected by the auth middleware.
              <br />
              You can only see this because you&apos;re authenticated!
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Protection Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🛡️</span>
              <span>Auth Middleware Protection</span>
            </CardTitle>
            <CardDescription>
              Advanced security features protecting this area
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {protectionFeatures.map((feature, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-success/10 border border-success/20">
                  <span className="text-success text-lg">✅</span>
                  <span className="text-success-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Alert variant="success" icon="🔒" title="Security Notice">
          Your session is secure and validated. All requests to this area are protected by JWT authentication 
          and server-side validation. The system ensures that only authenticated users can access protected resources.
        </Alert>
      </div>
    </div>
  );
}