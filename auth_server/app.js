'use strict'

// Load environment variables
require('dotenv').config();

const path = require('node:path')
const AutoLoad = require('@fastify/autoload')

// Pass --options via CLI arguments in command to enable these options.
const options = {}

module.exports = async function (fastify, opts) {
  // Register CORS for frontend communication
  await fastify.register(require('@fastify/cors'), {
    origin: [
      'https://localhost:8443',
      'http://localhost:8080',
      'http://localhost:3000',
      // Allow additional origins if specified
      ...(process.env.ADDITIONAL_ORIGINS ? process.env.ADDITIONAL_ORIGINS.split(',') : [])
    ],
    credentials: true
  });

  // Register cookie support
  await fastify.register(require('@fastify/cookie'));

  // Register multipart support for file uploads
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
      files: 1 // Only allow one file upload at a time
    }
  });

  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })
}

module.exports.options = options
