const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Add fetch polyfill for Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class UserService {
  constructor() {
    this.saltRounds = 12;
    this.sqliteApiUrl = process.env.SQLITE_API_URL || 'http://sqlite:7000';
    this.sqliteApiToken = process.env.SQLITE_API_TOKEN || 'secure-random-token-change-me';
  }

  async executeQuery(sql, params = []) {
    try {
      const response = await fetch(`${this.sqliteApiUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sqliteApiToken}`
        },
        body: JSON.stringify({ sql, params })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Database query failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async isUsernameTaken(username) {
    const result = await this.executeQuery(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    return result.length > 0;
  }

  // Generate a unique user ID
  generateUserId() {
    return crypto.randomUUID();
  }

  // Hash password
  async hashPassword(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  // Verify password
  async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  // Create a new user with email/password
  async createUser(userData) {
    const { email, password, username } = userData;

    // Validate required fields
    if (!username) throw new Error('Username is required');
    if (!password) throw new Error('Password is required');
    if (!email) throw new Error('Email is required');

    // Check if email already exists
    const existingEmail = await this.executeQuery(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase()]
    );
    if (existingEmail.length > 0) {
      throw new Error('Email already registered');
    }

    // Check if username is taken
    if (await this.isUsernameTaken(username)) {
      throw new Error('Username already taken');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(password);

    // Generate user ID
    const userId = this.generateUserId();

    // Insert user
    await this.executeQuery(`
      INSERT INTO users (id, email, username, password, last_login)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, email.toLowerCase(), username, hashedPassword, new Date().toISOString()]);

    // Return sanitized user
    return this.getUserById(userId);
  }

  // Authenticate user with email/username and password
  async authenticateUser(emailOrUsername, password) {
    // Try to find user by email first, then by username
    let users = await this.executeQuery(
      'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
      [emailOrUsername.toLowerCase()]
    );

    // If no user found by email, try username
    if (users.length === 0) {
      users = await this.executeQuery(
        'SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1',
        [emailOrUsername]
      );
    }

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];
    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.executeQuery(
      'UPDATE users SET last_login = ? WHERE id = ?',
      [new Date().toISOString(), user.id]
    );

    return this.sanitizeUser(user);
  }

  // Get user by ID
  async getUserById(userId) {
    const users = await this.executeQuery(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    return users.length > 0 ? this.sanitizeUser(users[0]) : null;
  }

  // Get user by email
  async getUserByEmail(email) {
    const users = await this.executeQuery(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase()]
    );
    return users.length > 0 ? this.sanitizeUser(users[0]) : null;
  }

  // Check if provider is already linked to any user
  async isProviderLinked(provider, providerId) {
    const result = await this.executeQuery(
      'SELECT user_id FROM oauth_providers WHERE provider = ? AND provider_user_id = ? LIMIT 1',
      [provider, providerId]
    );
    return result.length > 0;
  }

  // Get user by provider
  async getUserByProvider(provider, providerId) {
    const result = await this.executeQuery(
      'SELECT user_id FROM oauth_providers WHERE provider = ? AND provider_user_id = ? LIMIT 1',
      [provider, providerId]
    );
    
    if (result.length === 0) {
      return null;
    }

    return this.getUserById(result[0].user_id);
  }

  // Link OAuth provider to existing user
  async linkProvider(userId, providerData) {
    const { provider, providerId, username, email, avatar } = providerData;

    // Check if provider is already linked to another user
    const existingLink = await this.executeQuery(
      'SELECT user_id FROM oauth_providers WHERE provider = ? AND provider_user_id = ? LIMIT 1',
      [provider, providerId]
    );

    if (existingLink.length > 0 && existingLink[0].user_id !== userId) {
      throw new Error('This provider account is already linked to another user');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Insert or update provider link
    await this.executeQuery(`
      INSERT OR REPLACE INTO oauth_providers 
      (user_id, provider, provider_user_id, username, email, avatar)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, provider, providerId, username, email, avatar]);

    return this.getUserById(userId);
  }

  // Unlink OAuth provider from user
  async unlinkProvider(userId, provider) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const result = await this.executeQuery(
      'DELETE FROM oauth_providers WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );

    if (result.changes === 0) {
      throw new Error('Provider not linked to this user');
    }

    // Also remove OAuth tokens
    await this.executeQuery(
      'DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );

    return this.getUserById(userId);
  }

  // Get linked providers for a user
  async getLinkedProviders(userId) {
    const providers = await this.executeQuery(
      'SELECT provider, username, avatar, linked_at FROM oauth_providers WHERE user_id = ?',
      [userId]
    );

    return providers.map(p => ({
      provider: p.provider,
      username: p.username,
      avatar: p.avatar,
      linkedAt: p.linked_at
    }));
  }

  // Store OAuth tokens
  async storeOAuthTokens(userId, provider, tokens) {
    const expiresAt = tokens.expires_in ? 
      new Date(Date.now() + tokens.expires_in * 1000).toISOString() : 
      null;

    await this.executeQuery(`
      INSERT OR REPLACE INTO oauth_tokens 
      (user_id, provider, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, provider, tokens.access_token, tokens.refresh_token, expiresAt]);
  }

  // Get OAuth tokens for user and provider
  async getOAuthTokens(userId, provider) {
    const result = await this.executeQuery(
      'SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = ? LIMIT 1',
      [userId, provider]
    );
    
    return result.length > 0 ? result[0] : null;
  }

  // Remove OAuth tokens
  async removeOAuthTokens(userId, provider = null) {
    if (provider) {
      await this.executeQuery(
        'DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?',
        [userId, provider]
      );
    } else {
      await this.executeQuery(
        'DELETE FROM oauth_tokens WHERE user_id = ?',
        [userId]
      );
    }
  }

  // Update user profile
  async updateUser(userId, updates) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const allowedUpdates = ['username', 'email'];
    const validUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        validUpdates[key] = updates[key];
      }
    }

    // Handle email update
    if (validUpdates.email && validUpdates.email !== user.email) {
      const newEmail = validUpdates.email.toLowerCase();
      
      // Check if new email is already taken
      const existingEmail = await this.executeQuery(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
        [newEmail, userId]
      );
      if (existingEmail.length > 0) {
        throw new Error('Email already in use');
      }
      
      validUpdates.email = newEmail;
      validUpdates.email_verified = 0; // Reset verification status
    }

    // Handle username update
    if (validUpdates.username && validUpdates.username !== user.username) {
      const existingUsername = await this.executeQuery(
        'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
        [validUpdates.username, userId]
      );
      if (existingUsername.length > 0) {
        throw new Error('Username already taken');
      }
    }

    // Build update query
    const updateFields = Object.keys(validUpdates);
    if (updateFields.length === 0) {
      return user;
    }

    const setClause = updateFields.map(field => `${field} = ?`).join(', ');
    const values = [...Object.values(validUpdates), new Date().toISOString(), userId];

    await this.executeQuery(
      `UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`,
      values
    );

    return this.getUserById(userId);
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const users = await this.executeQuery(
      'SELECT password FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, users[0].password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(newPassword);

    await this.executeQuery(
      'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, new Date().toISOString(), userId]
    );

    return { success: true };
  }

  // Generate JWT token
  generateJWT(user, is2FAVerified = false) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      providers: user.providers || [],
      twoFactorVerified: is2FAVerified
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { 
      expiresIn: '24h',
      issuer: 'auth-server'
    });
  }

  // Generate temporary JWT for 2FA verification
  generateTempJWT(user) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      temp2FA: true
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { 
      expiresIn: '10m', // Short-lived for 2FA verification
      issuer: 'auth-server'
    });
  }

  // Verify JWT token
  verifyJWT(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

    // ===== END 2FA METHODS =====

  // ===== AVATAR METHODS =====

  // Update user avatar
  async updateAvatar(userId, avatarBuffer, mimeType) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      throw new Error('Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    // Convert buffer to base64 for JSON transmission
    const avatarBase64 = avatarBuffer.toString('base64');

    await this.executeQuery(
      'UPDATE users SET avatar = ?, avatar_mimetype = ?, updated_at = ? WHERE id = ?',
      [avatarBase64, mimeType, new Date().toISOString(), userId]
    );

    return { success: true };
  }

  // Get user avatar
  async getAvatar(userId) {
    const result = await this.executeQuery(
      'SELECT avatar, avatar_mimetype FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (result.length === 0) {
      throw new Error('User not found');
    }

    const user = result[0];
    if (!user.avatar) {
      return null;
    }

    // Convert base64 string back to buffer
    const avatarBuffer = Buffer.from(user.avatar, 'base64');

    return {
      data: avatarBuffer,
      mimeType: user.avatar_mimetype
    };
  }

  // Remove user avatar
  async removeAvatar(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await this.executeQuery(
      'UPDATE users SET avatar = NULL, avatar_mimetype = NULL, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), userId]
    );

    return { success: true };
  }

  // ===== END AVATAR METHODS =====

  // Setup 2FA for user
  async setup2FA(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.twoFactor.enabled) {
      throw new Error('2FA is already enabled for this user');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${user.email}`,
      issuer: 'Transcendence Auth',
      length: 32
    });

    // Store the secret temporarily (not enabled yet)
    await this.executeQuery(
      'UPDATE users SET two_factor_secret = ? WHERE id = ?',
      [secret.base32, userId]
    );

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    };
  }

  // Verify 2FA setup and enable it
  async verify2FASetup(userId, token) {
    const users = await this.executeQuery(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    if (!user.two_factor_secret) {
      throw new Error('2FA setup not initiated');
    }

    if (user.two_factor_enabled) {
      throw new Error('2FA is already enabled');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps of variance
    });

    if (!verified) {
      throw new Error('Invalid 2FA code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const backupCodesData = backupCodes.map(code => ({
      code: code,
      used: false,
      usedAt: null
    }));
    
    // Enable 2FA
    await this.executeQuery(
      'UPDATE users SET two_factor_enabled = 1, backup_codes = ? WHERE id = ?',
      [JSON.stringify(backupCodesData), userId]
    );

    return {
      enabled: true,
      backupCodes: backupCodes
    };
  }

  // Generate backup codes
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      codes.push(crypto.randomInt(10000000, 99999999).toString());
    }
    return codes;
  }

  // Verify 2FA token
  async verify2FA(userId, token) {
    const users = await this.executeQuery(
      'SELECT two_factor_enabled, two_factor_secret, backup_codes FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    if (!user.two_factor_enabled) {
      throw new Error('2FA is not enabled for this user');
    }

    // Check if it's a backup code
    if (token.length === 8 && !isNaN(token)) {
      return this.verifyBackupCode(userId, token, user.backup_codes);
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      throw new Error('Invalid 2FA code');
    }

    return { verified: true, method: 'totp' };
  }

  // Verify backup code
  async verifyBackupCode(userId, code, backupCodesJson) {
    let backupCodes = [];
    try {
      backupCodes = backupCodesJson ? JSON.parse(backupCodesJson) : [];
    } catch (e) {
      backupCodes = [];
    }

    const backupCode = backupCodes.find(
      bc => bc.code === code && !bc.used
    );

    if (!backupCode) {
      throw new Error('Invalid backup code');
    }

    // Mark backup code as used
    backupCode.used = true;
    backupCode.usedAt = new Date().toISOString();

    // Update backup codes in database
    await this.executeQuery(
      'UPDATE users SET backup_codes = ? WHERE id = ?',
      [JSON.stringify(backupCodes), userId]
    );

    return { verified: true, method: 'backup_code' };
  }

  // Disable 2FA
  async disable2FA(userId, currentPassword, token) {
    const users = await this.executeQuery(
      'SELECT password, two_factor_enabled FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    if (!user.two_factor_enabled) {
      throw new Error('2FA is not enabled');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Verify 2FA token
    await this.verify2FA(userId, token);

    // Disable 2FA
    await this.executeQuery(
      'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, backup_codes = NULL WHERE id = ?',
      [userId]
    );

    return { disabled: true };
  }

  // Get 2FA status
  async get2FAStatus(userId) {
    const users = await this.executeQuery(
      'SELECT two_factor_enabled, backup_codes FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    let backupCodesRemaining = 0;

    if (user.backup_codes) {
      try {
        const backupCodes = JSON.parse(user.backup_codes);
        backupCodesRemaining = backupCodes.filter(bc => !bc.used).length;
      } catch (e) {
        backupCodesRemaining = 0;
      }
    }

    return {
      enabled: !!user.two_factor_enabled,
      backupCodesRemaining: backupCodesRemaining
    };
  }

  // Regenerate backup codes
  async regenerateBackupCodes(userId, currentPassword, token) {
    const users = await this.executeQuery(
      'SELECT password, two_factor_enabled FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    if (!user.two_factor_enabled) {
      throw new Error('2FA is not enabled');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Verify 2FA token
    await this.verify2FA(userId, token);

    // Generate new backup codes
    const newBackupCodes = this.generateBackupCodes();
    const backupCodesData = newBackupCodes.map(code => ({
      code: code,
      used: false,
      usedAt: null
    }));

    await this.executeQuery(
      'UPDATE users SET backup_codes = ? WHERE id = ?',
      [JSON.stringify(backupCodesData), userId]
    );

    return {
      backupCodes: newBackupCodes
    };
  }

  // Check if user requires 2FA verification
  requires2FA(user) {
    return user.twoFactor && user.twoFactor.enabled;
  }

  // Remove sensitive data from user object
  sanitizeUser(user) {
    if (!user) return null;

    // Parse backup codes if they exist
    let backupCodes = [];
    try {
      backupCodes = user.backup_codes ? JSON.parse(user.backup_codes) : [];
    } catch (e) {
      backupCodes = [];
    }

    const sanitized = {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      emailVerified: !!user.email_verified,
      isActive: !!user.is_active,
      hasAvatar: !!(user.avatar && user.avatar.length > 0),
      twoFactor: {
        enabled: !!user.two_factor_enabled,
        backupCodesRemaining: backupCodes.filter(bc => !bc.used).length
      }
    };

    return sanitized;
  }

  // Development/testing methods
  async getAllUsers() {
    const users = await this.executeQuery('SELECT * FROM users');
    return users.map(user => this.sanitizeUser(user));
  }

  async deleteUser(userId) {
    const result = await this.executeQuery(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    if (result.changes === 0) {
      throw new Error('User not found');
    }

    return { success: true };
  }
}

module.exports = UserService;