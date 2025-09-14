export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  hasAvatar?: boolean;
  emailVerified?: boolean;
  isActive?: boolean;
  twoFactor?: {
    enabled: boolean;
    backupCodesRemaining: number;
  };
}

export interface Provider {
  provider: string;
  username: string;
  avatar?: string;
  linkedAt: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  checkAuth: () => Promise<boolean>;
}