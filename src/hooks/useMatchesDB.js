import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const FREE_MONTHLY_LIMIT = 5;

export function useMatchesDB() {
    const { user, isPaid } = useAuth();
    const [matches, setMatches]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);

    const fetchMatches = useCallback(async () => {
        if (!user) return;
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

    useEffect(() => { fetchMatches(); }, [fetchMatches]);

    // Partidos del mes actual (para límite Free)
    const matchesThisMonth = matches.filter(m => {
        const created = new Date(m.created_at);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });

    const canCreateMatch = isPaid || matchesThisMonth.length < FREE_MONTHLY_LIMIT;
    const monthlyUsed    = matchesThisMonth.length;

    async function createMatch(matchData) {
        if (!canCreateMatch) return { error: 'Límite mensual alcanzado. Actualiza a Pro.' };
        const { data, error } = await supabase
            .from('matches')
            .insert([{ ...matchData, user_id: user.id, status: 'in_progress' }])
            .select()
            .single();
        if (!error) setMatches(prev => [data, ...prev]);
        return { data, error };
    }

    async function updateMatch(id, matchData) {
        const { data, error } = await supabase
            .from('matches')
            .update({ ...matchData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();
        if (!error) setMatches(prev => prev.map(m => m.id === id ? data : m));
        return { data, error };
    }

    async function deleteMatch(id) {
        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
        if (!error) setMatches(prev => prev.filter(m => m.id !== id));
        return { error };
    }

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
