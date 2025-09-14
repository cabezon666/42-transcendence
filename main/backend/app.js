'use strict'

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

  // Socket.IO integration with Fastify
  await fastify.register(async function (fastify) {
    const { Server } = require('socket.io');
    
    // Global state management
    const connectedUsers = new Map();  // socket.id -> user info
    const activeGames = new Map(); // gameId -> game state
    const gameRooms = new Map(); // roomId -> { players: [], spectators: [] }
    
    let globalStats = {
      connectedUsers: 0,
      activeGames: 0,
      messagesCount: 0
    };

    // Initialize Socket.IO after Fastify is ready
    fastify.addHook('onReady', async function () {
      const io = new Server(fastify.server, {
        cors: {
          origin: [
            'https://localhost:8443',
            'http://localhost:8080',
            'http://localhost:3000'
          ],
          credentials: true
        },
        path: '/socket.io/'
      });

      console.log('🔌 Socket.IO server initialized');

      // Authentication middleware for socket connections
      io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (token) {
          socket.userId = token; 
        } else {
          socket.userId = `guest_${socket.id.substring(0, 8)}`;
        }
        socket.username = socket.handshake.auth.username || socket.userId;
        console.log(`Socket auth: userId=${socket.userId}, username=${socket.username}`);
        next();
      });

      // Connection handler
      io.on('connection', (socket) => {
        // Register user
        connectedUsers.set(socket.id, {
          userId: socket.userId,
          username: socket.username,
          connectedAt: new Date(),
          currentRoom: null,
          isPlaying: false
        });

        globalStats.connectedUsers = connectedUsers.size;
        console.log(`User connected: ${socket.username} (${socket.id})`);
        console.log(`Total connected users: ${globalStats.connectedUsers}`);

        // Welcome message
        socket.emit('hello', {
          message: 'Bienvenue sur le serveur !',
          socketId: socket.id,
          userId: socket.userId,
          username: socket.username,
          serverStats: globalStats,
        });

        // Notify other users
        socket.broadcast.emit('user-online', {
          userId: socket.userId,
          username: socket.username
        });

        // Send online users list
        socket.emit('online-users', Array.from(connectedUsers.values()));

        // Chat system
        socket.on('chat_message', (data) => {
          if (!data.message || data.message.trim().length === 0) return;
          
          const chatMessage = {
            id: socket.id,
            userId: socket.userId,
            username: socket.username,
            message: data.message.trim(),
            timestamp: new Date().toISOString(),
            type: 'global'
          };

          console.log(`Global chat from ${socket.username}: ${data.message}`);
          globalStats.messagesCount++;
          io.emit('chat_message', chatMessage);
        });

        // Private messages
        socket.on('private_message', (data) => {
          const { to, message } = data;
          if (!to || !message || message.trim().length === 0) return;
          
          const privateMessage = {
            from: socket.userId,
            fromUsername: socket.username,
            to: to,
            message: message.trim(),
            timestamp: new Date().toISOString(),
            type: 'private'
          };

          const targetSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === to);

          if (targetSocket) {
            io.to(targetSocket[0]).emit('private_message', privateMessage);
            socket.emit('private_message_sent', privateMessage);
            console.log(`Private message from ${socket.username} to ${to}`);
          } else {
            socket.emit('error', { message: 'User not found or offline' });
          }
        });

        // Room chat
        socket.on('room_chat', (data) => {
          const { roomId, message } = data;
          if (!roomId || !message || message.trim().length === 0) return;

          const roomMessage = {
            id: socket.id,
            userId: socket.userId,
            username: socket.username,
            message: message.trim(),
            roomId: roomId,
            timestamp: new Date().toISOString(),
            type: 'room'
          };

          io.to(roomId).emit('room_chat', roomMessage);
          console.log(`Room chat [${roomId}] from ${socket.username}: ${message}`);
        });

        // Game invites
        socket.on('game_invite', (invite) => {
          if (!invite.to || !invite.gameType) return;
          
          const targetSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === invite.to);
          
          if (targetSocket) {
            io.to(targetSocket[0]).emit('game_invite', invite);
            console.log(`Game invite sent by ${socket.username} to ${invite.to}`);
          } else {
            socket.emit('error', { message: 'User not found for invitation' });
          }
        });

        socket.on('accept_game_invite', (data) => {
          console.log(`Invite accepted: ${data.inviteId}`);
          socket.broadcast.emit('game_invite_accepted', data);
        });

        socket.on('decline_game_invite', (data) => {
          console.log(`Invite declined: ${data.inviteId}`);
          socket.broadcast.emit('game_invite_declined', data);
        });

        // Disconnect handler
        socket.on('disconnect', () => {
          console.log(`User disconnected: ${socket.username} (${socket.id})`);
          
          connectedUsers.delete(socket.id);
          globalStats.connectedUsers = connectedUsers.size;
          
          socket.broadcast.emit('user-offline', {
            userId: socket.userId,
            username: socket.username
          });
          
          console.log(`Connected users: ${globalStats.connectedUsers}`);
        });
      });
    });
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
