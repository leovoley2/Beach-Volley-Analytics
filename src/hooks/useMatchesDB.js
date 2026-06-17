import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const FREE_MONTHLY_LIMIT = 5;

// Traduce errores del servidor (RLS / rate limit) a mensajes claros en español.
function friendlyError(error) {
    if (!error) return error;
    const msg = error.message || String(error);
    if (/operaciones por minuto/i.test(msg)) {
        return 'Estás haciendo demasiadas operaciones muy rápido. Espera un momento e inténtalo de nuevo.';
    }
    if (/row-level security|violates row-level security|RLS/i.test(msg)) {
        return 'Alcanzaste el límite mensual del plan Free (5 partidos). Actualiza a Pro para crear más.';
    }
    return msg;
}

export function useMatchesDB({ autoFetch = true } = {}) {
    const { user, isPaid } = useAuth();
    const [matches, setMatches]   = useState([]);
    // Si no hacemos fetch automático, no arrancamos en estado "loading".
    const [loading, setLoading]   = useState(autoFetch);
    const [error, setError]       = useState(null);

    const fetchMatches = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) setError(error.message);
        else setMatches(data || []);
        setLoading(false);
    }, [user]);

    // autoFetch=false evita un SELECT innecesario cuando el hook se usa solo
    // para mutaciones (ej. MatchApp solo necesita updateMatch).
    useEffect(() => { if (autoFetch) fetchMatches(); }, [autoFetch, fetchMatches]);

    // Partidos del mes actual (para límite Free).
    // Usa UTC para coincidir con la política RLS del servidor: date_trunc('month', created_at).
    const matchesThisMonth = matches.filter(m => {
        const created = new Date(m.created_at);
        const now = new Date();
        return created.getUTCMonth() === now.getUTCMonth() && created.getUTCFullYear() === now.getUTCFullYear();
    });

    const canCreateMatch = isPaid || matchesThisMonth.length < FREE_MONTHLY_LIMIT;
    const monthlyUsed    = matchesThisMonth.length;

    const createMatch = useCallback(async (matchData) => {
        if (!canCreateMatch) return { error: 'Límite mensual alcanzado. Actualiza a Pro.' };
        const { data, error } = await supabase
            .from('matches')
            .insert([{ ...matchData, user_id: user.id, status: 'in_progress' }])
            .select()
            .single();
        if (!error) setMatches(prev => [data, ...prev]);
        return { data, error: error ? friendlyError(error) : null };
    }, [canCreateMatch, user]);

    const updateMatch = useCallback(async (id, matchData) => {
        if (!user) return { error: 'No autenticado' };
        const { data, error } = await supabase
            .from('matches')
            .update({ ...matchData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();
        if (!error) setMatches(prev => prev.map(m => m.id === id ? data : m));
        return { data, error: error ? friendlyError(error) : null };
    }, [user]);

    const deleteMatch = useCallback(async (id) => {
        if (!user) return { error: 'No autenticado' };
        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        if (!error) setMatches(prev => prev.filter(m => m.id !== id));
        return { error: error ? friendlyError(error) : null };
    }, [user]);

    return {
        matches,
        loading,
        error,
        canCreateMatch,
        monthlyUsed,
        monthlyLimit: FREE_MONTHLY_LIMIT,
        createMatch,
        updateMatch,
        deleteMatch,
        refetch: fetchMatches,
    };
}
