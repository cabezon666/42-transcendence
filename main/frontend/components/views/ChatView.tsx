import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, LoadingSpinner } from '../ui';
import { useAuth } from '../auth';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  chatId?: string;
  senderId?: string;
  senderUsername?: string;
  userId?: string; // Legacy compatibility
  username?: string; // Legacy compatibility
  message: string;
  messageType?: string;
  timestamp: string;
  type?: 'global' | 'private' | 'system';
  from?: string;
  to?: string;
}

interface Chat {
  id: string;
  name?: string;
  type: 'private' | 'group';
  other_user?: {
    id: string;
    username: string;
  };
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

interface ConnectedUser {
  userId: string;
  username: string;
  currentRoom: string | null;
  isPlaying: boolean;
  lastSeen: string;
}

interface SearchResult {
  id: string;
  username: string;
}

interface GameInvite {
  id: string;
  from: string;
  fromUsername: string;
  to: string;
  gameType: 'classic' | 'tournament';
  timestamp: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

export function ChatView() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [chatMode, setChatMode] = useState<'chat' | 'global'>('chat');
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Show loading if user is not available
  if (!user) {
    return (
      <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner text="Loading user data..." />
        </div>
      </div>
    );
  }

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Debug chat state changes
  useEffect(() => {
    console.log('🔥 CHATS STATE CHANGED:', chats?.length || 0, 'chats');
    console.log('🔥 Chat details:', chats);
  }, [chats]);

