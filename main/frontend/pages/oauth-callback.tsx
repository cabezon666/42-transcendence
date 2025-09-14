import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';

export default function OAuthCallback() {
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = () => {
      // Check if we're in a popup window
      const isPopup = window.opener && window.opener !== window;
      
      if (isPopup) {
        // We're in a popup, communicate with parent window
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const error = urlParams.get('error');
        const provider = urlParams.get('provider');
        const token = urlParams.get('token');
        const linked = urlParams.get('linked');
        const requiresTwoFactor = urlParams.get('requiresTwoFactor');
        const tempToken = urlParams.get('tempToken');
        
        if (success === 'true') {
          // OAuth was successful
          if (token) {
            // Update parent window's auth context if we have a token
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              provider: provider,
              token: token,
              linked: linked === 'true'
            }, window.location.origin);
          } else {
            // Success but no token (maybe 2FA required)
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              provider: provider,
              linked: linked === 'true'
            }, window.location.origin);
          }
        } else if (requiresTwoFactor === 'true') {
          // 2FA required - redirect parent to 2FA page
          window.opener.postMessage({
            type: 'OAUTH_2FA_REQUIRED',
            tempToken: tempToken,
            provider: provider
          }, window.location.origin);
        } else {
          // OAuth failed
          let errorMessage = 'OAuth authentication failed';
          switch (error) {
            case 'provider_already_linked_to_you':
              errorMessage = 'This provider is already linked to your account';
              break;
            case 'provider_linked_to_different_user':
              errorMessage = 'This provider is linked to a different account';
              break;
            case 'account_not_found':
              errorMessage = 'No account found for this provider. Please link it first.';
              break;
            case 'invalid_state':
              errorMessage = 'Invalid security state. Please try again.';
              break;
            case 'oauth_error':
              errorMessage = 'OAuth authentication error. Please try again.';
              break;
            default:
              errorMessage = error || 'OAuth authentication failed';
          }
          
          window.opener.postMessage({
            type: 'OAUTH_ERROR',
            message: errorMessage,
            error: error
          }, window.location.origin);
        }
        
        // Close the popup
        window.close();
      } else {
        // Not in popup, handle normally - redirect to dashboard or settings
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const token = urlParams.get('token');
        const requiresTwoFactor = urlParams.get('requiresTwoFactor');
        const tempToken = urlParams.get('tempToken');
        
        if (success === 'true' && token) {
          // Parse user from token and login
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            login(token, payload);
            router.replace('/');
          } catch (error) {
            console.error('Failed to parse token:', error);
            router.replace('/');
          }
        } else if (requiresTwoFactor === 'true' && tempToken) {
          // Redirect to 2FA page with temp token
          router.replace(`/2fa-verify?tempToken=${tempToken}`);
        } else {
          // Redirect to home page with error
          const error = urlParams.get('error');
          router.replace(`/?error=${error || 'oauth_failed'}`);
        }
      }
    };

    // Small delay to ensure everything is loaded
    const timer = setTimeout(handleCallback, 100);
    
    return () => clearTimeout(timer);
  }, [router, login]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="mb-4 text-4xl">🔄</div>
        <p className="text-muted-foreground">Processing OAuth callback...</p>
      </div>
    </div>
  );
}