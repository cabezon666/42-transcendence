import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Label, Alert, LoadingSpinner, CoolButton } from '../ui';

const API_BASE = '/auth';

// Auth Component (Login/Register)
export function AuthComponent() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({
    emailOrUsername: '',
    password: '',
    twoFactorCode: '',
  });

  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
  });

  const handleAuthSuccess = useCallback(async (token: string) => {
    try {
      // Get user data
      const userResponse = await fetch(`${API_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        login(token, userData.user);
        setSuccess('Authentication successful!');
      } else {
        setError('Failed to fetch user data');
      }
    } catch (error) {
      console.error('Auth success failed:', error);
      setError('Authentication failed');
    }
  }, [login]);

  useEffect(() => {
    // Check URL parameters for OAuth responses
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const errorParam = urlParams.get('error');
    const message = urlParams.get('message');
    const requiresTwoFactorParam = urlParams.get('requiresTwoFactor');
    const tempTokenParam = urlParams.get('tempToken');
    
    if (requiresTwoFactorParam && tempTokenParam) {
      setRequiresTwoFactor(true);
      setTempToken(tempTokenParam);
    } else if (token) {
      handleAuthSuccess(token);
    } else if (errorParam) {
      setError(message ? decodeURIComponent(message) : `Authentication error: ${errorParam}`);
    }

    // Clean URL without page reload
    if (token || errorParam || requiresTwoFactorParam) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [handleAuthSuccess]);

  // Handle OAuth popup messages
  useEffect(() => {
    function handleOAuthMessage(event: MessageEvent) {
      // Only accept messages from the same origin
      if (event.origin !== window.location.origin) return;
      
      const { type, token, provider, linked, message, error, tempToken, requiresTwoFactor } = event.data || {};
      
      if (type === 'OAUTH_SUCCESS' && token) {
        // OAuth was successful and we have a token
        handleAuthSuccess(token);
        setSuccess(`Successfully logged in with ${provider}!`);
      } else if (type === 'OAUTH_SUCCESS' && linked) {
        // OAuth provider was linked successfully (for settings page)
        setSuccess(`Successfully linked ${provider} to your account!`);
      } else if (type === 'OAUTH_2FA_REQUIRED' && tempToken) {
        // 2FA is required
        setRequiresTwoFactor(true);
        setTempToken(tempToken);
        setError('');
      } else if (type === 'OAUTH_ERROR') {
        // OAuth failed
        setError(message || error || 'OAuth authentication failed');
      }
    }

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [handleAuthSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const body: Record<string, string> = { 
      email: loginForm.emailOrUsername, 
      password: loginForm.password 
    };
    
    if (requiresTwoFactor && loginForm.twoFactorCode) {
      body.twoFactorCode = loginForm.twoFactorCode;
    }

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setTempToken(data.tempToken);
        } else {
          await handleAuthSuccess(data.token);
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      const data = await response.json();

      if (response.ok) {
        await handleAuthSuccess(data.token);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!tempToken || !loginForm.twoFactorCode) return;

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tempToken: tempToken, 
          twoFactorCode: loginForm.twoFactorCode 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await handleAuthSuccess(data.token);
      } else {
        setError(data.error || '2FA verification failed');
        console.error('2FA verification failed:', data); 
      }
    } catch (error) {
      console.error('2FA verification error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background via-background to-accent/20">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="mb-2 text-3xl text-foreground">
            ft_trans
          </CardTitle>
          <p className="text-muted-foreground">
            {activeTab === 'login' 
              ? 'Welcome back! Please sign in to continue.' 
              : 'Create your account to start playing!'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Error/Success Messages */}
          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}
          {success && (
            <Alert variant="success">
              {success}
            </Alert>
          )}

          {/* Tab Buttons */}
          <div className="flex p-1 rounded-lg bg-muted">
            <Button
              type="button"
              onClick={() => setActiveTab('login')}
              variant={activeTab === 'login' ? 'primary' : 'ghost'}
              className="flex-1"
            >
              Login
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab('register')}
              variant={activeTab === 'register' ? 'primary' : 'ghost'}
              className="flex-1"
            >
              Register
            </Button>
          </div>

          {/* Forms Container with Fade Transition */}
          <div className="relative min-h-[300px]">
            {/* Login Form */}
            <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
              activeTab === 'login' 
                ? 'opacity-100 translate-x-0 pointer-events-auto' 
                : 'opacity-0 translate-x-4 pointer-events-none'
            }`}>
              {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" required>
                  Email or Username
                </Label>
                <Input
                  id="email"
                  type="text"
                  value={loginForm.emailOrUsername}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, emailOrUsername: e.target.value }))}
                  placeholder="Enter your email or username"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" required>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <CoolButton
                type="submit"
                disabled={loading}
                loading={loading}
                className="w-full"
                size="lg"
              >
                Login
              </CoolButton>
              {/* OAuth Section */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => window.open('/auth/oauth/discord?popup=true', 'oauth', 'width=500,height=600')}
                  icon={
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                    </svg>
                  }
                >
                  Discord
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => window.open('/auth/oauth/github?popup=true', 'oauth', 'width=500,height=600')}
                  icon={
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  }
                >
                  GitHub
                </Button>
              </div>
            </form>
              )}
            </div>

            {/* Register Form */}
            <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
              activeTab === 'register' 
                ? 'opacity-100 translate-x-0 pointer-events-auto' 
                : 'opacity-0 -translate-x-4 pointer-events-none'
            }`}>
              {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email" required>
                  Email
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="register-password" required>
                  Password
                </Label>
                <Input
                  id="register-password"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Create a password (min. 8 characters)"
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-username" required>
                  Username
                </Label>
                <Input
                  id="register-username"
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Choose your username"
                  required
                />
              </div>

              <CoolButton
                type="submit"
                disabled={loading}
                loading={loading}
                className="w-full"
                size="lg"
              >
                Create Account
              </CoolButton>
              
              {/* OAuth Section */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => window.open('/auth/oauth/discord?popup=true', 'oauth', 'width=500,height=600')}
                  icon={
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0189 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                    </svg>
                  }
                >
                  Discord
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => window.open('/auth/oauth/github?popup=true', 'oauth', 'width=500,height=600')}
                  icon={
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  }
                >
                  GitHub
                </Button>
              </div>
            </form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2FA Modal */}
      {requiresTwoFactor && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 duration-300 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRequiresTwoFactor(false);
              setTempToken(null);
              setLoginForm(prev => ({ ...prev, twoFactorCode: '' }));
              setError('');
            }
          }}
        >
          <Card className="w-full max-w-md duration-300 border shadow-2xl bg-background animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4">
            <CardHeader className="pb-4 text-center">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <CardTitle className="mb-2 text-xl font-semibold">
                Two-Factor Authentication
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter your 6-digit code to continue
              </p>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error Message */}
              {error && (
                <Alert variant="error" className="duration-200 animate-in fade-in-0 slide-in-from-top-2">
                  {error}
                </Alert>
              )}

              {/* Individual digit inputs */}
              <div className="flex justify-center gap-2">
                {[...Array(6)].map((_, index) => (
                  <input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={loginForm.twoFactorCode[index] || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      if (value.length <= 1) {
                        const newCode = loginForm.twoFactorCode.split('');
                        newCode[index] = value;
                        const updatedCode = newCode.join('').slice(0, 6);
                        setLoginForm(prev => ({ ...prev, twoFactorCode: updatedCode }));
                        
                        // Auto-focus next input
                        if (value && index < 5) {
                          const nextInput = e.target.parentElement?.children[index + 1] as HTMLInputElement;
                          nextInput?.focus();
                        }
                        
                        // Auto-submit when 6 digits are entered
                        if (updatedCode.length === 6) {
                          setTimeout(() => verify2FA(), 300);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Handle backspace
                      if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
                        const prevInput = e.currentTarget.parentElement?.children[index - 1] as HTMLInputElement;
                        prevInput?.focus();
                      }
                      // Handle paste
                      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        navigator.clipboard.readText().then(text => {
                          const numbers = text.replace(/[^0-9]/g, '').slice(0, 6);
                          setLoginForm(prev => ({ ...prev, twoFactorCode: numbers }));
                          if (numbers.length === 6) {
                            setTimeout(() => verify2FA(), 300);
                          }
                        });
                      }
                    }}
                    className={`w-10 h-12 text-center text-xl font-mono border-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary ${
                      loginForm.twoFactorCode[index] 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* Simple help text */}
              <p className="text-xs text-center text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRequiresTwoFactor(false);
                    setTempToken(null);
                    setLoginForm(prev => ({ ...prev, twoFactorCode: '' }));
                    setError('');
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={verify2FA}
                  disabled={loading || loginForm.twoFactorCode.length < 6}
                  loading={loading}
                  className="flex-1"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}