import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthUser } from '../../../shared/types';
import { api } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: { email: string; name: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await api.auth.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    setLoading(true);
    try {
      const loggedInUser = await api.auth.login(email, password);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: { email: string; name: string; password: string; role?: string }): Promise<AuthUser> => {
    setLoading(true);
    try {
      const newUser = await api.auth.register(data);
      setUser(newUser);
      return newUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await api.auth.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
