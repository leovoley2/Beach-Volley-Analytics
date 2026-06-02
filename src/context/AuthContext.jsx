import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser]                 = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading]           = useState(true);

    useEffect(() => {
        let mounted = true;

        // Timeout de seguridad: si en 8 segundos no resuelve, desbloquear la app
        const safetyTimeout = setTimeout(() => {
            if (mounted) {
                console.warn('AuthContext: timeout de seguridad activado');
                setLoading(false);
            }
        }, 8000);

        async function initAuth() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (!mounted) return;

                if (error) {
                    console.error('Error al obtener sesión:', error.message);
                    setLoading(false);
                    return;
                }

                if (session?.user) {
                    setUser(session.user);
                    await fetchSubscription(session.user.id);
                } else {
                    setUser(null);
                    setSubscription(null);
                    setLoading(false);
                }
            } catch (err) {
                console.error('AuthContext init error:', err);
                if (mounted) setLoading(false);
            } finally {
                clearTimeout(safetyTimeout);
            }
        }

        initAuth();

        // Listener para cambios de sesión (login / logout)
        const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!mounted) return;
                if (session?.user) {
                    setUser(session.user);
                    await fetchSubscription(session.user.id);
                } else {
                    setUser(null);
                    setSubscription(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            clearTimeout(safetyTimeout);
            authListener?.unsubscribe();
        };
    }, []);

    async function fetchSubscription(userId) {
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = no rows found (usuario nuevo aún sin fila)
                console.error('Error fetching subscription:', error.message);
            }
            setSubscription(data ?? { plan: 'free', status: 'active' });
        } catch (err) {
            console.error('fetchSubscription error:', err);
            setSubscription({ plan: 'free', status: 'active' });
        } finally {
            setLoading(false);
        }
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
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('signOut error:', err);
        } finally {
            setUser(null);
            setSubscription(null);
            setLoading(false);
        }
        // Forzar recarga completa del navegador para limpiar todo estado
        window.location.replace('/login');
    }

    const isPro  = subscription?.plan === 'pro'  && subscription?.status === 'active';
    const isTeam = subscription?.plan === 'team' && subscription?.status === 'active';
    const isPaid = isPro || isTeam;

    return (
        <AuthContext.Provider value={{
            user, subscription, loading,
            isPaid, isPro, isTeam,
            signUp, signIn, signInWithGoogle, signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
    return ctx;
}
