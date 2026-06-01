import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useMatches } from './context/MatchContext';
import { useMatchesDB } from './hooks/useMatchesDB';
import { supabase } from './lib/supabase';
import GameTracker from './components/GameTracker';
import ReportViewer from './components/ReportViewer';

export default function MatchApp() {
    const { matchId }       = useParams();
    const { pathname }      = useLocation();
    const navigate          = useNavigate();
    const { user, subscription, isPaid, signOut } = useAuth();
    const { currentMatch, setCurrentMatch, matches, addMatch, updateMatch } = useMatches();
    const { updateMatch: updateMatchDB, deleteMatch } = useMatchesDB();
    const [loadError, setLoadError] = useState(null);

    const isTracker = pathname.includes('/tracker');
    const view      = isTracker ? 'tracker' : 'report';

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
    const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    // Cargar partido desde Supabase y sincronizar al MatchContext local
    useEffect(() => {
        async function loadMatch() {
            // Ya lo tenemos cargado
            if (currentMatch?.id === matchId) return;

            // Buscar en el contexto local primero (por si lo cargó antes)
            const local = matches.find(m => m.id === matchId);
            if (local) { setCurrentMatch(local); return; }

            // Cargar desde Supabase
            const { data, error } = await supabase
                .from('matches')
                .select('*')
                .eq('id', matchId)
                .single();

            if (error || !data) {
                setLoadError('No se encontró el partido.');
                return;
            }

            // Adaptar el formato de Supabase al formato que espera MatchContext
            // Supabase guarda own_team_name, MatchContext usa ownTeamName etc.
            const adapted = {
                id:               data.id,
                ownTeamName:      data.own_team_name,
                opponentTeamName: data.opponent_team_name,
                ownPlayers:       data.own_players  || [],
                opponentPlayers:  data.opponent_players || [],
                sets:             data.sets    || [{ own: 0, opponent: 0 }],
                score:            data.score   || { own: 0, opponent: 0 },
                setsToWin:        data.sets_to_win || 2,
                actions:          data.actions || [],
                matchType:        data.match_type || 'scouting',
                date:             data.match_date,
                tournament:       data.tournament || '',
                location:         data.location   || '',
                status:           data.status,
                // Supabase ID original guardado para sync
                _supabaseId:      data.id,
            };

            // Insertar en MatchContext para que ReportViewer pueda accederlo
            addMatch(adapted);
            setCurrentMatch(adapted);
        }

        loadMatch();
    }, [matchId]);

    // Sincronizar cambios del tracker → Supabase (debounce 1.5s)
    useEffect(() => {
        if (!currentMatch || currentMatch.id !== matchId) return;

        const timeout = setTimeout(() => {
            updateMatchDB(matchId, {
                sets:    currentMatch.sets,
                score:   currentMatch.score,
                actions: currentMatch.actions,
                status:  currentMatch.status || 'in_progress',
            });
        }, 1500);

        return () => clearTimeout(timeout);
    }, [currentMatch?.actions, currentMatch?.sets, currentMatch?.score]);

    async function handleFinishMatch() {
        await updateMatchDB(matchId, { status: 'completed' });
        navigate('/dashboard');
    }

    if (loadError) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2rem' }}>⚠️</div>
                <p style={{ color: 'var(--text-secondary)' }}>{loadError}</p>
                <button onClick={() => navigate('/dashboard')} className="btn-primary">← Volver al dashboard</button>
            </div>
        );
    }

    return (
        <div className="container">
            <header>
                <div className="brand">
                    <h1><span>🏐</span>Beach Volley <span className="accent">Analytics</span></h1>
                    <p>Performance Tracking · Match Analysis</p>
                </div>
                <nav>
                    <button onClick={() => navigate('/dashboard')}>← Mis partidos</button>
                    <button
                        onClick={() => navigate(`/match/${matchId}/tracker`)}
                        className={view === 'tracker' ? 'nav-active' : ''}
                        disabled={!currentMatch}
                    >
                        Partido Actual
                    </button>
                    <button
                        onClick={() => navigate(`/match/${matchId}`)}
                        className={view === 'report' ? 'nav-active' : ''}
                    >
                        Tendencias
                    </button>
                </nav>
            </header>
            <main>
                {view === 'tracker'
                    ? <GameTracker onFinishMatch={handleFinishMatch} />
                    : <ReportViewer
                        onGoToTracker={() => navigate(`/match/${matchId}/tracker`)}
                        isPaid={isPaid}
                        matchId={matchId}
                      />
                }
            </main>
        </div>
    );
}
