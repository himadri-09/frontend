import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User as SupabaseUser, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

// Your app's User type (can extend Supabase User)
interface User {
  id: string;
  email: string;
  created_at?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const isAuthenticated = !!user && !!session;

  /**
   * Initialize auth state and listen for changes
   */
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? transformUser(session.user) : null);
      setIsLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ? transformUser(session.user) : null);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Transform Supabase user to app User type
   */
  const transformUser = (supabaseUser: SupabaseUser): User => ({
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    created_at: supabaseUser.created_at,
  });

  /**
   * Login user with email and password
   */
  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Session and user are automatically set by onAuthStateChange listener
      // No need to manually set state here
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message || 'Login failed');
    }
  };

  /**
   * Sign up new user
   */
  const signup = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Optional: Add email confirmation
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // Check if email confirmation is required
      if (data.user && !data.session) {
        throw new Error('Please check your email to confirm your account');
      }

      // Session automatically set by onAuthStateChange
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message || 'Signup failed');
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // State automatically cleared by onAuthStateChange
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even if API call fails
      setUser(null);
      setSession(null);
      navigate('/login');
    }
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message || 'Password reset failed');
    }
  };

  const value: AuthContextValue = {
    user,
    session,
    isAuthenticated,
    isLoading,
    login,
    signup,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use auth context
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
