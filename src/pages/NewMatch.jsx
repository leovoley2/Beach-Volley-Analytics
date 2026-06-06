import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatchesDB } from '../hooks/useMatchesDB';

export default function NewMatch() {
    const { user } = useAuth();
    const { createMatch } = useMatchesDB();
    const navigate = useNavigate();

    const [mode, setMode]           = useState('scouting'); // 'scouting' | 'completo'
    const [tournament, setTournament] = useState('');
    const [location, setLocation]   = useState('');
    const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
    const [ownP1, setOwnP1]         = useState('');
    const [ownP2, setOwnP2]         = useState('');
    const [oppP1, setOppP1]         = useState('');
    const [oppP2, setOppP2]         = useState('');
    const [error, setError]         = useState('');
    const [loading, setLoading]     = useState(false);

    async function handleStart(e) {
        e.preventDefault();
        if (!ownP1 || !ownP2 || !oppP1 || !oppP2) {
            setError('Completa los nombres de los 4 jugadores.'); return;
        }
        setLoading(true);
        setError('');

        const ownTeam  = `${ownP1} / ${ownP2}`;
        const oppTeam  = `${oppP1} / ${oppP2}`;
        const ownPlayers  = [{ id: crypto.randomUUID(), name: ownP1 }, { id: crypto.randomUUID(), name: ownP2 }];
        const oppPlayers  = [{ id: crypto.randomUUID(), name: oppP1 }, { id: crypto.randomUUID(), name: oppP2 }];

        const { data, error } = await createMatch({
            match_type:         mode,
            tournament,
            location,
            match_date:         matchDate,
            own_team_name:      ownTeam,
            opponent_team_name: oppTeam,
            own_players:        ownPlayers,
            opponent_players:   oppPlayers,
            sets:               [{ own: 0, opponent: 0 }],
            score:              { own: 0, opponent: 0 },
            sets_to_win:        2,
            actions:            [],
        });

        setLoading(false);
        if (error) { setError(error.message || error); return; }
        navigate(`/match/${data.id}/tracker`);
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button onClick={() => navigate('/dashboard')}>Mis partidos</button>
                    <button className="active">Nuevo partido</button>
                </div>
                <div className="topbar-right">
                    <div className="avatar">{user?.email?.[0]?.toUpperCase()}</div>
                </div>
            </div>

            <div className="page-wrap">
                <div className="page-header">
                    <h2>Configurar partido</h2>
                    <p>Ingresa los datos antes de iniciar el seguimiento.</p>
                </div>

                <form onSubmit={handleStart} style={{ maxWidth: 580 }}>
                    {/* Selector de modo */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>¿Qué vas a registrar?</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                            {[
                                { id: 'scouting', icon: '🕵️', title: 'Scouting de Tendencias', desc: 'Analiza los ataques del rival — tipo, zona y resultado. Ideal para preparar el partido.', tag: 'RECOMENDADO', tagColor: 'var(--accent)' },
                                { id: 'completo', icon: '📊', title: 'Análisis Completo K1/K2', desc: 'Registra todos los fundamentos: Saque, Recepción, Armado, Ataque, Bloqueo y Defensa.', tag: 'ANÁLISIS PROPIO', tagColor: 'var(--text-muted)' },
                            ].map(m => (
                                <button key={m.id} type="button" onClick={() => setMode(m.id)} style={{
                                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                                    padding: '1.25rem', borderRadius: 'var(--radius-lg)', textAlign: 'left',
                                    cursor: 'pointer', transition: 'var(--trans)',
                                    background: mode === m.id ? `${m.tagColor === 'var(--accent)' ? 'rgba(249,115,22,0.1)' : 'rgba(59,130,246,0.08)'}` : 'var(--bg-card-alt)',
                                    border: `2px solid ${mode === m.id ? (m.id === 'scouting' ? 'var(--accent)' : 'var(--accent-blue)') : 'var(--border)'}`,
                                }}>
                                    <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>{m.title}</span>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.desc}</span>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '50px', background: mode === m.id ? `${m.tagColor}20` : 'var(--bg-hover)', color: mode === m.id ? m.tagColor : 'var(--text-muted)', border: `1px solid ${mode === m.id ? m.tagColor : 'var(--border)'}`, alignSelf: 'flex-start' }}>{m.tag}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Datos del partido */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.75rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem' }}>Información del partido</h3>

                        <div className="form-group">
                            <label>Torneo / Evento</label>
                            <input className="form-input" type="text" placeholder="Ej: Copa Regional 2026" value={tournament} onChange={e => setTournament(e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label>Fecha</label>
                                <input className="form-input" type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Ubicación</label>
                                <input className="form-input" type="text" placeholder="Cancha 1" value={location} onChange={e => setLocation(e.target.value)} />
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>EQUIPO A (el que analizas)</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group"><label>Jugador 1</label><input className="form-input" type="text" placeholder="Nombre" value={ownP1} onChange={e => setOwnP1(e.target.value)} required /></div>
                                <div className="form-group"><label>Jugador 2</label><input className="form-input" type="text" placeholder="Nombre" value={ownP2} onChange={e => setOwnP2(e.target.value)} required /></div>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>EQUIPO B (rival)</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group"><label>Jugador 1</label><input className="form-input" type="text" placeholder="Nombre" value={oppP1} onChange={e => setOppP1(e.target.value)} required /></div>
                                <div className="form-group"><label>Jugador 2</label><input className="form-input" type="text" placeholder="Nombre" value={oppP2} onChange={e => setOppP2(e.target.value)} required /></div>
                            </div>
                        </div>

                        {error && <p style={{ color: 'var(--c-dn)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button type="button" onClick={() => navigate('/dashboard')} style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius)', background: 'var(--bg-card-alt)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
                            <button type="submit" disabled={loading} style={{ flex: 2, padding: '0.75rem', borderRadius: 'var(--radius)', background: 'var(--accent)', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                                {loading ? 'Creando...' : mode === 'scouting' ? 'Iniciar scouting →' : 'Iniciar análisis →'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
