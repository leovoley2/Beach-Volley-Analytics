import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useMatches } from './context/MatchContext';
import { useMatchesDB } from './hooks/useMatchesDB';
import { supabase } from './lib/supabase';
import GameTracker from './components/GameTracker';
import ReportViewer from './components/ReportViewer';

export default function MatchApp() {
    const { matchId }    = useParams();
    const { pathname }   = useLocation();
    const navigate       = useNavigate();
    const { isPaid, signOut } = useAuth();
    const { currentMatch, setCurrentMatch, endCurrentMatch } = useMatches();
    // autoFetch:false → este hook solo se usa para persistir; evita un SELECT innecesario.
    const { updateMatch: updateMatchDB } = useMatchesDB({ autoFetch: false });

    async function handleSignOut() {
        endCurrentMatch();
        await signOut();
    }
    const [loadError, setLoadError]   = useState(null);
    const [loadingMatch, setLoadingMatch] = useState(false);

    const isTracker = pathname.includes('/tracker');
    const view      = isTracker ? 'tracker' : 'report';

    // Cargar partido desde Supabase y adaptarlo al formato de MatchContext
    useEffect(() => {
        async function loadMatch() {
            // Ya está cargado
            if (currentMatch?.id === matchId) return;

            setLoadingMatch(true);
            const { data, error } = await supabase
                .from('matches')
                .select('*')
                .eq('id', matchId)
                .single();

            setLoadingMatch(false);

            if (error || !data) {
                setLoadError('No se encontró el partido.');
                return;
            }

            // Adaptar formato snake_case (Supabase) → camelCase (MatchContext/GameTracker)
            setCurrentMatch({
                id:               data.id,          // Preservar UUID real de Supabase
                ownTeamName:      data.own_team_name,
                opponentTeamName: data.opponent_team_name,
                ownPlayers:       data.own_players       || [],
                opponentPlayers:  data.opponent_players  || [],
                sets:             data.sets              || [{ own: 0, opponent: 0 }],
                score:            data.score             || { own: 0, opponent: 0 },
                setsToWin:        data.sets_to_win       || 2,
                actions:          data.actions           || [],
                matchType:        data.match_type        || 'scouting',
                date:             data.match_date,
                tournament:       data.tournament        || '',
                location:         data.location          || '',
                status:           data.status,
            });
        }

        loadMatch();
        // No limpiamos al desmontar para no perder datos al cambiar entre tracker/report.
    }, [matchId, currentMatch?.id, setCurrentMatch]);

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
    }, [currentMatch, matchId, updateMatchDB]);

    async function handleFinishMatch() {
        // Guardar estado final en Supabase como completado
        await updateMatchDB(matchId, {
            sets:    currentMatch?.sets,
            score:   currentMatch?.score,
            actions: currentMatch?.actions,
            status:  'completed',
        });
        endCurrentMatch();
        navigate('/dashboard');
    }

    if (loadingMatch) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0f1a', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '2.5rem', animation: 'spin 1.5s linear infinite' }}>🏐</div>
                <p style={{ color: '#7a8899', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Cargando partido...</p>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (loadError) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0f1a', flexDirection: 'column', gap: '1rem', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ fontSize: '2rem' }}>⚠️</div>
                <p style={{ color: '#7a8899' }}>{loadError}</p>
                <button onClick={() => navigate('/dashboard')} style={{ padding: '0.65rem 1.5rem', background: '#f97316', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>
                    ← Volver al dashboard
                </button>
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
                    <button onClick={() => { endCurrentMatch(); navigate('/dashboard'); }}>← Mis partidos</button>
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
                    <button onClick={handleSignOut} style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Salir
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
