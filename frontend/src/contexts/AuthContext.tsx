import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '@/lib/api';
import { destroyEcho } from '@/lib/echo';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/user');
      setUser(response.data.data);
    } catch {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token: newToken, data: userData } = response.data;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const register = async (name: string, email: string, password: string, password_confirmation: string) => {
    const response = await api.post('/auth/register', { name, email, password, password_confirmation });
    const { token: newToken, data: userData } = response.data;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      destroyEcho();
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    }
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) ?? false;
  };

  const hasPermission = (_permission: string): boolean => {
    // Admin has all permissions
    if (hasRole('admin')) return true;
    // For other roles, check via the roles' permissions
    // This is simplified - in production, load permissions from API
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
