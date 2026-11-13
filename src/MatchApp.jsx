import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useMatches } from './hooks/useMatches';
import { useMatchSync } from './hooks/useMatchSync';
import { getPending, clearPending, pickNewer, savePending, pushPending } from './lib/offlineSync';
import { supabase } from './lib/supabase';
import GameTracker from './components/GameTracker';
import ReportViewer from './components/ReportViewer';
import BoardWorkspace from './components/BoardWorkspace';
import VideoScout from './components/VideoScout';
import { IconBack, IconPulse, IconVideo, IconChart, IconBoard } from './components/Icons';
import { formatDay } from './lib/matchGrouping';

export default function MatchApp() {
    const { matchId }    = useParams();
    const { pathname }   = useLocation();
    const navigate       = useNavigate();
    const { user, isPaid, signOut } = useAuth();
    const userId = user?.id;
    const { currentMatch, setCurrentMatch, endCurrentMatch } = useMatches();
    // Guardado: primero en el dispositivo, después en Supabase (reintenta sin conexión).
    const { status: syncStatus, flush, markSynced } = useMatchSync(userId, matchId, currentMatch);

    async function handleSignOut() {
        endCurrentMatch();
        await signOut();
    }
    const [loadError, setLoadError]   = useState(null);
    const [loadingMatch, setLoadingMatch] = useState(false);

    const isTracker = pathname.includes('/tracker');
    const view      = isTracker ? 'tracker'
        : pathname.includes('/pizarra') ? 'board'
        : pathname.includes('/video') ? 'video'
        : 'report';

    // Cargar partido desde Supabase y adaptarlo al formato de MatchContext
    useEffect(() => {
        async function loadMatch() {
            // Ya está cargado
            if (currentMatch?.id === matchId) return;

            setLoadingMatch(true);
            const pending = getPending(userId, matchId);
            const { data, error } = await supabase
                .from('matches')
                .select('*')
                .eq('id', matchId)
                .single();

            setLoadingMatch(false);

            if (error || !data) {
                // Sin conexión: abrir la copia guardada en el dispositivo, si la hay.
                if (error?.code !== 'PGRST116' && pending?.match?.id === matchId) {
                    setCurrentMatch(pending.match);
                    return;
                }
                if (error?.code === 'PGRST116' && userId) clearPending(userId, matchId);
                setLoadError(error?.code === 'PGRST116' || !error
                    ? 'No se encontró el partido.'
                    : 'No se pudo cargar el partido. Revisa tu conexión.');
                return;
            }

            // Adaptar formato snake_case (Supabase) → camelCase (MatchContext/GameTracker)
            const fromServer = {
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
            };

            // Cambios guardados en el dispositivo que no alcanzaron a subirse: ganan si son más nuevos.
            const newer = pickNewer(pending, data.updated_at);
            if (newer) {
                const { sets, score, actions, status } = newer.match;
                setCurrentMatch({ ...fromServer, sets, score, actions, status });
            } else {
                if (pending && userId) clearPending(userId, matchId);
                markSynced(fromServer);
                setCurrentMatch(fromServer);
            }
        }

        loadMatch();
        // No limpiamos al desmontar para no perder datos al cambiar entre tracker/report.
    }, [matchId, currentMatch?.id, setCurrentMatch, userId, markSynced]);

    async function handleFinishMatch() {
        // Estado final: se guarda en el dispositivo y se intenta subir. Si no hay conexión,
        // queda pendiente y se sube solo después (Mis partidos avisa).
        if (currentMatch && userId) {
            savePending(userId, { ...currentMatch, status: 'completed' });
            await pushPending(userId, matchId);
        }
        endCurrentMatch();
        navigate('/dashboard');
    }

    if (loadingMatch) {
        return (
            <div className="mload" role="status">
                <span className="mload-ring" />
                <p>Cargando partido…</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="mload">
                <p>{loadError}</p>
                <button className="btn-new" onClick={() => navigate('/dashboard')}><IconBack size={15} /> Volver a Mis partidos</button>
            </div>
        );
    }

    return (
        <div className={`container ${{ tracker: 'container--tracker', board: 'container--board', video: 'container--video', report: 'container--report' }[view] || ''}`}>
            <div className="mbar">
                <button className="mbar-back" onClick={() => { endCurrentMatch(); navigate('/dashboard'); }} aria-label="Volver a Mis partidos" title="Mis partidos">
                    <IconBack size={18} />
                </button>
                <div className="mbar-title">
                    <div className="mbar-teams">
                        {currentMatch
                            ? <><span>{currentMatch.ownTeamName}</span><i>vs</i><span>{currentMatch.opponentTeamName}</span></>
                            : <span>Partido</span>}
                    </div>
                    <div className="mbar-sub">
                        {currentMatch && (
                            <span className="mbar-meta">
                                {[currentMatch.tournament, currentMatch.date && formatDay(currentMatch.date)].filter(Boolean).join(' · ')}
                            </span>
                        )}
                        {currentMatch && <SyncBadge status={syncStatus} onRetry={flush} />}
                    </div>
                </div>
                <nav className="mbar-nav" aria-label="Secciones del partido">
                    <button onClick={() => navigate(`/match/${matchId}/tracker`)} className={view === 'tracker' ? 'on' : ''} disabled={!currentMatch}>
                        <IconPulse size={15} /> Partido
                    </button>
                    <button onClick={() => navigate(`/match/${matchId}/video`)} className={view === 'video' ? 'on' : ''} disabled={!currentMatch}>
                        <IconVideo size={15} /> Video{!isPaid && <span className="pro-badge">PRO</span>}
                    </button>
                    <button onClick={() => navigate(`/match/${matchId}`)} className={view === 'report' ? 'on' : ''}>
                        <IconChart size={15} /> Tendencias
                    </button>
                    <button onClick={() => navigate(`/match/${matchId}/pizarra`)} className={view === 'board' ? 'on' : ''}>
                        <IconBoard size={15} /> Pizarra
                    </button>
                </nav>
                <button className="mbar-exit" onClick={handleSignOut}>Salir</button>
            </div>
            <main>
                {view === 'tracker' && <GameTracker onFinishMatch={handleFinishMatch} />}
                {view === 'video' && <VideoScout key={matchId} matchId={matchId} />}
                {view === 'board' && (
                    <BoardWorkspace
                        key={matchId}
                        scope={matchId}
                        ownTeamName={currentMatch?.ownTeamName}
                        opponentTeamName={currentMatch?.opponentTeamName}
                        ownPlayers={currentMatch?.ownPlayers}
                        opponentPlayers={currentMatch?.opponentPlayers}
                    />
                )}
                {view === 'report' && (
                    <ReportViewer
                        onGoToTracker={() => navigate(`/match/${matchId}/tracker`)}
                        isPaid={isPaid}
                        matchId={matchId}
                    />
                )}
            </main>
        </div>
    );
}

// Estado del guardado del partido, junto al logo.
function SyncBadge({ status, onRetry }) {
    if (status === 'offline') {
        return (
            <button className="sync-badge is-offline" onClick={onRetry} title="Reintentar ahora">
                ⚠ Sin conexión · guardado en este equipo
            </button>
        );
    }
    return (
        <span className={`sync-badge is-${status}`} role="status">
            {status === 'saving' ? 'Guardando…' : '✓ Guardado'}
        </span>
    );
}
