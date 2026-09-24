import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

// Las llamadas del cliente Supabase pueden quedarse colgadas (ver lock no-op en
// lib/supabase.js): en flujos de UI siempre con tope de tiempo.
function withTimeout(promise, ms = 10000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado. Revisa tu conexión e inténtalo de nuevo.')), ms)),
    ]);
}

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
        }
        // Nota: NO tocamos `loading` aquí. La app se desbloquea en cuanto hay sesión
        // (ver loadSession); la suscripción se carga en segundo plano, en paralelo
        // con los partidos, para que el dashboard aparezca lo antes posible.
    }, []);

    useEffect(() => {
        let mounted = true;
        // Id del usuario ya cargado. Evita:
        //  - Doble fetch de suscripción (getSession + evento INITIAL_SESSION del listener).
        //  - Re-descargar los partidos en cada refresco de token: si NO cambiamos la
        //    referencia de `user`, el efecto de useMatchesDB no se vuelve a disparar.
        let loadedUserId = null;

        // Timeout de seguridad: si en 8 segundos no resuelve, desbloquear la app
        const safetyTimeout = setTimeout(() => {
            if (mounted) {
                console.warn('AuthContext: timeout de seguridad activado');
                setLoading(false);
            }
        }, 8000);

        function loadSession(session) {
            if (!mounted) return;
            if (session?.user) {
                // Mantener el token/session siempre fresco (útil tras TOKEN_REFRESHED).
                setSession(session);
                // Desbloquear la app de inmediato: ProtectedRoute solo necesita `user`.
                // No esperamos a la suscripción → el dashboard monta y carga los
                // partidos en paralelo con la consulta de suscripción.
                setLoading(false);
                if (session.user.id !== loadedUserId) {
                    loadedUserId = session.user.id;
                    setUser(session.user);           // solo al cambiar de usuario
                    fetchSubscription(session.user.id); // en segundo plano (sin await)
                }
            } else {
                loadedUserId = null;
                setUser(null);
                setSession(null);
                setSubscription(null);
                setLoading(false);
            }
        }

        supabase.auth.getSession()
            .then(({ data: { session }, error }) => {
                if (error) {
                    console.error('Error al obtener sesión:', error.message);
                    if (mounted) setLoading(false);
                    return;
                }
                loadSession(session);
            })
            .catch(err => {
                console.error('AuthContext init error:', err);
                if (mounted) setLoading(false);
            })
            .finally(() => clearTimeout(safetyTimeout));

        // Listener para cambios de sesión (login / logout / refresh de token).
        const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
            (_event, session) => loadSession(session)
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

    // Cambia el nombre visible: metadata de auth (lo que lee la UI) + profiles.
    // `user` sólo se actualiza al cambiar de usuario (ver loadSession), así que
    // lo reemplazamos a mano con el usuario que devuelve updateUser.
    async function updateDisplayName(fullName) {
        const { data, error } = await withTimeout(
            supabase.auth.updateUser({ data: { full_name: fullName } })
        );
        if (error) return { error };
        if (data?.user) setUser(data.user);
        await withTimeout(
            supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id)
        ).catch(err => console.error('profiles update error:', err));
        return { error: null };
    }

    async function updatePassword(password) {
        const { error } = await withTimeout(supabase.auth.updateUser({ password }));
        return { error };
    }

    // Misma regla que is_paid_user() en la BD:
    //  - activa: periodo vigente (+3 días de gracia para la renovación); sin fecha = vigente.
    //  - cancelada: conserva el acceso hasta current_period_end (lo ya pagado).
    const GRACE_MS  = 3 * 24 * 60 * 60 * 1000;
    const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
    const isActive  =
        (subscription?.status === 'active'   && (periodEnd === null || periodEnd > Date.now() - GRACE_MS)) ||
        (subscription?.status === 'canceled' && periodEnd !== null && periodEnd > Date.now());
    const isPro  = subscription?.plan === 'pro'  && isActive;
    const isTeam = subscription?.plan === 'team' && isActive;
    const isPaid = isPro || isTeam;
    // Cancelada pero aún dentro del periodo pagado: Pro hasta current_period_end, sin renovación.
    const isCanceling = isPaid && subscription?.status === 'canceled';

    return (
        <AuthContext.Provider value={{
            user, session, subscription, loading,
            isPaid, isPro, isTeam, isCanceling,
            signUp, signIn, signInWithGoogle, signOut,
            refreshSubscription, setSubscription,
            updateDisplayName, updatePassword,
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
