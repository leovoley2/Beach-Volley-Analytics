import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser]                 = useState(null);
    const [session, setSession]           = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading]           = useState(true);

    // Definida ANTES del useEffect que la usa como dependencia: si se declara después,
    // el array [fetchSubscription] la lee en zona muerta temporal (TDZ) y la app crashea
    // en producción con "Cannot access ... before initialization".
    const fetchSubscription = useCallback(async (userId) => {
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
            return data;
        } catch (err) {
            console.error('fetchSubscription error:', err);
            setSubscription({ plan: 'free', status: 'active' });
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

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
                    setSession(session);
                    await fetchSubscription(session.user.id);
                } else {
                    setUser(null);
                    setSession(null);
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
                    setSession(session);
                    await fetchSubscription(session.user.id);
                } else {
                    setUser(null);
                    setSession(null);
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
    }, [fetchSubscription]);

    // Refresca la suscripción desde la BD — útil después de un pago.
    // Memoizada para no reiniciar efectos que la usan como dependencia (ej. PaymentSuccess).
    const refreshSubscription = useCallback(async () => {
        if (!user) return null;
        return fetchSubscription(user.id);
    }, [user, fetchSubscription]);

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
            // scope:'local' limpia la sesión de localStorage SIN llamada de red.
            // El signOut global (por defecto) hace un revoke por red que puede
            // colgarse → el await nunca resolvía y el botón "Salir" no hacía nada.
            // Lo envolvemos además en un timeout para garantizar la salida siempre.
            await Promise.race([
                supabase.auth.signOut({ scope: 'local' }),
                new Promise(resolve => setTimeout(resolve, 1500)),
            ]);
        } catch (err) {
            console.error('signOut error:', err);
        } finally {
            setUser(null);
            setSession(null);
            setSubscription(null);
            setLoading(false);
        }
        // Forzar recarga completa del navegador para limpiar todo estado
        window.location.replace('/');
    }

    const isPro  = subscription?.plan === 'pro'  && subscription?.status === 'active';
    const isTeam = subscription?.plan === 'team' && subscription?.status === 'active';
    const isPaid = isPro || isTeam;

    return (
        <AuthContext.Provider value={{
            user, session, subscription, loading,
            isPaid, isPro, isTeam,
            signUp, signIn, signInWithGoogle, signOut,
            refreshSubscription,
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
