const fp = require('fastify-plugin');

async function authPlugin(fastify, opts) {
  const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://auth_server:3000';
  
  // Import fetch dynamically since it's an ES module
  const { default: fetch } = await import('node-fetch');

  // Register authentication function
  fastify.decorate('authenticate', async function(request, reply) {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];

    try {
      // Validate token with auth server
      const response = await fetch(`${AUTH_SERVER_URL}/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        return reply.code(401).send({ error: 'Invalid or expired token' });
      }

      const userData = await response.json();
      
      // Add user data to request object
      request.user = userData.user;
      
    } catch (error) {
      fastify.log.error('Auth validation error:', error);
      return reply.code(500).send({ error: 'Authentication service unavailable' });
    }
  });

  // Helper decorator to get current user
  fastify.decorate('getCurrentUser', function(request) {
    return request.user;
  });
}

module.exports = fp(authPlugin);