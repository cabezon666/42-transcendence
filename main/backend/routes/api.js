'use strict'

// Auth middleware to validate tokens with auth server
async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Validate token with auth server
    const response = await fetch(`${process.env.AUTH_SERVER_URL}/validate`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
    
    const userData = await response.json();
    request.user = userData.user; // Attach user data to request
  } catch (error) {
    return reply.code(401).send({ error: 'Token validation failed' });
  }
}

module.exports = async function (fastify, opts) {
  // Public endpoint - no auth required
  fastify.get('/status', async function (request, reply) {
    return { 
      service: 'main-backend',
      status: 'running',
      timestamp: new Date().toISOString(),
      auth_required: false
    };
  });

  // Protected endpoint - requires valid JWT from auth server
  fastify.get('/protected-data', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    return {
      message: 'This is protected data from the main backend!',
      user: request.user,
      server_time: new Date().toISOString(),
      auth_validated_by: 'auth_server',
      access_level: 'authenticated_user'
    };
  });

  // Another protected endpoint - user profile data
  fastify.get('/user-stats', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    // Simulate some user statistics
    return {
      user_id: request.user.id,
      username: request.user.username,
      stats: {
        login_count: Math.floor(Math.random() * 100) + 1,
        last_login: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
        account_age_days: Math.floor((Date.now() - new Date(request.user.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        profile_completeness: '85%'
      },
      generated_at: new Date().toISOString()
    };
  });

  // Protected POST endpoint - requires auth
  fastify.post('/user-action', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    const { action, data } = request.body;
    
    return {
      success: true,
      message: `Action '${action}' performed successfully`,
      user: request.user.username,
      action_data: data,
      timestamp: new Date().toISOString()
    };
  });

  // Template endpoints for new features - implement as needed

  // Pong Leaderboard API
  fastify.get('/pong-leaderboard', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    // Template: Implement pong game statistics from database
    return {
      message: 'Template: Return pong leaderboard data',
      data: [
        { id: 1, username: 'player1', wins: 10, losses: 2, winRate: 83.3 },
        // ... more players
      ]
    };
  });

  // Game Invitation API
  fastify.post('/game-invite', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    const { targetUserId, gameType } = request.body;
    // Template: Store game invitation in database and notify via Socket.IO
    return {
      success: true,
      message: 'Template: Game invitation sent via Socket.IO',
      inviteId: `invite_${Date.now()}`
    };
  });

  // User Game Stats API
  fastify.get('/user-game-stats/:userId', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    const { userId } = request.params;
    // Template: Get user's game statistics from database
    return {
      userId,
      wins: 15,
      losses: 5,
      totalGames: 20,
      winRate: 75.0,
      rank: 3
    };
  });

  // Chat System APIs

  // Search users for chat
  fastify.get('/users/search', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    const { q: query, limit = 10 } = request.query;
    
    if (!query || query.trim().length < 2) {
      return { users: [] };
    }

    try {
      // Make database request to SQLite service
      const response = await fetch(`${process.env.SQLITE_API_URL || 'http://sqlite:7000'}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SQLITE_API_TOKEN || 'secure-random-token-change-me'}`
        },
        body: JSON.stringify({
          sql: `
            SELECT id, username, email
            FROM users
            WHERE (username LIKE ? OR email LIKE ?) 
            AND id != ? 
            AND is_active = 1
            ORDER BY username
            LIMIT ?
          `,
          params: [`%${query.trim()}%`, `%${query.trim()}%`, request.user.id, parseInt(limit)]
        })
      });

      if (!response.ok) {
        throw new Error('Database query failed');
      }

      const users = await response.json();
      return { users: users.map(user => ({ id: user.id, username: user.username })) };
    } catch (error) {
      request.log.error('Error searching users:', error);
      return reply.code(500).send({ error: 'Failed to search users' });
    }
  });

  // Get user's chats
  fastify.get('/chats', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    try {
      // Make database request to SQLite service
      const response = await fetch(`${process.env.SQLITE_API_URL || 'http://sqlite:7000'}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SQLITE_API_TOKEN || 'secure-random-token-change-me'}`
        },
        body: JSON.stringify({
          sql: `
            SELECT 
              c.id,
              c.name,
              c.type,
              c.created_at,
              c.updated_at,
              COUNT(CASE WHEN m.created_at > cp.last_read_at THEN 1 END) as unread_count,
              (
                SELECT message
                FROM messages m2
                WHERE m2.chat_id = c.id AND m2.deleted_at IS NULL
                ORDER BY m2.created_at DESC
                LIMIT 1
              ) as last_message,
              (
                SELECT m2.created_at
                FROM messages m2
                WHERE m2.chat_id = c.id AND m2.deleted_at IS NULL
                ORDER BY m2.created_at DESC
                LIMIT 1
              ) as last_message_at
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            LEFT JOIN messages m ON c.id = m.chat_id AND m.deleted_at IS NULL
            WHERE cp.user_id = ? AND cp.is_active = 1
            GROUP BY c.id
            ORDER BY c.updated_at DESC
          `,
          params: [request.user.id]
        })
      });

      if (!response.ok) {
        throw new Error('Database query failed');
      }

      const chats = await response.json();

      // For private chats, get the other participant's info
      for (let chat of chats) {
        if (chat.type === 'private') {
          const participantResponse = await fetch(`${process.env.SQLITE_API_URL || 'http://sqlite:7000'}/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SQLITE_API_TOKEN || 'secure-random-token-change-me'}`
            },
            body: JSON.stringify({
              sql: `
                SELECT u.id, u.username
                FROM users u
                JOIN chat_participants cp ON u.id = cp.user_id
                WHERE cp.chat_id = ? AND cp.user_id != ? AND cp.is_active = 1
              `,
              params: [chat.id, request.user.id]
            })
          });

          if (participantResponse.ok) {
            const participants = await participantResponse.json();
            if (participants.length > 0) {
              chat.other_user = participants[0];
              chat.name = participants[0].username;
            }
          }
        }
      }

      return { chats };
    } catch (error) {
      request.log.error('Error getting chats:', error);
      return reply.code(500).send({ error: 'Failed to load chats' });
    }
  });

  // Get messages for a specific chat
  fastify.get('/chats/:chatId/messages', {
    preHandler: authMiddleware
  }, async function (request, reply) {
    const { chatId } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    try {
      // First verify user is participant
      const participantResponse = await fetch(`${process.env.SQLITE_API_URL || 'http://sqlite:7000'}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SQLITE_API_TOKEN || 'secure-random-token-change-me'}`
        },
        body: JSON.stringify({
          sql: `SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ? AND is_active = 1`,
          params: [chatId, request.user.id]
        })
      });

      if (!participantResponse.ok) {
        return reply.code(500).send({ error: 'Database error' });
      }

      const isParticipant = await participantResponse.json();
      if (isParticipant.length === 0) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Get messages
      const messagesResponse = await fetch(`${process.env.SQLITE_API_URL || 'http://sqlite:7000'}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SQLITE_API_TOKEN || 'secure-random-token-change-me'}`
        },
        body: JSON.stringify({
          sql: `
            SELECT 
              m.id,
              m.message,
              m.message_type,
              m.created_at,
              m.sender_id,
              u.username as sender_username
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ? AND m.deleted_at IS NULL
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
          `,
          params: [chatId, parseInt(limit), parseInt(offset)]
        })
      });

      if (!messagesResponse.ok) {
        throw new Error('Database query failed');
      }

      const messages = await messagesResponse.json();
      return { messages: messages.reverse() }; // Return in chronological order
    } catch (error) {
      request.log.error('Error getting chat messages:', error);
      return reply.code(500).send({ error: 'Failed to load messages' });
    }
  });
}