const express = require("express") //framework web node.js pour creer des routes http
const { createServer } = require('http') //module http natif pour creer un server http
const { Server } = require("socket.io") //socket.IO pour gerer les cors
const jwt = require('cors') //middleware pour gerer les tokens jwt


//config server
const app = express(); //cree un instance d application Express
const server= createServer(app); //cree un serveur http en utilisant Express comme handler


//config pour autoriser les connexions depuis le frontend
app.use(cors({
    origin: [        //liste des origines autorisees a se connecter
        'https://localhost:8443', //frontend https en local 
        'http://localhost:8080', //frontend http en local (alternative)
        'http://localhost:3000', //frontend en next.js dev serv
    ],
    credentials : true // permet l envoie de cookies et headers d autentification
}));

//middleware expess basique
app.use(express.json()) //parse automatiquement les requetes json entrantes




//config socker io
const io = new Server(server, { //cree uns instance socket io liee au server http
    cors: { //config cors specifique a socket io
        origin: [ //meme origine que express pour coherence
            'https://localhost:8443',
            'http://localhost:8080',
            'http://loacalhost:3000'
        ],
        credentials: true, //autorise les credentials cookies, auth, headers
        methods: ['GET', 'POST'] //methode http autorisees pour les handshakes
    },
    transport: ['websocket', 'polling'], //types de transport: websocket prioritaire, polling en fallback
    allowEIO3: true // Compatible avec Engine.IO version 3
});


//gestion d etat globale
const connectedUsers = new Map(); //map pour stocker les fils de pute connectes: socketId -> userInfo
const activeGames = new Map(); //map pour stocker les jeux actifs : gameId -> gameState
const gameRooms = new Map(); //map pour stocker les rooms/salles : roomId->roomInfo

let globalStats ={  //obj pour stocker les statistiques globales du server
    connectedUsers: 0,  //compteur de fils de pute  
    activeGames: 0, //compteur de game en cours
    MessageCount: 0, //total messages envoyes
    serverStartTime: new Date().toISOtring() //timestamp de demarrage du server
};

console.log("vrai temps server de fils de pute se lance . . .");


//authentification middleware
io.use((socket, next) => { //middleware execute avt chaque nouvelle connexion Socker.io 
    try {  // pour gerer les erreurs d authentification
        const token = socket.handshake.auth.token; //recup les token depuis les donnees d authentification
        if(token) {
            socket.userId = token;
        } else {
            socket.userId = `guest_${socket.id.substring(0,8)}`; //cree id invite  base sur le sockerid
        }
        socket.username = socket.handshake.auth.username || socket.userId; // def nom utilisateur
        console.log(`l authentification de se fils de pute: ${socket.suername}`);
        next();
    } catch (error) {
        console.log('non pas auth pour le fils de pute de', error);
        next(new Error('fail Auth'));
    }
});


