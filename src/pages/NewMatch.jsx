import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMatchesDB } from '../hooks/useMatchesDB';
import AccountMenu from '../components/AccountMenu';
import TournamentArt from '../components/TournamentArt';
import { IconEye, IconLayers, IconSwap, IconPin, IconCalendar, IconBack, IconChevron } from '../components/Icons';
import { fetchTournaments, normalizeName } from '../lib/tournamentsApi';
import { colorFor, formatDay } from '../lib/matchGrouping';

const NEW_MATCH_COLUMNS = 'id, tournament, location, match_date, created_at, own_players, opponent_players';

const MODES = [
    { id: 'scouting', icon: <IconEye size={20} />, title: 'Scouting de tendencias', tag: 'Recomendado',
      desc: 'Los ataques del rival: tipo, zona y resultado. Ideal para preparar el partido.' },
    { id: 'completo', icon: <IconLayers size={20} />, title: 'Análisis completo K1/K2', tag: 'Análisis propio',
      desc: 'Todos los fundamentos: saque, recepción, armado, ataque, bloqueo y defensa.' },
];

const today = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

export default function NewMatch() {
    const { createMatch, matches, canCreateMatch, loading: loadingMatches } = useMatchesDB({ columns: NEW_MATCH_COLUMNS });
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const [mode, setMode]             = useState('scouting'); // 'scouting' | 'completo'
    const [tournament, setTournament] = useState(() => params.get('torneo') || '');
    const [location, setLocation]     = useState('');
    const [matchDate, setMatchDate]   = useState(today);
    const [ownP1, setOwnP1]           = useState('');
    const [ownP2, setOwnP2]           = useState('');
    const [oppP1, setOppP1]           = useState('');
    const [oppP2, setOppP2]           = useState('');
    const [error, setError]           = useState('');
    const [tried, setTried]           = useState(false);
    const [loading, setLoading]       = useState(false);
    const [tournaments, setTournaments] = useState([]);
    useEffect(() => { fetchTournaments().then(setTournaments).catch(() => {}); }, []);

    // Torneos recientes (por último partido) + los creados sin partidos, sin repetir.
    const recentTournaments = useMemo(() => {
        const seen = new Map();
        const byDate = [...matches].sort((a, b) => (b.match_date || b.created_at || '').localeCompare(a.match_date || a.created_at || ''));
        for (const m of byDate) {
            const k = normalizeName(m.tournament);
            if (k && !seen.has(k)) seen.set(k, m.tournament.trim());
        }
        for (const t of tournaments) seen.set(normalizeName(t.name), t.name); // nombre oficial
        return [...seen.values()];
    }, [matches, tournaments]);

    // Jugadores ya usados en partidos anteriores, para autocompletar.
    const knownPlayers = useMemo(() => {
        const seen = new Map();
        for (const m of matches) {
            for (const p of [...(m.own_players || []), ...(m.opponent_players || [])]) {
                const name = p?.name?.trim();
                if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
            }
        }
        return [...seen.values()].sort((a, b) => a.localeCompare(b));
    }, [matches]);

    const meta = tournaments.find(t => normalizeName(t.name) === normalizeName(tournament));
    const tName = tournament.trim();
    const tColor = colorFor(tName || 'Nuevo partido', meta?.color);

    // Si el torneo elegido tiene sede guardada, usarla como ubicación por defecto.
    const pickTournament = (name) => {
        setTournament(name);
        const m = tournaments.find(t => normalizeName(t.name) === normalizeName(name));
        if (m?.location && !location) setLocation(m.location);
    };

    const swapTeams = () => {
        setOwnP1(oppP1); setOwnP2(oppP2); setOppP1(ownP1); setOppP2(ownP2);
    };

    const missing = [ownP1, ownP2, oppP1, oppP2].filter(n => !n.trim()).length;
    const teamLabel = (a, b, fallback) => (a.trim() || b.trim() ? `${a.trim() || '—'} / ${b.trim() || '—'}` : fallback);

    async function handleStart(e) {
        e.preventDefault();
        setTried(true);
        if (missing) { setError(`Falta${missing > 1 ? 'n' : ''} ${missing} nombre${missing > 1 ? 's' : ''} de jugador.`); return; }
        setLoading(true);
        setError('');

        const [a1, a2, b1, b2] = [ownP1, ownP2, oppP1, oppP2].map(n => n.trim());
        // Unificar con el nombre exacto de un torneo existente (mayúsculas/espacios).
        const existing = recentTournaments.find(n => normalizeName(n) === normalizeName(tournament));
        const { data, error } = await createMatch({
            match_type:         mode,
            tournament:         existing || tournament.trim().replace(/\s+/g, ' '),
            location:           location.trim(),
            match_date:         matchDate,
            own_team_name:      `${a1} / ${a2}`,
            opponent_team_name: `${b1} / ${b2}`,
            own_players:        [{ id: crypto.randomUUID(), name: a1 }, { id: crypto.randomUUID(), name: a2 }],
            opponent_players:   [{ id: crypto.randomUUID(), name: b1 }, { id: crypto.randomUUID(), name: b2 }],
            sets:               [{ own: 0, opponent: 0 }],
            score:              { own: 0, opponent: 0 },
            sets_to_win:        2,
            actions:            [],
        });

        setLoading(false);
        if (error) { setError(error.message || error); return; }
        navigate(`/match/${data.id}/tracker`);
    }

    const playerInput = (value, set, label) => (
        <label className={`nm-player${tried && !value.trim() ? ' is-missing' : ''}`}>
            <span>{label}</span>
            <input className="form-input" type="text" list="nm-players" placeholder="Nombre" autoComplete="off"
                value={value} onChange={e => set(e.target.value)} />
        </label>
    );

    const blocked = !loadingMatches && !canCreateMatch;
    const modeInfo = MODES.find(m => m.id === mode);

    return (
        <div className="dash-root" style={{ '--t-color': tColor }}>
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button onClick={() => navigate('/dashboard')}>Mis partidos</button>
                    <button className="active">Nuevo partido</button>
                    <button onClick={() => navigate('/pizarra')}>Pizarra</button>
                </div>
                <div className="topbar-right"><AccountMenu /></div>
            </div>

            <div className="page-wrap page-wrap--wide nm">
                <button type="button" className="nm-back" onClick={() => navigate(-1)}><IconBack size={15} /> Volver</button>
                <div className="dash-head">
                    <div className="dash-head-text">
                        <div className="dash-kicker">Nuevo partido</div>
                        <h1>Prepara el registro</h1>
                        <p>Tres datos y empiezas: qué registras, dónde se juega y quién juega.</p>
                    </div>
                </div>

                {blocked && (
                    <div className="sync-banner" role="status">
                        <span>Alcanzaste el límite mensual del plan Free. Actualiza a Pro para crear más partidos.</span>
                        <button className="btn-primary" onClick={() => navigate('/pricing')}>Ver planes</button>
                    </div>
                )}

                <form className="nm-layout" onSubmit={handleStart} noValidate>
                    <div className="nm-form">
                        <section className="nm-step">
                            <h2><span className="nm-num">1</span> ¿Qué vas a registrar?</h2>
                            <div className="nm-modes" role="radiogroup" aria-label="Tipo de registro">
                                {MODES.map(({ id, icon, title, desc, tag }) => (
                                    <button key={id} type="button" role="radio" aria-checked={mode === id}
                                        className={`nm-mode nm-mode--${id}${mode === id ? ' on' : ''}`} onClick={() => setMode(id)}>
                                        <span className="nm-mode-icon">{icon}</span>
                                        <span className="nm-mode-text">
                                            <strong>{title}</strong>
                                            <span>{desc}</span>
                                        </span>
                                        <span className="nm-mode-tag">{tag}</span>
                                        <span className="nm-radio" aria-hidden />
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="nm-step">
                            <h2><span className="nm-num">2</span> Torneo y fecha</h2>
                            <div className="form-group">
                                <label htmlFor="nm-t">Torneo o evento</label>
                                <input id="nm-t" className="form-input" type="text" list="nm-tournaments" autoComplete="off"
                                    placeholder="Ej: Circuito Sudamericano · Lima" value={tournament} onChange={e => pickTournament(e.target.value)} />
                                <datalist id="nm-tournaments">{recentTournaments.map(n => <option key={n} value={n} />)}</datalist>
                                {recentTournaments.length > 0 && (
                                    <div className="t-suggest">
                                        {recentTournaments.slice(0, 6).map(n => (
                                            <button type="button" key={n} className={`chip${normalizeName(n) === normalizeName(tournament) ? ' on' : ''}`} onClick={() => pickTournament(n)}>{n}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="nm-two">
                                <div className="form-group">
                                    <label htmlFor="nm-d">Fecha</label>
                                    <input id="nm-d" className="form-input" type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="nm-l">Cancha o sede</label>
                                    <input id="nm-l" className="form-input" type="text" placeholder="Cancha 1" value={location} onChange={e => setLocation(e.target.value)} />
                                </div>
                            </div>
                        </section>

                        <section className="nm-step">
                            <h2><span className="nm-num">3</span> Equipos</h2>
                            <div className="nm-teams">
                                <div className="nm-team nm-team--a">
                                    <div className="nm-team-head"><span className="nm-team-dot" /> Equipo A <small>el que analizas</small></div>
                                    {playerInput(ownP1, setOwnP1, 'Jugador 1')}
                                    {playerInput(ownP2, setOwnP2, 'Jugador 2')}
                                </div>
                                <button type="button" className="nm-swap" onClick={swapTeams} title="Intercambiar equipos" aria-label="Intercambiar equipos">
                                    <IconSwap size={16} />
                                </button>
                                <div className="nm-team nm-team--b">
                                    <div className="nm-team-head"><span className="nm-team-dot" /> Equipo B <small>rival</small></div>
                                    {playerInput(oppP1, setOppP1, 'Jugador 1')}
                                    {playerInput(oppP2, setOppP2, 'Jugador 2')}
                                </div>
                            </div>
                            <datalist id="nm-players">{knownPlayers.map(n => <option key={n} value={n} />)}</datalist>
                        </section>
                    </div>

                    {/* Vista previa del partido + acción principal */}
                    <aside className="nm-side">
                        <div className="nm-preview">
                            <span className="tcover">
                                {meta?.image ? <img src={meta.image} alt="" /> : <TournamentArt name={tName || 'Nuevo partido'} color={tColor} />}
                            </span>
                            <span className="nm-preview-shade" />
                            <div className="nm-preview-top">
                                <span className="glass-pill">{modeInfo.id === 'scouting' ? 'Scouting' : 'Análisis K1/K2'}</span>
                            </div>
                            <div className="nm-preview-body">
                                <div className="nm-preview-t">{tName || 'Sin torneo'}</div>
                                <div className="nm-preview-teams">
                                    <span>{teamLabel(ownP1, ownP2, 'Equipo A')}</span>
                                    <i>vs</i>
                                    <span>{teamLabel(oppP1, oppP2, 'Equipo B')}</span>
                                </div>
                                <div className="nm-preview-meta">
                                    <span><IconCalendar size={13} /> {formatDay(matchDate)}</span>
                                    {location.trim() && <span><IconPin size={13} /> {location.trim()}</span>}
                                </div>
                            </div>
                        </div>

                        {error && <p className="nm-error" role="alert">{error}</p>}
                        <button type="submit" className="btn-new nm-submit" disabled={loading || blocked}>
                            {loading ? 'Creando…' : <>{mode === 'scouting' ? 'Iniciar scouting' : 'Iniciar análisis'} <IconChevron size={16} /></>}
                        </button>
                        <button type="button" className="nm-cancel" onClick={() => navigate('/dashboard')}>Cancelar</button>
                    </aside>
                </form>
            </div>
        </div>
    );
}
