
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, role: 'consumer' | 'specialist', fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    console.log('Fetching profile for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      console.log('Profile fetched:', data);
      return data;
    } catch (err) {
      console.error('Exception fetching profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    console.log('AuthContext: Initializing auth state');

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session ? 'Found' : 'None');
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }

      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session ? 'Session exists' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, role: 'consumer' | 'specialist', fullName: string) => {
    console.log('Signing up user:', email, 'with role:', role);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Signup error:', error);
        return { error };
      }

      if (data.user) {
        console.log('User created, creating profile...');
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            role,
            full_name: fullName,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          return { error: profileError };
        }

        console.log('Profile created successfully');
      }

      return { error: null };
    } catch (err) {
      console.error('Exception during signup:', err);
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('Signing in user:', email);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
      } else {
        console.log('Sign in successful');
      }

      return { error };
    } catch (err) {
      console.error('Exception during sign in:', err);
      return { error: err };
    }
  };

  const oauthHandledRef = useRef(false);

  const handleOAuthCallbackUrl = async (url: string) => {
    if (oauthHandledRef.current) return;
    oauthHandledRef.current = true;

    console.log('Handling OAuth Callback URL:', url);
    const parsed = Linking.parse(url);
    const code =
      (parsed.queryParams?.code as string | undefined) ??
      (parsed.queryParams?.['auth_code'] as string | undefined);

    if (!code) {
      // If provider returned an error
      const err = parsed.queryParams?.error_description || parsed.queryParams?.error;
      console.warn('OAuth callback missing code', { err });
      oauthHandledRef.current = false; // Allow retry if it wasn't a success
      return;
    }

    console.log('Exchanging code for session:', code);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('exchangeCodeForSession error', error);
      oauthHandledRef.current = false;
      return;
    }

    console.log('Session exchanged successfully');
    // Session state will be updated via onAuthStateChange listener
  };

  const signInWithGoogle = async () => {
    console.log('Initiating Google Sign-In...');
    oauthHandledRef.current = false;

    try {
      const redirectUrl = Linking.createURL('/auth/callback');
      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We will open the browser manually
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned');

      console.log('Opening auth URL:', data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        console.log('WebBrowser success, handling callback');
        await handleOAuthCallbackUrl(result.url);
      } else {
        console.log('WebBrowser result type:', result.type);
        oauthHandledRef.current = false;
      }

      return { error: null };
    } catch (err: any) {
      console.error('Google Sign-In Exception:', err);
      oauthHandledRef.current = false;
      return { error: err };
    }
  };

  const signOut = async () => {
    console.log('Signing out user');
    try {
      await supabase.auth.signOut();
      setProfile(null);
      console.log('Sign out successful');
    } catch (err) {
      console.error('Exception during sign out:', err);
    }
  };

  // Handle Deep Links for Auth
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      console.log('Deep link received:', url);
      // Insurance: if redirect comes as deep link event
      handleOAuthCallbackUrl(url);
    };

    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signInWithGoogle, signOut, refreshProfile }}>
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
