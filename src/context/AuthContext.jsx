import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser]               = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading]         = useState(true);

    useEffect(() => {
        // Sesión inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchSubscription(session.user.id);
            else setLoading(false);
        });

        // Escuchar cambios de auth
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchSubscription(session.user.id);
            else { setSubscription(null); setLoading(false); }
        });

        return () => authSub.unsubscribe();
    }, []);

    async function fetchSubscription(userId) {
        const { data } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();
        setSubscription(data ?? { plan: 'free', status: 'active' });
        setLoading(false);
    }

    async function signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
        });
        return { data, error };
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    }

    async function signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        return { data, error };
    }

    async function signOut() {
        await supabase.auth.signOut();
    }

    const isPro  = subscription?.plan === 'pro'  && subscription?.status === 'active';
    const isTeam = subscription?.plan === 'team' && subscription?.status === 'active';
    const isPaid = isPro || isTeam;

    return (
        <AuthContext.Provider value={{ user, subscription, loading, isPaid, isPro, isTeam, signUp, signIn, signInWithGoogle, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
