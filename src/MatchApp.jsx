import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useMatches } from './context/MatchContext';
import { useMatchesDB } from './hooks/useMatchesDB';
import { supabase } from './lib/supabase';
import GameTracker from './components/GameTracker';
import ReportViewer from './components/ReportViewer';

export default function MatchApp() {
    const { matchId } = useParams();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, subscription, signOut } = useAuth();
    const { currentMatch, setCurrentMatch, matches, updateMatch } = useMatches();
    const { updateMatch: updateMatchDB, deleteMatch } = useMatchesDB();

    const isTracker = pathname.includes('/tracker');
    const view = isTracker ? 'tracker' : 'report';

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
    const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    // Cargar el partido desde Supabase si no está en el contexto local
    useEffect(() => {
        if (matchId === 'new') return;
        const existing = matches.find(m => m.id === matchId);
        if (existing) { setCurrentMatch(existing); return; }

        supabase.from('matches').select('*').eq('id', matchId).single().then(({ data }) => {
            if (data) setCurrentMatch(data);
        });
    }, [matchId]);

    // Sincronizar cambios del MatchContext local → Supabase
    useEffect(() => {
        if (!currentMatch || currentMatch.id !== matchId) return;
        const timeout = setTimeout(() => {
            updateMatchDB(matchId, {
                sets:       currentMatch.sets,
                score:      currentMatch.score,
                actions:    currentMatch.actions,
                status:     currentMatch.status || 'in_progress',
            });
        }, 1500); // debounce 1.5s
        return () => clearTimeout(timeout);
    }, [currentMatch?.actions, currentMatch?.sets, currentMatch?.score]);

    async function handleFinishMatch() {
        await updateMatchDB(matchId, { status: 'completed' });
        navigate('/dashboard');
    }

    async function handleDeleteMatch() {
        await deleteMatch(matchId);
        navigate('/dashboard');
    }

    return (
        <div className="container">
            <header>
                <div className="brand">
                    <h1>
                        <span>🏐</span>
                        Beach Volley <span className="accent">Analytics</span>
                    </h1>
                    <p>Performance Tracking · Match Analysis</p>
                </div>
                <nav>
                    <button onClick={() => navigate('/dashboard')}>← Mis partidos</button>
                    <button onClick={() => navigate(`/match/${matchId}/tracker`)} className={view === 'tracker' ? 'nav-active' : ''}>
                        Partido Actual
                    </button>
                    <button onClick={() => navigate(`/match/${matchId}`)} className={view === 'report' ? 'nav-active' : ''}>
                        Tendencias
                    </button>
                    <button onClick={signOut} style={{ marginLeft: '0.5rem', fontSize: '0.78rem' }}>Salir</button>
                </nav>
            </header>
            <main>
                {view === 'tracker' ? (
                    <GameTracker onFinishMatch={handleFinishMatch} />
                ) : (
                    <ReportViewer onGoToTracker={() => navigate(`/match/${matchId}/tracker`)} />
                )}
            </main>
        </div>
    );
}
