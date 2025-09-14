import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/auth';
import { Provider, TwoFactorStatus } from '@/types/auth';
import { Card, CardHeader, CardTitle, CardContent, LoadingSpinner, Alert } from '../ui';

const API_BASE = '/auth';

// Profile View Component
export function ProfileView() {
  const { token } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus>({ enabled: false, backupCodesRemaining: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      
      try {
        const [providersResponse, twoFactorResponse] = await Promise.all([
          fetch(`${API_BASE}/linked-providers`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_BASE}/2fa/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (providersResponse.ok && twoFactorResponse.ok) {
          const providersData = await providersResponse.json();
          const twoFactorData = await twoFactorResponse.json();
          setProviders(providersData.providers);
          setTwoFactorStatus(twoFactorData);
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <LoadingSpinner size="lg" text="Loading profile..." className="py-12" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0 space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="text-center">
            <div className="text-6xl mb-4 animate-pulse-gentle">👤</div>
            <CardTitle className="text-3xl mb-2">
              Profile Settings
            </CardTitle>
            <p className="text-muted-foreground">
              Manage your account security and linked providers
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2FA Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>🔐</span>
                <span>Two-Factor Authentication</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert
                variant={twoFactorStatus.enabled ? 'success' : 'warning'}
                icon={twoFactorStatus.enabled ? '✅' : '⚠️'}
                title={twoFactorStatus.enabled ? 'Enabled' : 'Disabled'}
              >
                {twoFactorStatus.enabled ? (
                  <div>
                    <p>Your account is protected with 2FA.</p>
                    <p className="mt-1 text-sm">
                      Backup codes remaining: <strong>{twoFactorStatus.backupCodesRemaining}</strong>
                    </p>
                  </div>
                ) : (
                  <p>Enable 2FA to secure your account with an additional layer of protection.</p>
                )}
              </Alert>
            </CardContent>
          </Card>

          {/* Linked Providers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>🔗</span>
                <span>Linked Providers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {providers.length > 0 ? (
                <div className="space-y-3">
                  {providers.map((provider, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {provider.avatar && (
                          <div className="relative">
                            <Image
                              src={provider.avatar}
                              alt={`${provider.provider} avatar`}
                              className="w-10 h-10 rounded-full border-2 border-border"
                              width={40}
                              height={40}
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-background" />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{provider.username}</div>
                          <div className="text-sm text-muted-foreground">
                            <span className="capitalize">{provider.provider}</span> • Linked {new Date(provider.linkedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 bg-success/20 text-success rounded-full">
                        Active
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert variant="info" icon="📝">
                  No providers linked to your account yet.
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}