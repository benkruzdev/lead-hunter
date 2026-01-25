import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, type Profile } from '@/lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
    signUp: (data: SignUpData, recaptchaToken: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updatePassword: (newPassword: string) => Promise<void>;
    refreshProfile: () => Promise<void>;
};

type SignUpData = {
    email: string;
    password: string;
    fullName: string;
    phone: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Load profile from database
    const loadProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Profile load error:', error);
                throw error;
            }

            setProfile(data);
        } catch (error) {
            console.error('Failed to load profile:', error);
            setProfile(null);
        }
    };

    // Initialize auth state
    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                loadProfile(session.user.id).finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                await loadProfile(session.user.id);
            } else {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Sign in with email/password
    const signIn = async (email: string, password: string, rememberMe = false) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Set session persistence based on Remember Me
        if (rememberMe) {
            // Session persists (default Supabase behavior)
            await supabase.auth.setSession({
                access_token: (await supabase.auth.getSession()).data.session!.access_token,
                refresh_token: (await supabase.auth.getSession()).data.session!.refresh_token,
            });
        }
    };

    // Sign up with email/password
    const signUp = async ({ email, password, fullName, phone }: SignUpData, recaptchaToken: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    phone,
                    recaptcha_token: recaptchaToken,
                },
            },
        });

        if (error) throw error;
    };

    // Sign in with Google OAuth
    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/app/search`,
            },
        });

        if (error) throw error;
    };

    // Sign out
    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    // Reset password (send email)
    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;
    };

    // Update password
    const updatePassword = async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (error) throw error;
    };

    // Refresh profile data
    const refreshProfile = async () => {
        if (user) {
            await loadProfile(user.id);
        }
    };

    const value: AuthContextType = {
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
