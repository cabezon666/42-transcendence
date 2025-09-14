import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth';
import { Provider, TwoFactorStatus, User } from '@/types/auth';
import { Card, CardHeader, CardTitle, CardContent, LoadingSpinner, Alert, Button, Input, Label } from '../ui';

const API_BASE = '/auth';

interface SettingsData {
  providers: Provider[];
  twoFactorStatus: TwoFactorStatus;
  user: User;
}

interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
}

// Profile Settings Component
function ProfileSettings({ user }: { user: User }) {
  const { token, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Profile updated successfully' });
        // Update auth context with new user data
        login(token, data.user);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span role="img" aria-label="User">👤</span>
          <span>Profile Information</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" required>Username</Label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" required>Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              autoComplete="email"
            />
          </div>
          
          {message && (
            <Alert variant={message.type === 'success' ? 'success' : 'error'}>
              {message.text}
            </Alert>
          )}

          <Button 
            type="submit" 
            loading={loading} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Update Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Password Change Component
function PasswordSettings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (formData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters long' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Password changed successfully' });
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span role="img" aria-label="Lock">🔒</span>
          <span>Change Password</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" required>Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword" required>New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
              required
              helperText="Minimum 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" required>Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              required
              autoComplete="new-password"
            />
          </div>
          
          {message && (
            <Alert variant={message.type === 'success' ? 'success' : 'error'}>
              {message.text}
            </Alert>
          )}

          <Button 
            type="submit" 
            loading={loading} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Avatar Settings Component
function AvatarSettings({ user }: { user: User }) {
  const { token, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user.hasAvatar) {
      setAvatarUrl(`${API_BASE}/avatar/${user.id}?t=${Date.now()}`);
    } else {
      setAvatarUrl(null);
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size too large. Maximum 5MB allowed.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_BASE}/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Avatar updated successfully' });
        setAvatarUrl(`${API_BASE}/avatar/${user.id}?t=${Date.now()}`);
        // Update auth context with new user data
        if (data.user) {
          login(token, data.user);
        }
      } else {
        console.error('Avatar upload failed:', response.status, data);
        setMessage({ type: 'error', text: data.error || 'Failed to upload avatar' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!token) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Avatar removed successfully' });
        setAvatarUrl(null);
        // Update auth context with new user data
        login(token, data.user);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove avatar' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span role="img" aria-label="Picture">🖼️</span>
          <span>Profile Picture</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="w-20 h-20 rounded-full border-2 border-border object-cover"
                onError={() => {
                  console.error('Failed to load avatar image');
                  setAvatarUrl(null);
                }}
              />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-border bg-muted flex items-center justify-center text-2xl">
                <span role="img" aria-label="Default user avatar">👤</span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3 w-full sm:w-auto">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarUpload}
              disabled={loading}
              className="hidden"
              id="avatar-upload-input"
              aria-describedby="avatar-help"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => document.getElementById('avatar-upload-input')?.click()}
              disabled={loading}
              loading={loading}
              icon="📁"
              className="w-full sm:w-auto"
            >
              {loading ? 'Uploading...' : 'Choose Profile Picture'}
            </Button>
            <p id="avatar-help" className="text-xs text-muted-foreground">
              Supported formats: JPEG, PNG, GIF, WebP. Maximum size: 5MB.
            </p>
          </div>
        </div>

        {avatarUrl && (
          <Button
            variant="error"
            size="sm"
            onClick={handleAvatarDelete}
            loading={loading}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Remove Avatar
          </Button>
        )}

        {message && (
          <Alert variant={message.type === 'success' ? 'success' : 'error'}>
            {message.text}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Two-Factor Authentication Settings Component
function TwoFactorSettings({ twoFactorStatus, refetchSettingsData }: { twoFactorStatus: TwoFactorStatus; refetchSettingsData: () => Promise<void> }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [regenerateForm, setRegenerateForm] = useState({ password: '', code: '' });
  const [showRegenerateForm, setShowRegenerateForm] = useState(false);

  const handleSetup2FA = async () => {
    if (!token) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/2fa/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSetup(data);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to setup 2FA' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !setup) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/2fa/verify-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: setupCode })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || '2FA enabled successfully' });
        setSetup(null);
        setSetupCode('');
        setBackupCodes(data.backupCodes || []);
        setShowBackupCodes(true);
        // Update the 2FA status
        await refetchSettingsData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to verify 2FA setup' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: disableForm.password,
          twoFactorCode: disableForm.code
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || '2FA disabled successfully' });
        setShowDisableForm(false);
        setDisableForm({ password: '', code: '' });
        // Update the 2FA status
        await refetchSettingsData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to disable 2FA' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/2fa/regenerate-backup-codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: regenerateForm.password,
          twoFactorCode: regenerateForm.code
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Backup codes regenerated successfully' });
        setShowRegenerateForm(false);
        setRegenerateForm({ password: '', code: '' });
        setBackupCodes(data.backupCodes || []);
        setShowBackupCodes(true);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to regenerate backup codes' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>🔐</span>
          <span>Two-Factor Authentication</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert
          variant={twoFactorStatus.enabled ? 'success' : 'warning'}
          icon={twoFactorStatus.enabled ? '✅' : '⚠️'}
        >
          <div>
            <p className="font-semibold">
              {twoFactorStatus.enabled ? '2FA is Enabled' : '2FA is Disabled'}
            </p>
            {twoFactorStatus.enabled ? (
              <p className="text-sm mt-1">
                Your account is protected with 2FA. Backup codes remaining: {twoFactorStatus.backupCodesRemaining}
              </p>
            ) : (
              <p className="text-sm mt-1">
                Enable 2FA to secure your account with an additional layer of protection.
              </p>
            )}
          </div>
        </Alert>

        {/* Setup 2FA */}
        {!twoFactorStatus.enabled && !setup && (
          <Button onClick={handleSetup2FA} loading={loading} disabled={loading}>
            Enable Two-Factor Authentication
          </Button>
        )}

        {/* 2FA Setup Process */}
        {setup && (
          <div className="space-y-4 border border-border rounded-lg p-4">
            <h4 className="font-semibold">Setup Two-Factor Authentication</h4>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Scan this QR code with your authenticator app:
                </p>
                <div className="flex justify-center">
                  <img
                    src={setup.qrCode}
                    alt="2FA QR Code"
                    className="w-[200px] h-[200px] border border-border rounded"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Or enter this key manually:
                </p>
                <code className="block p-2 bg-muted rounded text-sm break-all">
                  {setup.manualEntryKey}
                </code>
              </div>
              <form onSubmit={handleVerifySetup} className="space-y-4">
                <div>
                  <Label htmlFor="setupCode">Enter 6-digit code from your authenticator app</Label>
                  <Input
                    id="setupCode"
                    type="text"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
                <Button type="submit" loading={loading} disabled={loading}>
                  Verify and Enable 2FA
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Manage 2FA (when enabled) */}
        {twoFactorStatus.enabled && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="error"
                onClick={() => setShowDisableForm(!showDisableForm)}
                disabled={loading}
              >
                Disable 2FA
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowRegenerateForm(!showRegenerateForm)}
                disabled={loading}
              >
                Regenerate Backup Codes
              </Button>
            </div>

            {/* Disable 2FA Form */}
            {showDisableForm && (
              <form onSubmit={handleDisable2FA} className="space-y-4 border border-border rounded-lg p-4">
                <h4 className="font-semibold">Disable Two-Factor Authentication</h4>
                <div>
                  <Label htmlFor="disablePassword">Current Password</Label>
                  <Input
                    id="disablePassword"
                    type="password"
                    value={disableForm.password}
                    onChange={(e) => setDisableForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="disableCode">2FA Code</Label>
                  <Input
                    id="disableCode"
                    type="text"
                    value={disableForm.code}
                    onChange={(e) => setDisableForm(prev => ({ ...prev, code: e.target.value }))}
                    maxLength={8}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="error" loading={loading} disabled={loading}>
                    Disable 2FA
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDisableForm(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Regenerate Backup Codes Form */}
            {showRegenerateForm && (
              <form onSubmit={handleRegenerateBackupCodes} className="space-y-4 border border-border rounded-lg p-4">
                <h4 className="font-semibold">Regenerate Backup Codes</h4>
                <div>
                  <Label htmlFor="regeneratePassword">Current Password</Label>
                  <Input
                    id="regeneratePassword"
                    type="password"
                    value={regenerateForm.password}
                    onChange={(e) => setRegenerateForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="regenerateCode">2FA Code</Label>
                  <Input
                    id="regenerateCode"
                    type="text"
                    value={regenerateForm.code}
                    onChange={(e) => setRegenerateForm(prev => ({ ...prev, code: e.target.value }))}
                    maxLength={8}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={loading} disabled={loading}>
                    Regenerate Codes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowRegenerateForm(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Backup Codes Display */}
        {showBackupCodes && backupCodes.length > 0 && (
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <h4 className="font-semibold mb-2">Your Backup Codes</h4>
            <Alert variant="warning" className="mb-4">
              Save these codes in a secure location. Each code can only be used once.
            </Alert>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {backupCodes.map((code, index) => (
                <code key={index} className="block p-2 bg-background rounded text-sm text-center">
                  {code}
                </code>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBackupCodes(false)}
            >
              I&apos;ve saved these codes
            </Button>
          </div>
        )}

        {message && (
          <Alert variant={message.type === 'success' ? 'success' : 'error'}>
            {message.text}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// OAuth Providers Settings Component
function ProvidersSettings({ providers, refetchSettingsData }: { providers: Provider[]; refetchSettingsData: () => Promise<void> }) {
  const { token, login } = useAuth(); // Move useAuth to top level
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUnlinkProvider = async (provider: string) => {
    if (!token) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/unlink-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ provider })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Provider unlinked successfully' });
        // Update the providers list
        await refetchSettingsData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to unlink provider' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkProvider = (provider: string) => {
    if (!token) return;
    
    // Open OAuth in a popup window with popup parameter
    const popup = window.open(
      `${API_BASE}/oauth/${provider}?token=${token}&popup=true`,
      `oauth-${provider}`,
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      setMessage({ type: 'error', text: 'Popup blocked. Please allow popups for this site.' });
      return;
    }

    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_SUCCESS') {
        // OAuth completed successfully
        setMessage({ type: 'success', text: 'Provider linked successfully!' });
        
        // If we got a token, we could update auth context but for linking
        // the user is already logged in, so we just need to refresh the data
        if (event.data.token) {
          // Note: We don't need to update login here for linking since user is already logged in
          // The refetch will get the updated provider list
        }
        
        refetchSettingsData();
        popup.close();
        window.removeEventListener('message', handleMessage);
      } else if (event.data.type === 'OAUTH_ERROR') {
        // OAuth failed
        setMessage({ type: 'error', text: event.data.message || 'Failed to link provider' });
        popup.close();
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback: Listen for the popup to close manually and refresh data
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        // Only refresh if we didn't get a success message (user manually closed)
        refetchSettingsData();
      }
    }, 1000);

    // Fallback: clean up after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
      if (!popup.closed) {
        popup.close();
      }
    }, 5 * 60 * 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span role="img" aria-label="Link">🔗</span>
          <span>OAuth Providers</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-semibold">Linked Providers</h4>
            {providers.map((provider, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border border-border bg-muted/30 space-y-3 sm:space-y-0"
              >
                <div className="flex items-center space-x-3">
                  {provider.avatar && (
                    <div className="relative flex-shrink-0">
                      <img
                        src={provider.avatar}
                        alt={`${provider.provider} avatar`}
                        className="w-10 h-10 rounded-full border-2 border-border"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{provider.username}</div>
                    <div className="text-sm text-muted-foreground">
                      <span className="capitalize">{provider.provider}</span> • Linked {new Date(provider.linkedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button
                  variant="error"
                  size="sm"
                  onClick={() => handleUnlinkProvider(provider.provider)}
                  loading={loading}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  Unlink
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Alert variant="info">
            No providers linked to your account yet.
          </Alert>
        )}

        <div className="space-y-3">
          <h4 className="font-semibold">Link New Provider</h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              onClick={() => handleLinkProvider('github')}
              disabled={loading || providers.some(p => p.provider === 'github')}
              className="w-full sm:w-auto"
            >
              <span role="img" aria-label="GitHub">🐙</span> GitHub
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleLinkProvider('discord')}
              disabled={loading || providers.some(p => p.provider === 'discord')}
              className="w-full sm:w-auto"
            >
              <span role="img" aria-label="Discord">💬</span> Discord
            </Button>
          </div>
        </div>

        {message && (
          <Alert variant={message.type === 'success' ? 'success' : 'error'}>
            {message.text}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Account Actions Component
function AccountActions() {
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Call logout to clear local storage and state
      logout();
      // Optionally call server logout endpoint if it exists
      // await fetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span role="img" aria-label="Lightning">⚡</span>
          <span>Account Actions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex-1">
                <h4 className="font-semibold">Sign Out</h4>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account on this device
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {!showLogoutConfirm ? (
                  <Button
                    variant="error"
                    size="sm"
                    onClick={() => setShowLogoutConfirm(true)}
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    Sign Out
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowLogoutConfirm(false)}
                      disabled={loading}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="error"
                      size="sm"
                      onClick={handleLogout}
                      loading={loading}
                      disabled={loading}
                      className="w-full sm:w-auto"
                    >
                      Confirm Sign Out
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Settings View Component
export function SettingsView() {
  const { user, token } = useAuth();
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettingsData = async () => {
    if (!token || !user) return;
    
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
        setSettingsData({
          providers: providersData.providers,
          twoFactorStatus: twoFactorData,
          user
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refetchSettingsData = async () => {
    if (!token || !user) return;
    
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
        setSettingsData({
          providers: providersData.providers,
          twoFactorStatus: twoFactorData,
          user
        });
      }
    } catch (error) {
      console.error('Failed to refetch settings data:', error);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, [token, user]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <LoadingSpinner size="lg" text="Loading settings..." className="py-12" />
      </div>
    );
  }

  if (!settingsData || !user) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Alert variant="error">
          Failed to load settings data. Please try refreshing the page.
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="text-center">
            <div className="text-4xl sm:text-6xl mb-4 animate-pulse-gentle" role="img" aria-label="Settings">⚙️</div>
            <CardTitle className="text-2xl sm:text-3xl mb-2">
              Account Settings
            </CardTitle>
            <p className="text-muted-foreground">
              Manage your account information, security, and preferences
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Profile Settings */}
          <ProfileSettings user={user} />

          {/* Avatar Settings */}
          <AvatarSettings user={user} />

          {/* Password Settings */}
          <PasswordSettings />

          {/* Two-Factor Authentication */}
          <TwoFactorSettings twoFactorStatus={settingsData.twoFactorStatus} refetchSettingsData={refetchSettingsData} />
        </div>

        {/* OAuth Providers (full width) */}
        <ProvidersSettings providers={settingsData.providers} refetchSettingsData={refetchSettingsData} />

        {/* Account Actions */}
        <AccountActions />
      </div>
    </div>
  );
}