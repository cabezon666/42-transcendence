const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class OAuthService {
  constructor(userService) {
    this.userService = userService;
    this.providers = {
      discord: {
        authUrl: 'https://discord.com/api/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        revokeUrl: 'https://discord.com/api/oauth2/token/revoke',
        userUrl: 'https://discord.com/api/users/@me',
        scope: 'identify email',
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET
      },
      github: {
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        revokeUrl: 'https://api.github.com/applications/{client_id}/grant', // Different for GitHub
        userUrl: 'https://api.github.com/user',
        scope: 'user:email',
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET
      }
    };
  }

  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  buildAuthUrl(provider, state) {
    const config = this.providers[provider];
    if (!config) {
      throw new Error(`Provider ${provider} not supported`);
    }

    // Use external URL for OAuth callbacks (Discord needs to reach this)
    const redirectUri = `${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/auth/oauth/${provider}/callback`;
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state: state,
      response_type: 'code'
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(provider, code) {
    const config = this.providers[provider];
    if (!config) {
      throw new Error(`Provider ${provider} not supported`);
    }

    const redirectUri = `${process.env.OAUTH_CALLBACK_URL || 'https://localhost:8443'}/auth/oauth/${provider}/callback`;
    
    const tokenData = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    try {
      console.log(`Exchanging code for tokens with ${provider}:`, {
        tokenUrl: config.tokenUrl,
        redirectUri: redirectUri,
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasCode: !!code
      });
      
      const response = await axios.post(config.tokenUrl, tokenData, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      console.log('Token exchange successful:', { hasAccessToken: !!response.data.access_token });
      return response.data;
    } catch (error) {
      console.error('Token exchange error:', {
        provider: provider,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to exchange code for tokens: ${error.response?.data?.error || error.message}`);
    }
  }

  async getUserInfo(provider, accessToken) {
    const config = this.providers[provider];
    if (!config) {
      throw new Error(`Provider ${provider} not supported`);
    }

    try {
      console.log(`Fetching user info from ${provider} with token`);
      
      const response = await axios.get(config.userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'OAuth-App'
        }
      });

      console.log('User info response received:', {
        hasId: !!response.data.id,
        hasUsername: !!(response.data.login || response.data.username),
        hasEmail: !!response.data.email
      });

      // Normalize user data across providers
      const userData = response.data;
      let normalizedUser = {
        provider: provider,
        providerId: userData.id.toString(),
        username: userData.login || userData.username,
        email: userData.email,
        avatar: userData.avatar_url,
        raw: userData
      };

      // Handle GitHub specific fields and email retrieval
      if (provider === 'github') {
        // GitHub may not return email in the user endpoint, so fetch it separately
        if (!userData.email) {
          try {
            console.log('Fetching GitHub user emails...');
            const emailResponse = await axios.get('https://api.github.com/user/emails', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'OAuth-App'
              }
            });
            
            // Find the primary email or the first verified email
            const emails = emailResponse.data;
            const primaryEmail = emails.find(email => email.primary && email.verified);
            const verifiedEmail = emails.find(email => email.verified);
            
            normalizedUser.email = primaryEmail?.email || verifiedEmail?.email || null;
            console.log('GitHub emails fetched:', { 
              totalEmails: emails.length, 
              foundPrimary: !!primaryEmail,
              foundVerified: !!verifiedEmail,
              selectedEmail: normalizedUser.email
            });
          } catch (emailError) {
            console.error('Failed to fetch GitHub emails:', emailError.response?.data || emailError.message);
          }
        }
      }

      // Handle Discord specific fields
      if (provider === 'discord') {
        normalizedUser.username = userData.username;
        normalizedUser.avatar = userData.avatar 
          ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
          : null;
      }

      return normalizedUser;
    } catch (error) {
      console.error('User info error:', {
        provider: provider,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to get user information: ${error.response?.data?.message || error.message}`);
    }
  }

  generateJWT(user) {
    return this.userService.generateJWT(user);
  }

  verifyJWT(token) {
    return this.userService.verifyJWT(token);
  }

  // Check if provider account exists and get associated user
  async getUserByProvider(provider, providerId) {
    return this.userService.getUserByProvider(provider, providerId);
  }

  // Link provider to existing user (for linking page)
  async linkProviderToUser(userId, providerData) {
    return this.userService.linkProvider(userId, providerData);
  }

  // Check if provider is already linked
  async isProviderLinked(provider, providerId) {
    return this.userService.isProviderLinked(provider, providerId);
  }

  // Store tokens for later revocation
  async storeUserTokens(userId, provider, tokens) {
    await this.userService.storeOAuthTokens(userId, provider, tokens);
  }

  // Revoke OAuth tokens with the provider
  async revokeTokens(userId) {
    try {
      // Get all OAuth tokens for the user
      const providers = await this.userService.getLinkedProviders(userId);
      
      let revocationResults = [];
      
      for (const providerInfo of providers) {
        const tokenData = await this.userService.getOAuthTokens(userId, providerInfo.provider);
        
        if (!tokenData || !tokenData.access_token) {
          console.log('No tokens found for provider:', providerInfo.provider);
          continue;
        }

        const config = this.providers[providerInfo.provider];
        if (!config || !config.revokeUrl) {
          console.log('Token revocation not supported for provider:', providerInfo.provider);
          continue;
        }

        try {
          if (providerInfo.provider === 'discord') {
            await this.revokeDiscordToken(config, tokenData.access_token);
          } else if (providerInfo.provider === 'github') {
            await this.revokeGitHubToken(config, tokenData.access_token);
          }

          // Remove tokens from storage
          await this.userService.removeOAuthTokens(userId, providerInfo.provider);
          
          revocationResults.push({ provider: providerInfo.provider, success: true });
          console.log('Successfully revoked tokens for provider:', providerInfo.provider);
        } catch (error) {
          console.error(`Failed to revoke tokens for ${providerInfo.provider}:`, error);
          revocationResults.push({ provider: providerInfo.provider, success: false, error: error.message });
        }
      }

      const successfulRevocations = revocationResults.filter(r => r.success);
      const failedRevocations = revocationResults.filter(r => !r.success);

      if (revocationResults.length === 0) {
        return { success: false, reason: 'No tokens found' };
      }

      if (failedRevocations.length === 0) {
        return { success: true };
      } else if (successfulRevocations.length > 0) {
        return { 
          success: true, 
          partial: true, 
          reason: `Some revocations failed: ${failedRevocations.map(r => r.provider).join(', ')}` 
        };
      } else {
        return { 
          success: false, 
          reason: `All revocations failed: ${failedRevocations.map(r => r.error).join(', ')}` 
        };
      }
    } catch (error) {
      console.error('Failed to revoke tokens:', error);
      return { success: false, reason: error.message };
    }
  }

  async revokeDiscordToken(config, accessToken) {
    const revokeData = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      token: accessToken
    };

    await axios.post(config.revokeUrl, revokeData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  async revokeGitHubToken(config, accessToken) {
    // GitHub uses DELETE method with Basic Auth
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    
    await axios.delete(`https://api.github.com/applications/${config.clientId}/grant`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      data: {
        access_token: accessToken
      }
    });
  }
}

module.exports = OAuthService;