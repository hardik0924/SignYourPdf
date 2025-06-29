import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation?: boolean; userExists?: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email_confirmed_at);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle email confirmation
        if (event === 'SIGNED_IN' && session?.user) {
          if (session.user.email_confirmed_at) {
            toast.success('Welcome to Sign PDF!');
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('🔄 Attempting signup for:', email);

      // First, try to sign in with the provided credentials to check if user exists
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // If signin succeeds, user exists and credentials are correct
      if (signInData.user && !signInError) {
        console.log('👤 User exists and credentials are correct - redirecting to signin');
        return { userExists: true };
      }

      // If signin fails, check the error type
      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          console.log('👤 User exists but email not confirmed');
          return { userExists: true };
        }
        
        if (signInError.message.includes('Invalid login credentials')) {
          // This could mean:
          // 1. User doesn't exist (proceed with signup)
          // 2. User exists but wrong password (we'll find out during signup)
          console.log('🔍 Invalid credentials - proceeding with signup attempt');
        }
      }

      // Proceed with signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: `${window.location.origin}/auth?confirmed=true`
        },
      });

      console.log('📧 Signup response:', { 
        userId: data?.user?.id, 
        session: !!data?.session,
        error: error?.message 
      });

      if (error) {
        console.log('❌ Signup error:', error.message);
        
        // Handle specific error cases for existing users
        if (error.message.includes('User already registered') || 
            error.message.includes('already been taken') ||
            error.message.includes('already registered') ||
            error.message.includes('already exists') ||
            error.message.includes('duplicate')) {
          console.log('👤 User already exists (from signup error)');
          return { userExists: true };
        }
        
        throw error;
      }

      // Analyze the signup response
      if (data.user && data.user.id) {
        console.log('✅ New user created:', data.user.id);
        
        // If we have a session, user is immediately signed in (email confirmation disabled)
        if (data.session) {
          console.log('✅ User signed in immediately - email confirmation disabled');
          toast.success('Account created successfully!');
          return {};
        }
        
        // If no session, email confirmation is required for new user
        console.log('📧 Email confirmation required for new user');
        toast.success('Account created! Please check your email for confirmation.');
        return { needsConfirmation: true };
      } else {
        // This is the tricky case - Supabase returned success but no user
        // This typically happens when email confirmation is enabled and user already exists
        console.log('⚠️ Signup succeeded but no user object - likely existing user with confirmation enabled');
        
        // Try one more signin attempt to see if it's an unconfirmed existing user
        try {
          const { error: secondSignInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (secondSignInError && secondSignInError.message.includes('Email not confirmed')) {
            console.log('👤 Confirmed: existing user with unconfirmed email');
            return { userExists: true };
          }
        } catch (e) {
          // Ignore errors from this check
        }
        
        // Default to showing confirmation screen for new users
        console.log('📧 Defaulting to confirmation screen');
        toast.success('Please check your email for confirmation.');
        return { needsConfirmation: true };
      }
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      toast.error(error.message);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 Attempting signin for:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('📧 Signin response:', { user: data?.user?.id, error: error?.message });

      if (error) {
        console.log('❌ Signin error:', error.message);
        
        // Check if it's an email not confirmed error
        if (error.message.includes('Email not confirmed') || 
            error.message.includes('email_not_confirmed') ||
            error.message.includes('signup_disabled')) {
          throw new Error('Please check your email and click the confirmation link before signing in.');
        }
        
        // Check for invalid credentials
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        }
        
        throw error;
      }

      // Double-check if user's email is confirmed
      if (data.user && !data.user.email_confirmed_at) {
        console.log('⚠️ User email not confirmed, signing out');
        await supabase.auth.signOut();
        throw new Error('Please check your email and click the confirmation link before signing in.');
      }

      console.log('✅ Signin successful');
      toast.success('Signed in successfully!');
    } catch (error: any) {
      console.error('❌ Signin error:', error);
      toast.error(error.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.info('Signed out successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resendConfirmation = async (email: string) => {
    try {
      console.log('📧 Resending confirmation for:', email);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?confirmed=true`
        }
      });

      if (error) {
        console.log('❌ Resend error:', error.message);
        throw error;
      }
      
      console.log('✅ Confirmation email resent');
      toast.success('Confirmation email sent! Please check your inbox.');
    } catch (error: any) {
      console.error('❌ Resend confirmation error:', error);
      toast.error(error.message);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('🔑 Sending password reset for:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`
      });

      if (error) {
        console.log('❌ Password reset error:', error.message);
        throw error;
      }
      
      console.log('✅ Password reset email sent');
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      toast.error(error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      resendConfirmation,
      resetPassword,
    }}>
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