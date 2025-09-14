import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

// Auth Guard Component - protects views
export function AuthGuard({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const { isAuthenticated, checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      setLoading(true);
      await checkAuth();
      setLoading(false);
    };
    verify();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
}