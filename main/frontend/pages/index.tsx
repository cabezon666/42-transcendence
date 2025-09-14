import { useState } from 'react';
import Head from 'next/head';
import { 
  AuthProvider, 
  AuthGuard, 
  AuthComponent,
  DashboardView,
  ProfileView,
  ProtectedAreaView,
  ApiTestView,
  SettingsView,
  LeaderboardView,
  PlayView,
  ChatView,
  Navigation
} from '@/components';

// Main App Component
function AppContent() {
  const [currentView, setCurrentView] = useState('play');

  const renderView = () => {
    switch (currentView) {
      case 'play':
        return <PlayView />;
      case 'leaderboard':
        return <LeaderboardView />;
      case 'chat':
        return <ChatView />;
      case 'settings':
        return <SettingsView />;
      // Legacy views - keep for now but not in main nav
      case 'profile':
        return <ProfileView />;
      case 'protected':
        return <ProtectedAreaView />;
      case 'api-test':
        return <ApiTestView />;
      default:
        return <PlayView />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation currentView={currentView} setCurrentView={setCurrentView} />
      {renderView()}
    </div>
  );
}

// Main SPA Component
export default function Home() {
  return (
    <>
      <Head>
        <title>ft_trans
        </title>
      </Head>
      
      <AuthProvider>
        <AuthGuard fallback={<AuthComponent />}>
          <AppContent />
        </AuthGuard>
      </AuthProvider>
    </>
  );
}