//gestion de connexions
io.on('connection', (socket) => { // event handler pour les new connexions Socket.IO
    console.log(`le fils de pute est connecter : ${socket.username} (${socket.id})`); // log

    //enregistrement de l utilisateur dans la map des fils de pute connecte
    connectedUsers.set(socket.id, { // utilise socketId comme cle unique
        userId: socket.userId, // ID utilisateur (token ou guest_xxx)
        username: socket.username, // nom aff utilisateur
        connectedAt: new Date(), // timestamp de connexion
        currentRoom: null, //room actuelle (null = lobby principale)
        isPlaying: false, // flag indiquant si le fils de pute joue actuellement
        lastSeen: new Data() //timestamp de derniere activite
    });

    globalStats.connectedUsers = connectedUsers.size; //met a jour le compteur global
    console.log(`total de fils de put: ${globalStats.connectedUsers}`); //log nbr

    //message de bienvenue anvoye au fils de pute qui vien de se connecter
    console.log('salut petit fils de pute', {
        message: 'connectee au putain de ft_trans "REAL-TIME"', //message de coucou
        socketId: socket.id, //id du socket pour debug
        userId: socket.userId,
        username: socket.username, 
        serverStats: globalStats,
        timestamp: new Data().toISOtring() //timestamp du message
    });

    //notif aux autres  utilisateurs qu un nouvel utilisateur est en ligne
    socket.broadcast.emit('seulement le fils de pute', { //envoie a tous sauf le socket acutel
        userId: socket.userId, //id nouveau fils de pute
        usernameL: socket.username //nom nouveau fils de pute
    });

    //envoie la liste de tous les utiluisateurs en ligne au new fils de pute
    socket.emit('only_users', Array.from(connectedUsers.values())); //convertit la map en array


    //systeme de chat
    //handler pour les messages de chat global
    socket.on('chat_message', (data) => { //ecoute l event chat_message du client
        if (!data.message || data.message.trim().length === 0) return; // validation : message non vide
        
        const chatMessage = { //creation de l objet message stendarise
            id: socket.id, //id du socket expediteur
            userId: socket.userId, //id utilisateur expediteur
            username: socket.username, //nom d affichage expediteur
            message: data.message.trim(), //message nettoye (sans espaces debut/fin)
            timestamp: new Data().toISOtring(), //timestamp du message
            type: 'global' //type de message global, private, room
        };

        console.log(`chat global qui vien du fils de pute de: ${socket.username}: ${data.message}`);
        globalStats.MessageCount++; //invremente le compteur globale de messages
        io.emit('chat_message', chatMessage); //diffuse le message a tous les fils de putes connectes
    });

    //handler pour les messages prives entre utilisateurs
    socket.on('private_message', (data) => { // ecoute event
        const { to, message } = data; // recup destinataire et message
        if (!to || !message || message.trim().length === 0) return; //validation
        
        const privateMessage = { //obj message prive
            from: socket.userId, //expediteur
            fromUsername: socket.username, //nom expediteur
            to: to, //destinataire
            message: message.trim(), //message nettoye
            timestamp: new Data().toISOtring(), //timestamp
            type: 'private' //type message
        };

        //recherche du socket du destinataire dans la map des utilisateurs connectes
        const targetSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === to);

        if (targetSocket) { //si desti co
            io.to(targetSocket[0]).emit('private_message', privateMessage); //envoie dest
            socket.emit('private_message_sent', privateMessage); //confirmation expediteur
            console.log(`private_message qui vien du fils de pute: ${socket.username} -> ${to}`);    
        }else {
            socket.emit('wsh une erreur', { message: 'pas en ligne ou jsp' });
        }
    });

    //handler pour les message dans une room specifique
    socket.on('room_chat', (data) => {  //ecoute event room_chat
        const { roomId, message } = data; //destructuration des donnees
        if (!room || !message || message.trim().length === 0) return; //validaion

        const roomMessage = { //obj message de room
            id: socket.id, //expediteur
            userId: socket.userId, //utilisateur expediteur
            username: socket.username, //nom expediteur
            message: message.trim(), // message nettoye
            roomId: roomId, 
            timestamp: new Data().toISOtring(),
            type: 'room'
        };

        io.to(roomId).emit('room_chat', roomMessage); //envoie a tous les membres de la room
        console.log(`room chat [${roomId}] from ${socket.username}: ${message}`);
    });

    //systeme de rooms
    //handler pour rejoindre une room
    socket.on('join_room', (data) => { //event join_room
        const { roomId, roomType = 'lobby' } = data; //destructuring avec valeur par default
        if (!roomId) return; //validation roomId demander

        //si le fils de pute est deja dans un room, le teg
        if (socket.currentRoom) { //verifie si dans room
            socket.leave(socket.currentRoom); // quitte room
            updateRoomInfo(socket.currentRoom); //met a jour les infos ancienne room   
        }
        
        socket.join(roomId); //rej la new room
        socket.currentRoom = roomId; //mey a jour la propriete du socket

        const userInfo = connectedUsers.get(socket.id); //recupere le infos des fils de pute
        if (userInfo) { //si existent
            userInfo.currentRoom = roomId; //met a jour la room dans les donnees fils de pute
        }

        //cree la room si elle existente pas encore
        if (!gameRooms.has(roomId)) { //verifie si room existent
            gameRooms.set(roomId, { //cree new room
                id: roomId, // id de la room
                type: roomType, // lobby, game, etc...
                players: [], //array des joueurs
                spectators: [], //array des spectateurs
                createdAt: new Data(), 
                gameState: null //etat du jeu (null si pas de jeu)
            });
        }

        const room= gameRooms.get(roomId) // recup la room de la map

        //determine le role de l utilisateur
        if(roomType === 'game' && room.players.length < 2) { // si room de moins de 2 joueurs
            room.players.push({
                socketId: socket.id,
                userId: socket.userId,
                username: socket.username,
                joinedAt: new Data()
            });
            userInfo.isPlaying = true;
        }else{
            room.spectators.push({
                socketId: socket.id,
                userId: socket.userId,
                username: socket.username,
                joinedAt: new Data()
            });
        }


        //confirme au fils de pute qu il a rejoint la room
        socket.emit('room_joined', {
            roomId: roomId,
            roomType: roomType,
            roomInfo: room,
            yourRole: userInfo.isPlaying ? 'player' : 'spectator'
        });

        updateRoomInfo(roomId);
        console.log(`le fils de pute : ${socket.username} a rejoin la room: ${roomId} ${userInfo.isPlaying ? 'player' : 'spectator'}`);
    });
    
    //handler pour quitter une room
    socket.on('leave_room', () => {
        if (socket.currentRoom) { // si utilisateur est dans une room
            const roomId = socket.currentRoom; // sauvegarde de l id de la room
            socket.leave(roomId);
            removeUserFromRoom(socket.id, roomId);
            socket.currentRoom = null; //remet a null la room actuelle

            const userInfo = connectedUsers.get(socket.id); //recupe infos utilisateur
            if (userInfo) { //si les infos existent
                userInfo.currentRoom = null; //remet a null la room
                userInfo.isPlaying = false; //n est plus en train de jouer
            }
            socket.emit('room_left', { roomId }); //comfirmation de la sortie
            updateRoomInfo(roomId); //met a jour les info de la room
            console.log(`${socket.username} le fils de pute quitte la game ${roomId}`);
        }
    });


    //systeme de jeu
    //handler pour cree un nouveau jeu
    socket.on(`create_game`, (data) => {
        //genere un id unique pour le jeu avec timestamp + random
        const gameId = `game_${Data.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const gameSettings = {
            maxScore: data.maxScore || 34567890,
            ballSpeed: data.ballSpeed || 50,
            paddleSpeed: data.paddleSpeed || 100,
            gameMode: data.gameMode || 'classic'
        };

        const gameState = initializeGame(gameId, socket.userId, gameSettings); //initialise l etat du jeu 
        activeGames.set(gameId, gameState); //ajoue jeu a la map des jeux "actifs"
        globalStats.activeGames = activeGames.size;  //met a jour le compteur global

        //confirmation
        socket.emit('game_created', { //envoie message confirmation
            gameId: gameId, //id du jeu
            gameState: gameState, //etat initiale du jeu
            isHote: true //indique que c l hote
        });

        //fait automatiquement rejoindre l hote a la room du jeu
        socket.emit('joint_room', { roomId: gameId, roomType: 'game'});
        console.log(`le jeu est cree: ${gameId} par le fils de pute de ${socket.username}`);
    });

    //handler pour rejoindre un jeu existant
    socket.on('joint_game', (data) => {
        const{ gameId } = data;
        if (!gameId) {
            socket.emit('error', { message: 'ta pas mit l id de la game fdp' });
            return;
        }

        const game = activeGames.get(gameId); //recup le jeu de la map
        if (!game) {
            socket.emit('error', { message: 'pas de jeu trouve ' });
            return;
        }

        //determine si rejoindre comme joueur ou spectateur
        if (game.players.length >= 2) {
            socket.emit('joint_room', { roomId: gameId, roomType: 'game' }); //rej comme spectateur
        } else {
            game.players.push({ //ajoute comme joueur
                socketId: socket.id,
                userId: socket.userId,
                username: socket.username,
                paddle: game.players.length === 0 ? 'left' : 'right' //pour le paddle gauche ou droite
            });

            socket.emit('joint_room', { roomId: gameId, roomType: 'game' }); //rej la room

            if (game.players.length === 2) {
                startGame(gameId);
            }
        }

        //conf et rej
        socket.emit('game_joined', {
            gameId: gameId,
            playerId: socket.id,
            game: game
        });

        console.log(`le fils de pute de ${socket.username} a rejoint la game: ${gameId}`);
    });

    //handler pour les actions du putain de mouvement du jeu
    socket.on('game_action', (data) => {
        const { action, gameId, value } = data;
        if(!gameId || !activeGames.has(gameId)) return;

        const game = activeGames.get(gameId); //recup le jeu
        const player = game.players.find(p => p.socketId === socket.id) //trouve le joueur

        if (!player) return; //si pas un fils de pute du jeu, ignore

        //switch sur le type d action
        switch (action) {
            case 'paddle_up': //Mouvement raquette vers le haut
                movePaddle(game, player.paddle, -game.settings.paddleSpeed); 
                break;

            case 'paddle_down': // Mouvement raquette vers le bas
                movePaddle(game, player.paddle, game.settings.paddleSpeed); 
                break;
            }

            //diffuse l etat mis a jour a tous les participants du jeu
            io.to(gameId).emit('game_state_update', {
                gameId: gameId,
                gameState: game,
                timestamp: new Date().toISOString()
            });
            console.log(`action de jeu ${gameId} qui vient du fils de pute de ${socket.username}: ${action}`);
    });


    //fonctionnalites sociales
    //handler pour envoyer des demandes d ami
    socket.on('send_friend_request', (data) => {
        const { toUserId } = data //recup id du destinataire

        //recherche le socket du fils de pute de destinataire
        const targetSocket = Array.from(connectedUsers.entries()).find(([id, user]) => user.userId === toUserId);

        if (targetSocket) { //si dest connecte
            io.to(targetSocket[0]).emit('friend_request_sent', {
                form: socket.userId,
                fromUsername: socket.username,
                gameType: gameType,
                timestamp: new Date().toISOString()
            });

        socket.emit('friend_request_sent', { to :toUserId });
        console.log(`le fils de pute ${socket.username} te demande en amis -> ${toUserId}`);
        } else {
            socket.emit('error', { message: 'le fils de pute est pas trouver '});
        }
    });

    //handler pour recup la liste des utilisateurs en ligne
    socket.on('get_online_users', () => {
        socket.emit('online_users', Array.from(connectedUsers.values())); //envoie la liste
    });

    //handler pour le ping pong (pour la latence)
    socket.on('ping', (timestamp) => { 
        socket.emit('pong', timestamp); //renvoie le timestamp (calucul la latence cote client)
    });

    //handler pour recup les stats du server (admin)
    socket.on('get_server_stats', () => {
        if (socket.userId.includes('admin')) { //verfie si admin
            socket.emit('server_stats', { //envoie state completes
                ...globalStats,
                activeGames: Array.from(activeGames.values()), //jeux actifs
                activeRooms: Array.from(gameRooms.values()), // rooms actives
                connectedUsers: Array.from(connectedUsers.values()) //utilisateur connectes
            });
        }
    });

    

    //gestion des deconnesxions
    socket.on('disconnect', (reason) => {
        const userInfo = connectedUsers.get(socket.id); //recup les infos des fdp
        if (userInfo) { //si  le fdp existait
            console.log(`le fils de pute de ${userInfo.username} est deco (${reason})`);

            //si le fdp  etait dans la room
            if (socket.currentRoom) { // verifie si dans une room
                removeUserFromRoom(socket.id, socket.currentRoom); //sup la room
                updateRoomInfo(socket.currentRoom); //met a jour les infos room
            }

            handleGameDisconnection(socket.id); //gere la deco dans le jeu

            //notifie les autre fdp de la deco
            socket.broadcast.emit('user_offline', {
                userId: userInfo.userId, //id fdp deco
                username: userInfo.username, //username fdp deco
            });

            connectedUsers.delete(socket.id); //sup de la map des connectes
            globalStats.connectedUsers = connectedUsers.size; //met a jour le compteur
            console.log(`les fdp restant: ${globalStats.connectedUsers}`);
        }
    });
});







//utilitaires
//fonction pour mettre a jour les infos d une room
function updateRoomInfo(roomId){ // prend le id de la room en paraaaametre
    const room = gameRooms.get(roomId); // recupere la room de la map
    if (room) { // si la room existent
        io.to(roomId).emit('room_update', {  //"diffuse" mise a jour a tous le membres
            roomId: roomId, //id de la  room
            roomInfo: room // info COMPLETE de la room
        });
    }
}

//fonction pour sup un utilisateu d une room
function removeUserFromRoom(socketId, roomId) { //prend socket id et roomid
    const room = gameRooms.get(roomId); //recup la room
    if (room) {
        //filtre les joueurs pour supprimer celui avec le socketId
        room.players = room.players.filter(p => p.socketId !== socketId);
        //filtre les spectateurs pour sup celui avec le sockeId
        room.spectators = room.spectators.filter(s => s.socketId !== socketId);
        //si la room est vide, sup tout
        if (room.players.length === 0 && room.spectators.length === 0) {
            gameRooms.delete(roomId); //sup la room de la map
        }
    }
}

//fonction pour initialiser un new game
function initializeGame(gameId, hostUserId, settings) {
    return {
        id: gameId, // id unique du jeu
        status: 'waiting', //status initiale (waitinf , playing, finished)
        host: hostUserId, // id de l hote qui cree le jeu
        players: [],//array des joueurs
        settings: settings, //config du jeu
        gameState: { //etat ph du jeu
            ball: { x: 400, y: 300, velocityX: 5, velocityY: 3 }, //position et vitesse de balle
            paddle: { //etat raquette
                left: { y: 250, score: 0},
                right: { y: 250, score: 0},
            },
            field: {width: 800, height: 600 } //dimention terrain
        },
        createdAt: new Date(), //timestamp de creation 
        startedAt: null, //timestam de debut ducoup null si pas commence
        finishedAt: null // timestam de fin null si pas finit
    };
}


//fonction pour demarrer un jeu
function startGame(gameId) { // prend le id du jeu
    const game = activeGames.get(gameId); //recup le jeu
    if (game && game.players.length === 2) { // si le jeu existent et a 2 fdp
        game.status = 'playing'; //change le status
        game.startedAt = new Date(); // mais la l heure du debut

        //notif tous les fdp  que le jeu commence
        io.to(gameId).emit('game_started', {
            gameId: gameId, //id du jeu
            game: game //etat complet du jeu
        });

        //demarre la boucle de jeu (60 fps jsp pq c chatgpt il a dit c mieu)
        const gameLoop = setInterval(() => { // execute toutes les 16.67ms (60 fps)
            if (game.status === 'playing') {// si le jeu est tjr en cours
                updateGamePhysique(game); //met a jour la physique du jeu
                io.to(gameId).emit('game_state_update', { // diffuse l etat mis a jour
                    gameId: gameId, //id du jeu
                    gameState: game.gameState //etat physique mis a jour
                });

                //verifie les condition de fin de jeu
                if (game.gameState.paddles.left.score >= game.settings.maxScore ||
                    game.gameState.paddles.right.score <= game.settings.maxScore) {
                        endGame(gameId, gameLoop); //termine le jeu  si bas tout bien condition remplie
                    }
            } else { // si le jeu n est plus ne cours
                clearInterval(gameLoop) // arret boucle jeu
            }

        }, 1000 / 60); //pour niquer ta mere
        

    }

}

//fonction pour mettre a jour la physique du jeu
function updateGamePhysique(game) {
    const ball = game.gameState.ball // reference vers obj
    ball.x += ball.velocityX; //met a jour la position x
    ball.y += ball.velocityY; //met a jour la position y
    //gestion des colliosions avec les murs h et b
    if (ball.y <= 0 || ball.y >= game.gameState.field.height) {
        ball.velocityY = -ball.velocityY
    }

    //gestion des balle qui sort (sur le cotee evidement)
    if (ball.x <= 0) { //balle sort cotee <=
        game.gameState.paddle.right.score++ // point pour le fdp de droit
        resetBall(ball, game.gameState.field)// remet la balle au centre
    } else if (ball.x >= game.gameState.field.width) {
        game.gameState.paddle.left.score++;
        resetBall(ball, game.gameState.field);
    }
}


//fonction pour remettre la balle au centre
function resetBall(ball, field) {
    ball.x = field.width / 2; //position x au centre
    ball.y = field.height /2; //positon y au centre
    ball.velocityX = -ball.velocityX; //INVERTION
}


//fonctiom pour mettre la putain de raquette la ou elle doit etre C TOUT
function updatePaddlePosition(game, paddle, position) { //game, raquette, new position
    if (game.gameState.paddles[paddle]) { //si raquette existe
        // limit la position entre o et hauteur terrain - hauteur du paddle
        game.gameState.paddles[paddle].y = Math.max(0, Math.min(game.gameState.field.height - 100, position));
    }
}


//fonction pour deplacer la raquette
function movePaddle(game, paddle, delta) { // delta = deplacement "relatif"
    if (game.gameState.paddles[paddle]) {
        const newY = game.gameState.paddle[paddle].y + delta; //calcul new position
        //limite du terrain
        game.gameState.paddles[paddle].y = Math.max(0, Math.min(game.gameState.field.height - 100, newY));
    }
}


//FONCTION POUR TERMINER LE PUTAIN DE JEU
function endGame(gameId, gameLoop) {
    const game = activeGames.get(gameId); //recupe le jeu
    if(game) {
        clearInterval(gameLoop); //art boucle
        game.status = 'finished' // change le status
        game.finishedAt = new Date(); //marque l heure de fin
        //pour savoir qui c le fdp qui a win
        const winner = game.gameState.paddle.left.score > game.gameState.paddle.right.score ? game.players[0] : game.players[1];

        //notif pour tous les fdp de la fin du jeu
        io.to(gameId).emit('game_finished', {
            gameId: gameId, // id du jeu
            winner: winner, // info du gagnant
            finalScore: game.gameState.paddles, //score finaux
            game: game 
        });

        //sup le jeu de la liste des jeux actifs apres bas 30s bismillah
        setTimeout(() => {
            activeGames.delete(gameId);
            globalStats.activeGames = activeGames.size; //met a jour
        }, 30000); //delais de 30sex
    }
}


//fonction pour gerer la deconnexion d'un joueur pendant le jeu
function handleGameDisconnection(socketId) { // prend le id du socket deco
    //parcourt tous les jeux actifs
    for (const [gameId, game] of activeGames) {
        //recherche si le socket deco etait un joueur
        const playerIndex = game.players.findIndex(p => p.socketId === socketId);
        if (playerIndex !== -1) { // si c etait un joueur du jeu
            if (game.status === 'playing') { // si le jeu etait en cours
                game.status = 'paused'; // met le jeu en pause
                io.to(gameId).emit('game_paused', { //notif pour les joueurs
                    gameId: gameId,
                    reason: 'Player disconnected', //raison de pause
                    disconnectedPlayer: game.players[playerIndex] // joueur deco
                });

            }

        }
    }
}


//34390 22.5

// petit route expresse des familles
//route pour la verif de sante du serv
app.get('/esque-je-suis-tjr-trans', (req, res) => {
    res.json({
        status: 'healthy', 
        stats: globalStats, //statistiques global
        uptime: process.uptime(),// temps de fonctionnement
    });
});

//route de stat detaillees
app.get('/trop-de-zeub', (req, res) => {
    res.json({
        ...globalStats,
        connectedUsersCount: connectedUsers.size,
        activeGamesCount: activeGames.size,
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Real-time server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Stats endpoint: http://localhost:${PORT}/stats`);
  console.log(`🔌 Socket.IO ready for connections`);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});