  // Search for users
  const searchUsers = async (query: string) => {
    if (!user || !query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Use socket.io for search instead of REST API
    if (socketRef.current) {
      socketRef.current.emit('search_users', { query: query.trim() });
    }
  };

  // Start a new chat with a user
  const startChat = (targetUser: SearchResult) => {
    if (socketRef.current) {
      socketRef.current.emit('start_chat', { targetUserId: targetUser.id });
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  // Select a chat
  const selectChat = (chat: Chat) => {
    console.log('🔥 SELECTING CHAT:', chat);
    console.log('🔥 Socket connected:', isConnected);
    console.log('🔥 Socket ref:', !!socketRef.current);
    setSelectedChat(chat);
    setMessages([]); // Clear current messages
    
    if (socketRef.current) {
      // Get messages for this chat
      console.log('🔥 REQUESTING MESSAGES FOR CHAT:', chat.id);
      socketRef.current.emit('get_chat_messages', { chatId: chat.id });
      // Mark chat as read
      socketRef.current.emit('mark_chat_read', { chatId: chat.id });
    } else {
      console.error('🔥 NO SOCKET CONNECTION!');
    }
  };

  // Send message (unified for both chat and global modes)
  const sendMessage = () => {
    if (!newMessage.trim() || !isConnected || !socketRef.current) return;

    if (chatMode === 'global') {
      sendGlobalMessage();
    } else if (selectedChat) {
      sendChatMessage();
    }
  };

  // Send message to selected chat
  const sendChatMessage = () => {
    if (!newMessage.trim() || !selectedChat || !socketRef.current) return;

    socketRef.current.emit('send_chat_message', {
      chatId: selectedChat.id,
      message: newMessage.trim()
    });

    setNewMessage('');
  };

  // Legacy global message function
  const sendGlobalMessage = () => {
    if (!newMessage.trim() || !isConnected || !socketRef.current || !user) {
      console.warn('Cannot send global message');
      return;
    }

    const messageData = {
      message: newMessage.trim(),
      userId: user.id,
      username: user.username,
      timestamp: new Date().toISOString()
    };

    socketRef.current.emit('chat_message', messageData);
    setNewMessage('');
  };

    // Real Socket.IO connection
  useEffect(() => {
    if (!user) return;

    // Connect to Socket.IO server
    console.log('🔌 Attempting to connect to Socket.IO server...');
    console.log('User data:', { id: user.id, username: user.username });
    
    const socket = io(`${window.location.protocol}//${window.location.host}`, {
      auth: {
        token: user.id,
        username: user.username
      },
      withCredentials: true,
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    console.log('🔌 Socket.IO client created');
    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('🔥 CONNECTED TO SOCKET.IO SERVER');
      console.log('🔥 User ID:', user.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from Socket.IO server:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    // New Chat System Handlers

    // Receive user's chat list
    socket.on('user_chats', (userChats) => {
      console.log('🔥 RECEIVED USER CHATS:', userChats);
      console.log('🔥 Number of chats:', userChats?.length || 0);
      setChats(userChats || []);
      console.log('🔥 Chats state updated');
    });

    // Receive chat message
    socket.on('chat_message_received', (message) => {
      console.log('Chat message received:', message);
      const chatMessage: ChatMessage = {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        senderUsername: message.senderUsername,
        message: message.message,
        messageType: message.messageType || 'text',
        timestamp: message.timestamp
      };

      // Only add to messages if it's for the currently selected chat
      if (selectedChat && message.chatId === selectedChat.id) {
        setMessages(prev => [...prev, chatMessage]);
      }
    });

    // Receive chat messages for a specific chat
    socket.on('chat_messages', (data) => {
      console.log('🔥 RECEIVED CHAT MESSAGES:', data);
      console.log('🔥 Current selected chat:', selectedChat?.id);
      if (data && data.messages) {
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          chatId: data.chatId,
          senderId: msg.sender_id,
          senderUsername: msg.sender_username,
          message: msg.message,
          messageType: msg.message_type || 'text',
          timestamp: msg.created_at
        }));
        console.log('🔥 SETTING MESSAGES:', formattedMessages);
        setMessages(formattedMessages);
      } else {
        console.log('🔥 NO MESSAGES IN DATA');
      }
    });

    // Chat started successfully
    socket.on('chat_started', (data) => {
      console.log('Chat started:', data);
      // The user_chats event will update the chat list
    });

    // Chat left
    socket.on('chat_left', (data) => {
      console.log('Chat left:', data);
      if (selectedChat && selectedChat.id === data.chatId) {
        setSelectedChat(null);
        setMessages([]);
      }
    });

    // Search results
    socket.on('search_results', (users) => {
      console.log('Search results:', users);
      setSearchResults(users || []);
    });

    // Legacy compatibility - Online users list
    socket.on('online-users', (users: any[]) => {
      console.log('Online users:', users);
      const formattedUsers = users
        .filter(u => u.userId !== user.id)
        .map(u => ({
          userId: u.userId,
          username: u.username,
          currentRoom: u.currentRoom,
          isPlaying: u.isPlaying || false,
          lastSeen: u.connectedAt || new Date().toISOString()
        }));
      setConnectedUsers(formattedUsers);
    });

    // Legacy compatibility - Global chat messages
    socket.on('chat_message', (message) => {
      console.log('Global chat message received:', message);
      if (chatMode === 'global') {
        const chatMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random()}`,
          userId: message.userId,
          username: message.username,
          message: message.message,
          timestamp: message.timestamp,
          type: 'global'
        };
        setMessages(prev => [...prev, chatMessage]);
      }
    });

    // Game invite handlers (keeping existing functionality)
    socket.on('game_invite', (invite) => {
      console.log('Game invite received:', invite);
      setGameInvites(prev => [...prev, {
        id: invite.id,
        from: invite.from,
        fromUsername: invite.fromUsername,
        to: invite.to,
        gameType: invite.gameType,
        timestamp: invite.timestamp,
        status: 'pending'
      }]);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, chatMode]);

  const sendGameInvite = (targetUserId: string, gameType: 'classic' | 'tournament') => {
    if (!socketRef.current || !user) return;

    const invite: GameInvite = {
      id: `invite_${Date.now()}`,
      from: user.id,
      fromUsername: user.username,
      to: targetUserId,
      gameType,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    // Emit game invite to server
    socketRef.current.emit('game_invite', invite);
    
    // Add to local state for UI feedback
    setGameInvites(prev => [...prev, invite]);
    
    console.log('Game invite sent:', invite);
  };

  const acceptInvite = (inviteId: string) => {
    if (!socketRef.current) return;

    setGameInvites(prev => 
      prev.map(invite => 
        invite.id === inviteId 
          ? { ...invite, status: 'accepted' as const }
          : invite
      )
    );
    
    // Emit accept invite event to server
    socketRef.current.emit('accept_game_invite', { inviteId });
    console.log('Accepting invite:', inviteId);
  };

  const declineInvite = (inviteId: string) => {
    if (!socketRef.current) return;

    setGameInvites(prev => 
      prev.map(invite => 
        invite.id === inviteId 
          ? { ...invite, status: 'declined' as const }
          : invite
      )
    );
    
    // Emit decline invite event to server
    socketRef.current.emit('decline_game_invite', { inviteId });
    console.log('Declining invite:', inviteId);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getUserStatus = (user: ConnectedUser) => {
    if (user.isPlaying) return { icon: '🎮', text: 'Playing', color: 'text-green-400' };
    if (user.currentRoom) return { icon: '🏠', text: 'In Room', color: 'text-blue-400' };
    return { icon: '🟢', text: 'Online', color: 'text-green-400' };
  };

  return (
    <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        
        {/* Chat List / Search */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span>�</span>
                  <span>Chats</span>
                  <span className="text-sm text-muted-foreground">({chats.length})</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSearch(!showSearch)}
                  className="w-8 h-8 p-1"
                  title="Search users"
                >
                  🔍
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isConnected ? (
                <LoadingSpinner text="Connecting..." />
              ) : (
                <div className="space-y-2">
                  {/* Search section */}
                  {showSearch && (
                    <div className="mb-4">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          searchUsers(e.target.value);
                        }}
                        placeholder="Search users..."
                        className="w-full px-3 py-2 text-sm border rounded-md border-border bg-background"
                      />
                      {searchResults.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {searchResults.map((result) => (
                            <div
                              key={result.id}
                              className="p-2 border rounded cursor-pointer hover:bg-muted/50"
                              onClick={() => startChat(result)}
                            >
                              <span className="font-medium">{result.username}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode toggle */}
                  <div className="flex mb-4 space-x-2">
                    <Button
                      size="sm"
                      variant={chatMode === 'chat' ? 'primary' : 'outline'}
                      onClick={() => {
                        setChatMode('chat');
                        setMessages([]);
                      }}
                    >
                      Chats
                    </Button>
                    <Button
                      size="sm"
                      variant={chatMode === 'global' ? 'primary' : 'outline'}
                      onClick={() => {
                        setChatMode('global');
                        setSelectedChat(null);
                        setMessages([]);
                      }}
                    >
                      Global
                    </Button>
                  </div>

                  {/* Chat list */}
                  {chatMode === 'chat' ? (
                    chats.length > 0 ? (
                      chats.map((chat) => (
                        <div
                          key={chat.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedChat?.id === chat.id 
                              ? 'bg-primary/10 border-primary' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                          onClick={() => selectChat(chat)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center min-w-0 space-x-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20">
                                <span className="text-lg font-bold">
                                  {(chat.other_user?.username || chat.name || 'U').charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium truncate">
                                    {chat.other_user?.username || chat.name || 'Unnamed Chat'}
                                  </span>
                                  {chat.unread_count > 0 && (
                                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                      {chat.unread_count}
                                    </span>
                                  )}
                                </div>
                                {chat.last_message && (
                                  <div className="mt-1 text-xs truncate text-muted-foreground">
                                    {chat.last_message}
                                  </div>
                                )}
                                {chat.last_message_at && (
                                  <div className="text-xs text-muted-foreground">
                                    {formatTimestamp(chat.last_message_at)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (socketRef.current) {
                                  socketRef.current.emit('leave_chat', { chatId: chat.id });
                                }
                              }}
                              className="w-6 h-6 p-1 opacity-60 hover:opacity-100"
                              title="Leave chat"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        <p>No chats yet</p>
                        <p className="text-sm">Search for users to start chatting</p>
                      </div>
                    )
                  ) : (
                    // Global chat mode - show online users for compatibility
                    connectedUsers.map((connectedUser) => (
                      <div 
                        key={connectedUser.userId}
                        className="p-2 border rounded-lg border-border hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-green-400">🟢</span>
                            <span className="font-medium">{connectedUser.username}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3">
          <Card className="flex flex-col h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <span>💬</span>
                  <span>
                    {chatMode === 'global' 
                      ? 'Global Chat' 
                      : selectedChat 
                        ? `${selectedChat.other_user?.username || selectedChat.name || 'Chat'}` 
                        : 'Select a chat'}
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="flex flex-col flex-1">
              {!isConnected ? (
                <div className="flex items-center justify-center flex-1">
                  <LoadingSpinner text="Connecting to chat..." />
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div className="flex-1 mb-4 space-y-3 overflow-y-auto max-h-96">
                    {chatMode === 'global' ? (
                      // Global messages
                      messages
                        .filter(msg => msg.type === 'global' || msg.type === 'system')
                        .map((message) => (
                          <div 
                            key={message.id}
                            className={`p-3 rounded-lg ${
                              message.type === 'system' 
                                ? 'bg-blue-500/10 border border-blue-500/20' 
                                : message.userId === user?.id || message.senderId === user?.id
                                  ? 'bg-primary/10 border border-primary/20 ml-8'
                                  : 'bg-muted/50 border border-border mr-8'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold">
                                {message.username || message.senderUsername}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm">{message.message}</p>
                          </div>
                        ))
                    ) : selectedChat ? (
                      // Chat messages
                      messages.map((message) => (
                        <div 
                          key={message.id}
                          className={`max-w-[80%] p-3 rounded-2xl ${
                            message.senderId === user?.id || message.userId === user?.id
                              ? 'bg-primary text-primary-foreground ml-auto rounded-br-md'
                              : 'bg-muted border border-border mr-auto rounded-bl-md'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold">
                              {message.senderUsername || message.username}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(message.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center flex-1 text-muted-foreground">
                        Select a chat to start messaging
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder={
                        chatMode === 'global' 
                          ? 'Type a message to everyone...' 
                          : selectedChat 
                            ? `Message ${selectedChat.other_user?.username || selectedChat.name || 'user'}...`
                            : 'Select a chat to send messages...'
                      }
                      className="flex-1 px-3 py-2 text-sm border rounded-md border-border bg-background"
                      disabled={!isConnected || (chatMode === 'chat' && !selectedChat)}
                    />
                    <Button 
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || !isConnected || (chatMode === 'chat' && !selectedChat)}
                    >
                      Send
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Game Invites Panel */}
      {gameInvites.filter(invite => invite.status === 'pending').length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🎮</span>
              <span>Game Invites</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gameInvites
                .filter(invite => invite.status === 'pending')
                .map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg border-border">
                    <div>
                      <p className="font-semibold">{invite.fromUsername} invited you to play</p>
                      <p className="text-sm text-muted-foreground">
                        {invite.gameType} game • {formatTimestamp(invite.timestamp)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => acceptInvite(invite.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => declineInvite(invite.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection Status */}
      <div className="fixed bottom-4 right-4">
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          isConnected 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>
    </div>
  );
}