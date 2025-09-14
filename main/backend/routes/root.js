'use strict'

module.exports = async function (fastify, opts) {
  // Health check endpoint (unprotected)
  fastify.get('/', async function (request, reply) {
    return { 
      service: 'ft_transcendence_main_backend',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  })

  // Protected API endpoints
  fastify.register(async function (fastify) {
    fastify.get('/api/profile', {
      preHandler: fastify.authenticate
    }, async function (request, reply) {
      const user = fastify.getCurrentUser(request);
      return { 
        message: 'This is a protected route',
        user: user,
        timestamp: new Date().toISOString()
      }
    })

    fastify.get('/api/game-data', {
      preHandler: fastify.authenticate
    }, async function (request, reply) {
      const user = fastify.getCurrentUser(request);
      return { 
        message: 'Game data for authenticated user',
        userId: user.id,
        username: user.username,
        gameStats: {
          gamesPlayed: 0,
          wins: 0,
          losses: 0
        }
      }
    })
  })
}
