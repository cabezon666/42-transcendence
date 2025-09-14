import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '../ui';

interface GameInvite {
  id: string;
  from: string;
  fromUsername: string;
  gameType: 'classic' | 'tournament';
  timestamp: string;
}

export function PlayView() {
  const [gameMode, setGameMode] = useState<'tournament' | 'ai' | '1v1' | null>(null);
  const [pendingInvites, setPendingInvites] = useState<GameInvite[]>([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const handleTournament = () => {
    // Template for tournament functionality
    alert('Tournament mode - Template: Connect to tournament socket events and match users');
  };

  const handleAI = () => {
    // Template for AI functionality  
    alert('AI mode - Template: Initialize single-player game against AI');
  };

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return;
    
    setIsInviting(true);
    try {
      // Template for inviting users
      alert(`Invite sent to ${inviteUsername} - Template: Send socket.io invite event`);
      setInviteUsername('');
    } catch (error) {
      console.error('Failed to send invite:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const acceptInvite = (invite: GameInvite) => {
    // Template for accepting invites
    alert(`Accepting invite from ${invite.fromUsername} - Template: Join game room via socket.io`);
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
  };

  const declineInvite = (invite: GameInvite) => {
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
  };

  return (
    <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground">🏓 Play Pong</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Choose your game mode and start playing!
          </p>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📨</span>
                <span>Pending Invites</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg border-border">
                    <div>
                      <p className="font-semibold">{invite.fromUsername}</p>
                      <p className="text-sm text-muted-foreground">
                        {invite.gameType} game • {new Date(invite.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => acceptInvite(invite)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => declineInvite(invite)}
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

        {/* Game Mode Selection */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Tournament Mode */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105">
            <CardHeader>
              <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
                <span>🏆</span>
                <span>Tournament</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-4 text-muted-foreground">
                Join a tournament and compete against multiple players
              </p>
              <Button 
                onClick={handleTournament}
                className="w-full"
                size="lg"
              >
                Join Tournament
              </Button>
            </CardContent>
          </Card>

          {/* AI Mode */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105">
            <CardHeader>
              <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
                <span>🤖</span>
                <span>VS AI</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-4 text-muted-foreground">
                Practice against our intelligent AI opponent
              </p>
              <Button 
                onClick={handleAI}
                className="w-full"
                size="lg"
              >
                Play vs AI
              </Button>
            </CardContent>
          </Card>

          {/* 1v1 Mode */}
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-105">
            <CardHeader>
              <CardTitle className="flex items-center justify-center space-x-2 text-2xl">
                <span>⚔️</span>
                <span>1v1 Match</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-4 text-muted-foreground">
                Challenge a friend to a direct match
              </p>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Username to invite"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded-md border-border bg-background"
                    onKeyPress={(e) => e.key === 'Enter' && handleInvite()}
                  />
                  <Button 
                    onClick={handleInvite}
                    disabled={isInviting || !inviteUsername.trim()}
                    size="sm"
                  >
                    {isInviting ? 'Sending...' : 'Invite'}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Or wait for someone to invite you!
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Match */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center space-x-2">
              <span>⚡</span>
              <span>Quick Match</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4 text-muted-foreground">
              Get matched with a random opponent instantly
            </p>
            <Button 
              size="lg"
              onClick={() => alert('Quick Match - Template: Join matchmaking queue via socket.io')}
              className="px-8"
            >
              Find Match
            </Button>
          </CardContent>
        </Card>

        {/* Game Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📋</span>
              <span>How to Play</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2">Controls</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use W/S or Arrow Up/Down to move paddle</li>
                  <li>• First to score 11 points wins</li>
                  <li>• Ball speed increases over time</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Game Modes</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Tournament:</strong> Bracket-style elimination</li>
                  <li>• <strong>AI:</strong> Single-player practice</li>
                  <li>• <strong>1v1:</strong> Direct player challenge</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}