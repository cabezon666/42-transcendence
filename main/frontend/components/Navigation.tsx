import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { Button } from './ui';

// Navigation Component
export function Navigation({ currentView, setCurrentView }: { currentView: string; setCurrentView: (view: string) => void }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'play', label: '� Play', icon: '�' },
    { id: 'leaderboard', label: '🏆 Leaderboard', icon: '🏆' },
    { id: 'chat', label: '� Chat', icon: '�' },
  ];

  const handleNavItemClick = (viewId: string) => {
    setCurrentView(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="border-b shadow-sm bg-background border-border" role="navigation" aria-label="Main navigation">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center space-x-4 sm:space-x-8">
            <h1 className="text-xl font-bold sm:text-2xl text-foreground">🏓 Ft Transcendence</h1>
            
            {/* Desktop Navigation */}
            <div className="hidden space-x-1 md:flex">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView(item.id)}
                  className={currentView === item.id ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}
                  aria-current={currentView === item.id ? 'page' : undefined}
                >
                  <span className="mr-2" aria-hidden="true">{item.icon}</span>
                  {item.label.replace(/^\S+\s/, '')}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile hamburger menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label="Toggle mobile menu"
                className="p-2 min-h-[44px] min-w-[44px]"
              >
                <span 
                  aria-hidden="true"
                  className={`inline-block transition-transform duration-300 ease-in-out ${
                    mobileMenuOpen ? 'transform rotate-90' : 'transform rotate-0'
                  }`}
                >
                  {mobileMenuOpen ? '✕' : '☰'}
                </span>
              </Button>
            </div>
            
            {/* User info */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentView('settings')}
                className="flex items-center space-x-2 text-foreground hover:text-foreground min-h-[44px] p-2 [&>span]:flex [&>span]:items-center [&>span]:space-x-2"
                aria-label={`Settings for ${user?.username}`}
              >
                <>
                  <span className="hidden text-base font-medium sm:inline whitespace-nowrap">{user?.username}</span>
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 font-semibold rounded-full bg-secondary text-secondary-foreground">
                    {user?.hasAvatar ? (
                      <img 
                        src={`/auth/avatar/${user.id}`} 
                        alt="User Avatar" 
                        className="object-cover w-8 h-8 rounded-full" 
                      />
                    ) : (
                      user?.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                </>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        <div 
          id="mobile-menu" 
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-border ${
            mobileMenuOpen 
              ? 'max-h-96 opacity-100 mt-4 pt-4 pb-4' 
              : 'max-h-0 opacity-0 mt-0 pt-0 pb-0'
          }`}
          role="menu"
          aria-orientation="vertical"
          aria-hidden={!mobileMenuOpen}
        >
          <div className={`space-y-2 transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? 'transform translate-y-0' : 'transform -translate-y-4'
          }`}>
            {navItems.map((item, index) => (
              <Button
                key={item.id}
                variant={currentView === item.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleNavItemClick(item.id)}
                className={`w-full justify-start min-h-[44px] transition-all duration-300 ease-in-out ${
                  mobileMenuOpen 
                    ? 'transform translate-x-0 opacity-100' 
                    : 'transform -translate-x-4 opacity-0'
                } ${currentView === item.id ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                style={{
                  transitionDelay: mobileMenuOpen ? `${index * 50}ms` : '0ms'
                }}
                role="menuitem"
                aria-current={currentView === item.id ? 'page' : undefined}
                tabIndex={mobileMenuOpen ? 0 : -1}
              >
                <span className="mr-3" aria-hidden="true">{item.icon}</span>
                {item.label.replace(/^\S+\s/, '')}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}