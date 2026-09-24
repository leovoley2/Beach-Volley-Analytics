import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatchesDB } from '../hooks/useMatchesDB';
import { LEGAL } from '../lib/legalConfig';
import AccountMenu from '../components/AccountMenu';

const STATUS_LABEL = { in_progress: 'En progreso', completed: 'Completado' };
const STATUS_COLOR = { in_progress: '#f97316', completed: '#22c55e' };

export default function Dashboard() {
    const { user, subscription, isPaid } = useAuth();
    const { matches, loading, monthlyUsed, monthlyLimit, canCreateMatch, deleteMatch } = useMatchesDB();
    const navigate = useNavigate();
    const [deletingId, setDeletingId] = useState(null);
    const [confirmId, setConfirmId]   = useState(null);

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario';

    async function handleDelete(id) {
        setDeletingId(id);
        await deleteMatch(id);
        setDeletingId(null);
        setConfirmId(null);
    }

    const pct = Math.min((monthlyUsed / monthlyLimit) * 100, 100);

    // Enlace de soporte técnico con asunto y datos del usuario pre-llenados
    const supportMailto = `mailto:${LEGAL.supportEmail}`
        + `?subject=${encodeURIComponent('Soporte — Beach Volley Analytics')}`
        + `&body=${encodeURIComponent(`\n\n---\nUsuario: ${user?.email || ''}\nPlan: ${subscription?.plan || 'free'}`)}`;

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Topbar */}
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button className="active">Mis partidos</button>
                    <button onClick={() => navigate('/match/new')}>Nuevo partido</button>
                </div>
                <div className="topbar-right">
                    <AccountMenu />
                </div>
            </div>

            <div className="page-wrap">
                <div className="page-header">
                    <h2>Mis partidos</h2>
                    <p>Hola, {displayName}. Aquí están todos tus partidos registrados.</p>
                </div>

                {/* Stats */}
                <div className="stats-row">
                    <div className="stat-card accent-border">
                        <div className="stat-label">Partidos este mes</div>
                        <div className="stat-value" style={{ color: 'var(--accent)' }}>{monthlyUsed}</div>
                        <div className="stat-sub">{isPaid ? 'Ilimitados (Pro)' : `de ${monthlyLimit} disponibles (Free)`}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Total registrados</div>
                        <div className="stat-value">{matches.length}</div>
                        <div className="stat-sub">desde tu registro</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Acciones totales</div>
                        <div className="stat-value">
                            {matches.reduce((sum, m) => sum + (m.actions?.filter(a => a.skill).length || 0), 0)}
                        </div>
                        <div className="stat-sub">en todos los partidos</div>
                    </div>
                </div>

                {/* Barra de límite — solo plan Free */}
                {!isPaid && (
                    <div className="limit-bar-wrap">
                        <div className="limit-info">
                            <div className="limit-title">Plan Free · {monthlyUsed} / {monthlyLimit} partidos este mes</div>
                            <div className="limit-bar">
                                <div className="limit-bar-fill" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--c-dn)' : 'var(--accent)' }} />
                            </div>
                            <div className="limit-sub">
                                {canCreateMatch
                                    ? `Te quedan ${monthlyLimit - monthlyUsed} partidos. Actualiza a Pro para partidos ilimitados.`
                                    : 'Límite mensual alcanzado. Actualiza a Pro para continuar.'}
                            </div>
                        </div>
                        <button className="btn-upgrade" onClick={() => navigate('/pricing')}>
                            Actualizar a Pro →
                        </button>
                    </div>
                )}

                {/* Lista de partidos */}
                <div className="section-header">
                    <h3>Partidos recientes</h3>
                    <button
                        className="btn-new"
                        onClick={() => canCreateMatch ? navigate('/match/new') : navigate('/pricing')}
                        style={!canCreateMatch ? { opacity: 0.6 } : {}}
                    >
                        {canCreateMatch ? '+ Nuevo partido' : '🔒 Límite alcanzado'}
                    </button>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Cargando partidos...</p>
                ) : matches.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🏐</div>
                        <h3>Aún no tienes partidos</h3>
                        <p>Crea tu primer partido de scouting o análisis completo.</p>
                        <button className="btn-new" onClick={() => navigate('/match/new')}>+ Nuevo partido</button>
                    </div>
                ) : (
                    <div className="match-list">
                        {matches.map(match => {
                            const scoreText   = `${match.score?.own ?? 0} – ${match.score?.opponent ?? 0}`;
                            const isScout     = match.match_type === 'scouting';
                            const isCompleted = match.status === 'completed';
                            // Bug fix: parsear fecha con T00:00:00 para evitar off-by-one de timezone UTC
                            const dateStr = match.match_date
                                ? new Date(match.match_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '—';
                            // Partidos en progreso van al tracker, completados van a tendencias
                            const matchUrl = isCompleted
                                ? `/match/${match.id}`
                                : `/match/${match.id}/tracker`;

                            return (
                                <div key={match.id} className="match-item" onClick={() => navigate(matchUrl)}>
                                    <div className="match-icon">{isScout ? '🕵️' : '📊'}</div>
                                    <div className="match-info">
                                        <div className="match-teams">
                                            {match.own_team_name} vs {match.opponent_team_name}
                                        </div>
                                        <div className="match-meta">
                                            <span>📅 {dateStr}</span>
                                            {match.location && <span>📍 {match.location}</span>}
                                            {match.tournament && <span>🏆 {match.tournament}</span>}
                                            <span style={{ color: STATUS_COLOR[match.status] || '#7a8899', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', border: `1px solid ${STATUS_COLOR[match.status] || '#7a8899'}`, padding: '0.1rem 0.5rem', borderRadius: '50px', background: `${STATUS_COLOR[match.status] || '#7a8899'}15` }}>
                                                {STATUS_LABEL[match.status] || match.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="match-score" style={{ color: isCompleted ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                        {scoreText}
                                    </div>
                                    <div className="match-actions">
                                        <div className="btn-icon" title={isCompleted ? 'Ver tendencias' : 'Continuar partido'}
                                            onClick={e => { e.stopPropagation(); navigate(matchUrl); }}>
                                            {isCompleted ? '📊' : '▶'}
                                        </div>
                                        <div
                                            className="btn-icon danger"
                                            title="Eliminar"
                                            onClick={e => { e.stopPropagation(); setConfirmId(match.id); }}
                                        >🗑</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Soporte técnico */}
                <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    ¿Necesitas ayuda o tienes un problema? Escríbenos a{' '}
                    <a href={supportMailto} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                        {LEGAL.supportEmail}
                    </a>
                </div>
            </div>

            {/* Modal confirmar eliminación */}
            {confirmId && (
                <div className="modal-overlay" onClick={() => setConfirmId(null)}>
                    <div className="dialog-card" onClick={e => e.stopPropagation()}>
                        <div className="dialog-icon">🗑</div>
                        <h3>Eliminar partido</h3>
                        <p>¿Estás seguro? Esta acción no se puede deshacer.</p>
                        <div className="dialog-actions">
                            <button className="btn-cancel" onClick={() => setConfirmId(null)}>Cancelar</button>
                            <button className="btn-delete" onClick={() => handleDelete(confirmId)} disabled={deletingId === confirmId}>
                                {deletingId === confirmId ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
