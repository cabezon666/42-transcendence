import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, AuthContextType } from '@/types/auth';

const API_BASE = '/auth';

// Auth Context
const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  checkAuth: async () => false
});

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = useCallback((newToken: string, userData: User) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('authToken');
    if (!storedToken) {
      setIsAuthenticated(false);
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/validate`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setToken(storedToken);
        setUser(data.user);
        setIsAuthenticated(true);
        return true;
      } else {
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export const useAuth = () => useContext(AuthContext);