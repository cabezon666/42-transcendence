const { Server } = require("socket.io");

module.exports = async function (fastify, opts) {
    // Register CORS plugin for Fastify
    await fastify.register(require('@fastify/cors'), {
        origin: [
            'https://localhost:8443', // frontend https en local 
            'http://localhost:8080',  // frontend http en local (alternative)
            'http://localhost:3000',  // frontend en next.js dev serv
        ],
        credentials: true // permet l envoie de cookies et headers d autentification
    });

    // Config Socket.IO
    const io = new Server(fastify.server, {
        cors: {
            origin: [
                'https://localhost:8443',
                'http://localhost:8080',
                'http://localhost:3000' // Fixed typo from original
            ],
            credentials: true,
            methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling'], // Fixed typo from 'transport'
        allowEIO3: true
    });

    // Gestion d etat globale
    const connectedUsers = new Map();
    const activeGames = new Map();
    const gameRooms = new Map();

    let globalStats = {
        connectedUsers: 0,
        activeGames: 0,
        messageCount: 0, // Fixed typo from 'MessageCount'
        serverStartTime: new Date().toISOString() // Fixed typo from 'toISOtring'
    };

    console.log("vrai temps server de fils de pute se lance . . .");

    // Database interaction utilities
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const sqliteApiUrl = process.env.SQLITE_API_URL || 'http://sqlite:7000';
    const sqliteApiToken = process.env.SQLITE_API_TOKEN || 'secure-random-token-change-me';

    async function executeQuery(sql, params = []) {
        try {
            const response = await fetch(`${sqliteApiUrl}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sqliteApiToken}`
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

    // Chat database utilities
    async function createOrGetChat(userId1, userId2) {
        try {
            // Check if chat already exists between these two users
            const existingChats = await executeQuery(`
                SELECT c.id, c.name, c.type, c.created_at
                FROM chats c
                JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = ?
                JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = ?
                WHERE c.type = 'private' AND cp1.is_active = 1 AND cp2.is_active = 1
                LIMIT 1
            `, [userId1, userId2]);

            if (existingChats.length > 0) {
                return existingChats[0];
            }

            // Create new chat
            const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            
            await executeQuery(`
                INSERT INTO chats (id, type, created_by)
                VALUES (?, 'private', ?)
            `, [chatId, userId1]);

            // Add both users to the chat
            await executeQuery(`
                INSERT INTO chat_participants (chat_id, user_id)
                VALUES (?, ?), (?, ?)
            `, [chatId, userId1, chatId, userId2]);

            return { id: chatId, type: 'private', created_at: new Date().toISOString() };
        } catch (error) {
            console.error('Error creating/getting chat:', error);
            throw error;
        }
    }

    async function saveMessage(chatId, senderId, message, messageType = 'text') {
        try {
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            
            await executeQuery(`
                INSERT INTO messages (id, chat_id, sender_id, message, message_type)
                VALUES (?, ?, ?, ?, ?)
            `, [messageId, chatId, senderId, message, messageType]);

            // Update chat's updated_at timestamp
            await executeQuery(`
                UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `, [chatId]);

            return messageId;
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    async function getUserChats(userId) {
        try {
            const chats = await executeQuery(`
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
            `, [userId]);

            // For private chats, get the other participant's info
            for (let chat of chats) {
                if (chat.type === 'private') {
                    const otherParticipants = await executeQuery(`
                        SELECT u.id, u.username
                        FROM users u
                        JOIN chat_participants cp ON u.id = cp.user_id
                        WHERE cp.chat_id = ? AND cp.user_id != ? AND cp.is_active = 1
                    `, [chat.id, userId]);

                    if (otherParticipants.length > 0) {
                        chat.other_user = otherParticipants[0];
                        chat.name = otherParticipants[0].username; // Use other user's name for private chats
                    }
                }
            }

            return chats;
        } catch (error) {
            console.error('Error getting user chats:', error);
            throw error;
        }
    }

    async function getChatMessages(chatId, userId, limit = 50, offset = 0) {
        try {
            // First verify user is participant
            const isParticipant = await executeQuery(`
                SELECT 1 FROM chat_participants 
                WHERE chat_id = ? AND user_id = ? AND is_active = 1
            `, [chatId, userId]);

            if (isParticipant.length === 0) {
                throw new Error('User is not a participant in this chat');
            }

            const messages = await executeQuery(`
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
            `, [chatId, limit, offset]);

            return messages.reverse(); // Return in chronological order
        } catch (error) {
            console.error('Error getting chat messages:', error);
            throw error;
        }
    }

    async function markChatAsRead(chatId, userId) {
        try {
            await executeQuery(`
                UPDATE chat_participants 
                SET last_read_at = CURRENT_TIMESTAMP 
                WHERE chat_id = ? AND user_id = ?
            `, [chatId, userId]);
        } catch (error) {
            console.error('Error marking chat as read:', error);
        }
    }

    async function searchUsers(query, currentUserId, limit = 10) {
        try {
            const users = await executeQuery(`
                SELECT id, username, email
                FROM users
                WHERE (username LIKE ? OR email LIKE ?) 
                AND id != ? 
                AND is_active = 1
                ORDER BY username
                LIMIT ?
            `, [`%${query}%`, `%${query}%`, currentUserId, limit]);

            return users;
        } catch (error) {
            console.error('Error searching users:', error);
            throw error;
        }
    }

    // Authentification middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (token) {
                socket.userId = token;
            } else {
                socket.userId = `guest_${socket.id.substring(0, 8)}`;
            }
            socket.username = socket.handshake.auth.username || socket.userId;
            console.log(`l authentification de se fils de pute: ${socket.username}`); // Fixed typo
            next();
        } catch (error) {
            console.log('non pas auth pour le fils de pute de', error);
            next(new Error('fail Auth'));
        }
    });

    // Gestion de connexions
    io.on('connection', async (socket) => {
        console.log(`le fils de pute est connecter : ${socket.username} (${socket.id})`);

        // Enregistrement de l utilisateur
        connectedUsers.set(socket.id, {
            userId: socket.userId,
            username: socket.username,
            connectedAt: new Date(),
            currentRoom: null,
            isPlaying: false,
            lastSeen: new Date() // Fixed typo from 'Data'
        });

        globalStats.connectedUsers = connectedUsers.size;
        console.log(`total de fils de put: ${globalStats.connectedUsers}`);

        // Message de bienvenue
        socket.emit('salut petit fils de pute', {
            message: 'connectee au putain de ft_trans "REAL-TIME"',
            socketId: socket.id,
            userId: socket.userId,
            username: socket.username,
            serverStats: globalStats,
            timestamp: new Date().toISOString() // Fixed typo
        });

        // Notif aux autres utilisateurs
        socket.broadcast.emit('seulement le fils de pute', {
            userId: socket.userId,
            username: socket.username // Fixed typo from 'usernameL'
        });

        // Envoie la liste des utilisateurs en ligne (keeping for compatibility)
        socket.emit('only_users', Array.from(connectedUsers.values()));

        // Send user's chat list on connection
        try {
            console.log('Loading user chats for user:', socket.userId);
            const userChats = await getUserChats(socket.userId);
            console.log('User chats loaded:', userChats?.length || 0, 'chats');
            console.log('Chat details:', userChats);
            socket.emit('user_chats', userChats);
        } catch (error) {
            console.error('Error loading user chats:', error);
        }

        // New Chat System Handlers

        // Get user's chat list
        socket.on('get_chats', async () => {
            try {
                const userChats = await getUserChats(socket.userId);
                socket.emit('user_chats', userChats);
            } catch (error) {
                console.error('Error getting chats:', error);
                socket.emit('error', { message: 'Failed to load chats' });
            }
        });

        // Search for users to start new chats
        socket.on('search_users', async (data) => {
            try {
                console.log('Search users request:', data, 'from user:', socket.userId);
                const { query } = data;
                if (!query || query.trim().length < 2) {
                    console.log('Query too short, returning empty results');
                    socket.emit('search_results', []);
                    return;
                }

                console.log('Searching for users with query:', query.trim());
                const users = await searchUsers(query.trim(), socket.userId);
                console.log('Search results:', users);
                socket.emit('search_results', users);
            } catch (error) {
                console.error('Error searching users:', error);
                socket.emit('error', { message: 'Failed to search users' });
            }
        });

        // Start a new chat with a user
        socket.on('start_chat', async (data) => {
            try {
                console.log('Start chat request:', data, 'from user:', socket.userId);
                const { targetUserId } = data;
                if (!targetUserId) {
                    console.log('No target user ID provided');
                    return;
                }

                console.log('Creating/getting chat between', socket.userId, 'and', targetUserId);
                const chat = await createOrGetChat(socket.userId, targetUserId);
                console.log('Chat created/retrieved:', chat);
                
                // Send updated chat list to both users
                const senderChats = await getUserChats(socket.userId);
                socket.emit('user_chats', senderChats);

                // Notify target user if they're online
                const targetSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === targetUserId);
                if (targetSocket) {
                    console.log('Target user is online, updating their chat list');
                    const targetChats = await getUserChats(targetUserId);
                    io.to(targetSocket[0]).emit('user_chats', targetChats);
                } else {
                    console.log('Target user is offline');
                }

                socket.emit('chat_started', { chatId: chat.id });
            } catch (error) {
                console.error('Error starting chat:', error);
                socket.emit('error', { message: 'Failed to start chat' });
            }
        });

        // Send a message to a specific chat
        socket.on('send_chat_message', async (data) => {
            try {
                const { chatId, message } = data;
                if (!chatId || !message || message.trim().length === 0) return;

                const messageId = await saveMessage(chatId, socket.userId, message.trim());

                const chatMessage = {
                    id: messageId,
                    chatId: chatId,
                    senderId: socket.userId,
                    senderUsername: socket.username,
                    message: message.trim(),
                    messageType: 'text',
                    timestamp: new Date().toISOString()
                };

                // Get all participants in this chat
                const participants = await executeQuery(`
                    SELECT cp.user_id 
                    FROM chat_participants cp 
                    WHERE cp.chat_id = ? AND cp.is_active = 1
                `, [chatId]);

                // Send message to all online participants
                participants.forEach(participant => {
                    const participantSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === participant.user_id);
                    if (participantSocket) {
                        io.to(participantSocket[0]).emit('chat_message_received', chatMessage);
                    }
                });

                // Update chat lists for all participants
                for (const participant of participants) {
                    const participantSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === participant.user_id);
                    if (participantSocket) {
                        try {
                            const updatedChats = await getUserChats(participant.user_id);
                            io.to(participantSocket[0]).emit('user_chats', updatedChats);
                        } catch (error) {
                            console.error('Error updating chat list for participant:', error);
                        }
                    }
                }

                console.log(`Chat message from ${socket.username} in chat ${chatId}: ${message.trim()}`);
                globalStats.messageCount++;

            } catch (error) {
                console.error('Error sending chat message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Get messages for a specific chat
        socket.on('get_chat_messages', async (data) => {
            try {
                console.log('Get chat messages request:', data, 'from user:', socket.userId);
                const { chatId, limit = 50, offset = 0 } = data;
                if (!chatId) {
                    console.log('No chatId provided');
                    return;
                }

                console.log('Getting messages for chat:', chatId);
                const messages = await getChatMessages(chatId, socket.userId, limit, offset);
                console.log('Retrieved messages:', messages?.length || 0, 'messages');
                socket.emit('chat_messages', { chatId, messages });

                // Mark chat as read
                await markChatAsRead(chatId, socket.userId);

                // Send updated chat list (with updated unread counts)
                const userChats = await getUserChats(socket.userId);
                socket.emit('user_chats', userChats);

            } catch (error) {
                console.error('Error getting chat messages:', error);
                socket.emit('error', { message: 'Failed to load messages' });
            }
        });

        // Mark chat as read
        socket.on('mark_chat_read', async (data) => {
            try {
                const { chatId } = data;
                if (!chatId) return;

                await markChatAsRead(chatId, socket.userId);

                // Send updated chat list
                const userChats = await getUserChats(socket.userId);
                socket.emit('user_chats', userChats);

            } catch (error) {
                console.error('Error marking chat as read:', error);
            }
        });

        // Remove/leave a chat
        socket.on('leave_chat', async (data) => {
            try {
                const { chatId } = data;
                if (!chatId) return;

                await executeQuery(`
                    UPDATE chat_participants 
                    SET is_active = 0 
                    WHERE chat_id = ? AND user_id = ?
                `, [chatId, socket.userId]);

                // Send updated chat list
                const userChats = await getUserChats(socket.userId);
                socket.emit('user_chats', userChats);

                socket.emit('chat_left', { chatId });

            } catch (error) {
                console.error('Error leaving chat:', error);
                socket.emit('error', { message: 'Failed to leave chat' });
            }
        });

        // Legacy Global Chat (keeping for compatibility)
        socket.on('chat_message', (data) => {
            if (!data.message || data.message.trim().length === 0) return;

            const chatMessage = {
                id: socket.id,
                userId: socket.userId,
                username: socket.username,
                message: data.message.trim(),
                timestamp: new Date().toISOString(), // Fixed typo
                type: 'global'
            };

            console.log(`chat global qui vien du fils de pute de: ${socket.username}: ${data.message}`);
            globalStats.messageCount++; // Fixed typo
            io.emit('chat_message', chatMessage);
        });

        // Legacy Private Messages (keeping for compatibility)
        socket.on('private_message', (data) => {
            const { to, message } = data;
            if (!to || !message || message.trim().length === 0) return;

            const privateMessage = {
                from: socket.userId,
                fromUsername: socket.username,
                to: to,
                message: message.trim(),
                timestamp: new Date().toISOString(), // Fixed typo
                type: 'private'
            };

            const targetSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === to);

            if (targetSocket) {
                io.to(targetSocket[0]).emit('private_message', privateMessage);
                socket.emit('private_message_sent', privateMessage);
                console.log(`private_message qui vien du fils de pute: ${socket.username} -> ${to}`);
            } else {
                socket.emit('wsh une erreur', { message: 'pas en ligne ou jsp' });
            }
        });

        // Messages dans une room
        socket.on('room_chat', (data) => {
            const { roomId, message } = data;
            if (!roomId || !message || message.trim().length === 0) return; // Fixed typo from 'room'

            const roomMessage = {
                id: socket.id,
                userId: socket.userId,
                username: socket.username,
                message: message.trim(),
                roomId: roomId,
                timestamp: new Date().toISOString(), // Fixed typo
                type: 'room'
            };

            io.to(roomId).emit('room_chat', roomMessage);
            console.log(`room chat [${roomId}] from ${socket.username}: ${message}`);
        });

        // Systeme de rooms
        socket.on('join_room', (data) => {
            const { roomId, roomType = 'lobby' } = data;
            if (!roomId) return;

            if (socket.currentRoom) {
                socket.leave(socket.currentRoom);
                updateRoomInfo(socket.currentRoom);
            }

            socket.join(roomId);
            socket.currentRoom = roomId;

            const userInfo = connectedUsers.get(socket.id);
            if (userInfo) {
                userInfo.currentRoom = roomId;
            }

            if (!gameRooms.has(roomId)) {
                gameRooms.set(roomId, {
                    id: roomId,
                    type: roomType,
                    players: [],
                    spectators: [],
                    createdAt: new Date(),
                    gameState: null
                });
            }

            const room = gameRooms.get(roomId);

            if (roomType === 'game' && room.players.length < 2) {
                room.players.push({
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username,
                    joinedAt: new Date()
                });
                userInfo.isPlaying = true;
            } else {
                room.spectators.push({
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username,
                    joinedAt: new Date()
                });
            }

            socket.emit('room_joined', {
                roomId: roomId,
                roomType: roomType,
                roomInfo: room,
                yourRole: userInfo.isPlaying ? 'player' : 'spectator'
            });

            updateRoomInfo(roomId);
            console.log(`le fils de pute : ${socket.username} a rejoin la room: ${roomId} ${userInfo.isPlaying ? 'player' : 'spectator'}`);
        });

        // Quitter une room
        socket.on('leave_room', () => {
            if (socket.currentRoom) {
                const roomId = socket.currentRoom;
                socket.leave(roomId);
                removeUserFromRoom(socket.id, roomId);
                socket.currentRoom = null;

                const userInfo = connectedUsers.get(socket.id);
                if (userInfo) {
                    userInfo.currentRoom = null;
                    userInfo.isPlaying = false;
                }
                socket.emit('room_left', { roomId });
                updateRoomInfo(roomId);
                console.log(`${socket.username} le fils de pute quitte la game ${roomId}`);
            }
        });

        // Systeme de jeu
        socket.on('create_game', (data) => {
            const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Fixed typo from 'Data'
            const gameSettings = {
                maxScore: data.maxScore || 11, // Fixed unrealistic score
                ballSpeed: data.ballSpeed || 50,
                paddleSpeed: data.paddleSpeed || 100,
                gameMode: data.gameMode || 'classic'
            };

            const gameState = initializeGame(gameId, socket.userId, gameSettings);
            activeGames.set(gameId, gameState);
            globalStats.activeGames = activeGames.size;

            socket.emit('game_created', {
                gameId: gameId,
                gameState: gameState,
                isHost: true // Fixed typo from 'isHote'
            });

            socket.emit('join_room', { roomId: gameId, roomType: 'game' }); // Fixed typo from 'joint_room'
            console.log(`le jeu est cree: ${gameId} par le fils de pute de ${socket.username}`);
        });

        // Rejoindre un jeu
        socket.on('join_game', (data) => { // Fixed typo from 'joint_game'
            const { gameId } = data;
            if (!gameId) {
                socket.emit('error', { message: 'ta pas mit l id de la game fdp' });
                return;
            }

            const game = activeGames.get(gameId);
            if (!game) {
                socket.emit('error', { message: 'pas de jeu trouve ' });
                return;
            }

            if (game.players.length >= 2) {
                socket.emit('join_room', { roomId: gameId, roomType: 'game' }); // Fixed typo
            } else {
                game.players.push({
                    socketId: socket.id,
                    userId: socket.userId,
                    username: socket.username,
                    paddle: game.players.length === 0 ? 'left' : 'right'
                });

                socket.emit('join_room', { roomId: gameId, roomType: 'game' }); // Fixed typo

                if (game.players.length === 2) {
                    startGame(gameId);
                }
            }

            socket.emit('game_joined', {
                gameId: gameId,
                playerId: socket.id,
                game: game
            });

            console.log(`le fils de pute de ${socket.username} a rejoint la game: ${gameId}`);
        });

        // Actions de jeu
        socket.on('game_action', (data) => {
            const { action, gameId, value } = data;
            if (!gameId || !activeGames.has(gameId)) return;

            const game = activeGames.get(gameId);
            const player = game.players.find(p => p.socketId === socket.id);

            if (!player) return;

            switch (action) {
                case 'paddle_up':
                    movePaddle(game, player.paddle, -game.settings.paddleSpeed);
                    break;
                case 'paddle_down':
                    movePaddle(game, player.paddle, game.settings.paddleSpeed);
                    break;
            }

            io.to(gameId).emit('game_state_update', {
                gameId: gameId,
                gameState: game,
                timestamp: new Date().toISOString()
            });
            console.log(`action de jeu ${gameId} qui vient du fils de pute de ${socket.username}: ${action}`);
        });

        // Fonctionnalites sociales
        socket.on('send_friend_request', (data) => {
            const { toUserId } = data;

            const targetSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === toUserId);

            if (targetSocket) {
                io.to(targetSocket[0]).emit('friend_request_received', { // Fixed event name
                    from: socket.userId,
                    fromUsername: socket.username,
                    timestamp: new Date().toISOString()
                });

                socket.emit('friend_request_sent', { to: toUserId });
                console.log(`le fils de pute ${socket.username} te demande en amis -> ${toUserId}`);
            } else {
                socket.emit('error', { message: 'le fils de pute est pas trouver ' });
            }
        });

        // Liste utilisateurs en ligne
        socket.on('get_online_users', () => {
            socket.emit('online_users', Array.from(connectedUsers.values()));
        });

        // Ping pong pour latence
        socket.on('ping', (timestamp) => {
            socket.emit('pong', timestamp);
        });

        // Stats server (admin)
        socket.on('get_server_stats', () => {
            if (socket.userId.includes('admin')) {
                socket.emit('server_stats', {
                    ...globalStats,
                    activeGames: Array.from(activeGames.values()),
                    activeRooms: Array.from(gameRooms.values()),
                    connectedUsers: Array.from(connectedUsers.values())
                });
            }
        });

        // Gestion des deconnexions
        socket.on('disconnect', (reason) => {
            const userInfo = connectedUsers.get(socket.id);
            if (userInfo) {
                console.log(`le fils de pute de ${userInfo.username} est deco (${reason})`);

                if (socket.currentRoom) {
                    removeUserFromRoom(socket.id, socket.currentRoom);
                    updateRoomInfo(socket.currentRoom);
                }

                handleGameDisconnection(socket.id);

                socket.broadcast.emit('user_offline', {
                    userId: userInfo.userId,
                    username: userInfo.username,
                });

                connectedUsers.delete(socket.id);
                globalStats.connectedUsers = connectedUsers.size;
                console.log(`les fdp restant: ${globalStats.connectedUsers}`);
            }
        });
    });

    // Utilitaires
    function updateRoomInfo(roomId) {
        const room = gameRooms.get(roomId);
        if (room) {
            io.to(roomId).emit('room_update', {
                roomId: roomId,
                roomInfo: room
            });
        }
    }

    function removeUserFromRoom(socketId, roomId) {
        const room = gameRooms.get(roomId);
        if (room) {
            room.players = room.players.filter(p => p.socketId !== socketId);
            room.spectators = room.spectators.filter(s => s.socketId !== socketId);
            if (room.players.length === 0 && room.spectators.length === 0) {
                gameRooms.delete(roomId);
            }
        }
    }

    function initializeGame(gameId, hostUserId, settings) {
        return {
            id: gameId,
            status: 'waiting',
            host: hostUserId,
            players: [],
            settings: settings,
            gameState: {
                ball: { x: 400, y: 300, velocityX: 5, velocityY: 3 },
                paddles: { // Fixed typo from 'paddle'
                    left: { y: 250, score: 0 },
                    right: { y: 250, score: 0 },
                },
                field: { width: 800, height: 600 }
            },
            createdAt: new Date(),
            startedAt: null,
            finishedAt: null
        };
    }

    function startGame(gameId) {
        const game = activeGames.get(gameId);
        if (game && game.players.length === 2) {
            game.status = 'playing';
            game.startedAt = new Date();

            io.to(gameId).emit('game_started', {
                gameId: gameId,
                game: game
            });

            const gameLoop = setInterval(() => {
                if (game.status === 'playing') {
                    updateGamePhysics(game); // Fixed typo from 'Physique'
                    io.to(gameId).emit('game_state_update', {
                        gameId: gameId,
                        gameState: game.gameState
                    });

                    if (game.gameState.paddles.left.score >= game.settings.maxScore ||
                        game.gameState.paddles.right.score >= game.settings.maxScore) { // Fixed condition
                        endGame(gameId, gameLoop);
                    }
                } else {
                    clearInterval(gameLoop);
                }
            }, 1000 / 60);
        }
    }

    function updateGamePhysics(game) { // Fixed typo from 'Physique'
        const ball = game.gameState.ball;
        ball.x += ball.velocityX;
        ball.y += ball.velocityY;

        if (ball.y <= 0 || ball.y >= game.gameState.field.height) {
            ball.velocityY = -ball.velocityY;
        }

        if (ball.x <= 0) {
            game.gameState.paddles.right.score++; // Fixed typo from 'paddle'
            resetBall(ball, game.gameState.field);
        } else if (ball.x >= game.gameState.field.width) {
            game.gameState.paddles.left.score++;
            resetBall(ball, game.gameState.field);
        }
    }

    function resetBall(ball, field) {
        ball.x = field.width / 2;
        ball.y = field.height / 2;
        ball.velocityX = -ball.velocityX;
    }

    function updatePaddlePosition(game, paddle, position) {
        if (game.gameState.paddles[paddle]) {
            game.gameState.paddles[paddle].y = Math.max(0, Math.min(game.gameState.field.height - 100, position));
        }
    }

    function movePaddle(game, paddle, delta) {
        if (game.gameState.paddles[paddle]) {
            const newY = game.gameState.paddles[paddle].y + delta; // Fixed typo from 'paddle'
            game.gameState.paddles[paddle].y = Math.max(0, Math.min(game.gameState.field.height - 100, newY));
        }
    }

    function endGame(gameId, gameLoop) {
        const game = activeGames.get(gameId);
        if (game) {
            clearInterval(gameLoop);
            game.status = 'finished';
            game.finishedAt = new Date();

            const winner = game.gameState.paddles.left.score > game.gameState.paddles.right.score ? game.players[0] : game.players[1]; // Fixed typo

            io.to(gameId).emit('game_finished', {
                gameId: gameId,
                winner: winner,
                finalScore: game.gameState.paddles,
                game: game
            });

            setTimeout(() => {
                activeGames.delete(gameId);
                globalStats.activeGames = activeGames.size;
            }, 30000);
        }
    }

    function handleGameDisconnection(socketId) {
        for (const [gameId, game] of activeGames) {
            const playerIndex = game.players.findIndex(p => p.socketId === socketId);
            if (playerIndex !== -1) {
                if (game.status === 'playing') {
                    game.status = 'paused';
                    io.to(gameId).emit('game_paused', {
                        gameId: gameId,
                        reason: 'Player disconnected',
                        disconnectedPlayer: game.players[playerIndex]
                    });
                }
            }
        }
    }

    // Fastify routes - now registered on the passed fastify instance
    fastify.get('/esque-je-suis-tjr-trans', async (request, reply) => {
        return {
            status: 'healthy',
            stats: globalStats,
            uptime: process.uptime(),
        };
    });

    fastify.get('/trop-de-zeub', async (request, reply) => {
        return {
            ...globalStats,
            connectedUsersCount: connectedUsers.size,
            activeGamesCount: activeGames.size,
            uptime: process.uptime()
        };
    });

    console.log("Socket.IO routes and health checks registered!");
};
