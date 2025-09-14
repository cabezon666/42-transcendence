# Frontend Pages Implementation Notes

## ✅ Completed
The frontend has been restructured according to the requirements with the following new pages:

### 1. **Play Page** (`/components/views/PlayView.tsx`)
- **Tournament Mode**: Template button for tournament functionality
- **AI Mode**: Template button for AI games  
- **1v1 Mode**: Interface for inviting users to direct matches
- **Quick Match**: Template for matchmaking system
- **Game Rules**: Information panel about controls and game modes
- **Pending Invites**: Display and management of received game invites

### 2. **Leaderboard Page** (`/components/views/LeaderboardView.tsx`)
- **42 School Leaderboard**: Existing comprehensive leaderboard (functional)
- **Pong Leaderboard**: Template leaderboard for game statistics
- **Toggle Selector**: Switch between 42 and Pong leaderboards
- **Filters**: Available for 42 leaderboard (status, coalition, search)

### 3. **Chat Page** (`/components/views/ChatView.tsx`)
- **Global Chat**: Template for server-wide communication
- **Private Chat**: Template for direct user messaging
- **Online Users**: List with game invite functionality
- **Game Invites**: Send/receive/accept/decline invitations
- **Connection Status**: Real-time connection indicator

### 4. **Settings Page** (`/components/views/SettingsView.tsx`)
- Existing settings functionality (already implemented)

### Navigation Updated
- New main navigation: Play, Leaderboard, Chat, Settings
- Old views (Dashboard, Protected Area, API Test) kept but removed from main nav
- Default page changed to "Play"

## 🔧 Templates Implemented (Need Backend Integration)

### Socket.IO Integration Required:
```javascript
// Chat functionality
socket.emit('chat_message', { message: 'Hello' });
socket.emit('private_message', { to: 'userId', message: 'Hi' });
socket.emit('join_room', { roomId: 'game_123' });

// Game invitations  
socket.emit('game_invite', { to: 'userId', gameType: 'classic' });
socket.emit('accept_invite', { inviteId: 'invite_123' });

// Game creation/joining
socket.emit('create_game', { gameMode: 'classic' });
socket.emit('join_game', { gameId: 'game_123' });
```

### Backend API Templates Added:
```javascript
// In main/backend/routes/api.js
GET /pong-leaderboard          // Pong game statistics
POST /game-invite              // Send game invitations
GET /user-game-stats/:userId   // User's game performance
```

## 🚀 Next Steps for Full Implementation

### 1. Socket.IO Server Integration
- Complete the socket.io server (`socket_io/server.js`)
- Implement real-time chat events
- Handle game invitation system
- Manage game rooms and matchmaking

### 2. Backend Database Integration
- Create pong games table (games, results, statistics)
- Store game invitations and their states
- User game statistics and rankings
- Chat message history (optional)

### 3. Game Engine Integration
- Connect Pong game to the invitation system
- Tournament bracket system implementation
- AI opponent logic
- Real-time game state synchronization

### 4. Advanced Features (Optional)
- Push notifications for invites
- Spectator mode for games
- Replay system
- Achievement system

## 📁 File Structure
```
main/frontend/components/views/
├── PlayView.tsx        ✅ New - Game mode selection & invites
├── ChatView.tsx        ✅ New - Real-time chat & invitations  
├── LeaderboardView.tsx ✅ Updated - 42 + Pong leaderboards
├── SettingsView.tsx    ✅ Existing - User preferences
├── DashboardView.tsx   ⚠️ Kept but not in main nav
├── ProfileView.tsx     ⚠️ Kept but not in main nav
└── ...
```

All templates include detailed comments showing exactly what Socket.IO events and API calls need to be implemented for full functionality.