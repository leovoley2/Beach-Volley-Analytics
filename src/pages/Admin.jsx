import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { useAuth } from '../context/AuthContext';
import AccountMenu from '../components/AccountMenu';
import Notice from '../components/Notice';
import { formatDate, postApi } from '../lib/accountApi';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const SOURCE_LABEL = {
    paypal:          { text: 'Pagando',     cls: 'ok' },
    paypal_canceled: { text: 'Cancelando',  cls: 'warn' },
    manual:          { text: 'Pro regalado', cls: 'info' },
    admin:           { text: 'Admin',       cls: 'info' },
    free:            { text: 'Free',        cls: 'muted' },
};
const FILTERS = [
    { key: 'all',    label: 'Todos' },
    { key: 'paying', label: 'Pagando' },
    { key: 'manual', label: 'Regalados' },
    { key: 'free',   label: 'Free' },
];
const DURATIONS = [
    { months: 1,  label: '1 mes' },
    { months: 3,  label: '3 meses' },
    { months: 6,  label: '6 meses' },
    { months: 12, label: '1 año' },
    { months: 0,  label: 'Sin vencimiento' },
];

function timeAgo(ts) {
    if (!ts) return '—';
    const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
    if (days <= 0) return 'hoy';
    if (days === 1) return 'ayer';
    if (days < 30) return `hace ${days} días`;
    return formatDate(ts);
}

const money = (n) => `$${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Gráfica de barras de una sola serie (sin leyenda: el título la nombra).
function WeeklyBars({ title, weeks, field }) {
    const labels = weeks.map(w => new Date(w.start).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }));
    const total = weeks.reduce((a, w) => a + w[field], 0);
    const data = {
        labels,
        datasets: [{
            data: weeks.map(w => w[field]),
            backgroundColor: '#f97316',
            hoverBackgroundColor: '#fb923c',
            borderRadius: 4,
            borderSkipped: 'bottom',
            maxBarThickness: 22,
        }],
    };
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { title: (items) => `Semana del ${items[0].label}` } },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#7a8899', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, border: { display: false }, ticks: { color: '#7a8899', font: { size: 10 }, precision: 0 } },
        },
    };
    return (
        <div className="admin-chart">
            <div className="admin-chart-head">
                <h4>{title}</h4>
                <span>{total} en 12 semanas</span>
            </div>
            <div style={{ height: 180 }}>
                <Bar data={data} options={options} aria-label={`${title}: ${weeks.map((w, i) => `${labels[i]} ${w[field]}`).join(', ')}`} role="img" />
            </div>
        </div>
    );
}

/** Panel de administración: sólo accesible si api/admin.js confirma el rol admin. */
export default function Admin() {
    const { session } = useAuth();
    const navigate = useNavigate();
    const token = session?.access_token;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [loadError, setLoadError] = useState('');

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const [grantEmail, setGrantEmail] = useState('');
    const [grantMonths, setGrantMonths] = useState(12);
    const [grantNote, setGrantNote] = useState('');
    const [granting, setGranting] = useState(false);
    const [grantMsg, setGrantMsg] = useState(null);

    const [revokeTarget, setRevokeTarget] = useState(null);
    const [revoking, setRevoking] = useState(false);

    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState(null);

    const load = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setLoadError('');
        try {
            setData(await postApi('/api/admin', token, { action: 'overview' }));
        } catch (err) {
            if (err.message === 'Forbidden') setForbidden(true);
            else setLoadError(err.message);
        }
        setLoading(false);
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const users = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        return data.users.filter(u => {
            if (filter === 'paying' && !['paypal', 'paypal_canceled'].includes(u.source)) return false;
            if (filter === 'manual' && u.source !== 'manual') return false;
            if (filter === 'free' && u.source !== 'free') return false;
            if (!q) return true;
            return (u.email || '').toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q);
        });
    }, [data, search, filter]);

    async function handleGrant(e) {
        e.preventDefault();
        setGranting(true);
        setGrantMsg(null);
        try {
            await postApi('/api/admin', token, { action: 'grant', email: grantEmail, months: grantMonths, note: grantNote });
            const dur = DURATIONS.find(d => d.months === grantMonths)?.label.toLowerCase();
            setGrantMsg({ ok: true, text: `Pro activado para ${grantEmail.trim()} (${dur}).` });
            setGrantEmail('');
            setGrantNote('');
            load();
        } catch (err) {
            setGrantMsg({ ok: false, text: err.message });
        }
        setGranting(false);
    }

    async function handleRevoke() {
        setRevoking(true);
        try {
            await postApi('/api/admin', token, { action: 'revoke', userId: revokeTarget.id });
            setRevokeTarget(null);
            load();
        } catch (err) {
            setGrantMsg({ ok: false, text: err.message });
            setRevokeTarget(null);
        }
        setRevoking(false);
    }

    async function handleSync() {
        setSyncing(true);
        setSyncMsg(null);
        try {
            const r = await postApi('/api/admin', token, { action: 'sync_payments' });
            setSyncMsg({ ok: r.failed === 0, text: `Sincronizado: ${r.imported} cobros de ${r.subscriptions} suscripciones${r.failed ? ` (${r.failed} con error)` : ''}.` });
            load();
        } catch (err) {
            setSyncMsg({ ok: false, text: err.message });
        }
        setSyncing(false);
    }

    function prefillGrant(email) {
        setGrantEmail(email);
        setGrantMsg(null);
        document.getElementById('admin-grant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const topbar = (
        <div className="topbar">
            <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
            <div className="topbar-nav">
                <button onClick={() => navigate('/dashboard')}>Mis partidos</button>
                <button className="active">Admin</button>
            </div>
            <div className="topbar-right"><AccountMenu /></div>
        </div>
    );

    if (forbidden) {
        return (
            <div style={{ minHeight: '100vh' }}>
                {topbar}
                <div className="page-wrap"><div className="empty-state">
                    <div className="empty-icon">🔒</div>
                    <h3>Sin acceso</h3>
                    <p>Esta sección es solo para el administrador.</p>
                    <button className="btn-new" style={{ margin: '0 auto' }} onClick={() => navigate('/dashboard')}>Ir a mis partidos</button>
                </div></div>
            </div>
        );
    }

    const m = data?.metrics;

    return (
        <div style={{ minHeight: '100vh' }}>
            {topbar}

            <div className="page-wrap admin-page">
                <div className="page-header admin-header">
                    <div>
                        <h2>Panel de administración</h2>
                        <p>Uso de la app, usuarios, accesos Pro y cobros.</p>
                    </div>
                    <button className="btn-secondary" onClick={load} disabled={loading}>{loading ? 'Cargando…' : '↻ Actualizar'}</button>
                </div>

                {loadError && <div className="notice notice-error">{loadError}</div>}
                {!data && loading && <p className="account-hint">Cargando métricas…</p>}

                {m && (
                    <>
                        {/* ---------- KPIs ---------- */}
                        <div className="stats-row">
                            <div className="stat-card">
                                <div className="stat-label">Usuarios</div>
                                <div className="stat-value">{m.totalUsers}</div>
                                <div className="stat-sub">+{m.newUsers30d} en 30 días · +{m.newUsers7d} en 7</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Activos (30 días)</div>
                                <div className="stat-value">{m.activeUsers30d}</div>
                                <div className="stat-sub">entraron o registraron partidos</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Partidos</div>
                                <div className="stat-value">{m.matchesTotal}</div>
                                <div className="stat-sub">{m.matches30d} creados en 30 días</div>
                            </div>
                            <div className="stat-card accent-border">
                                <div className="stat-label">Pagando</div>
                                <div className="stat-value" style={{ color: 'var(--accent)' }}>{m.paying}</div>
                                <div className="stat-sub">~{money(m.mrr)}/mes{m.canceling ? ` · ${m.canceling} cancelando` : ''}</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Pro regalados</div>
                                <div className="stat-value">{m.granted}</div>
                                <div className="stat-sub">cuerpo técnico y colegas</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-label">Cobrado</div>
                                <div className="stat-value">{money(m.revenueTotal)}</div>
                                <div className="stat-sub">{money(m.revenue30d)} en 30 días · {m.paymentsCount} pagos</div>
                            </div>
                        </div>

                        {/* ---------- Tendencias ---------- */}
                        <div className="admin-charts">
                            <WeeklyBars title="Nuevos usuarios por semana" weeks={data.weekly} field="signups" />
                            <WeeklyBars title="Partidos creados por semana" weeks={data.weekly} field="matches" />
                        </div>

                        {/* ---------- Dar Pro ---------- */}
                        <section className="account-section" id="admin-grant">
                            <h3>Dar acceso Pro</h3>
                            <p className="account-text">Para tu cuerpo técnico o colegas. La persona debe haber creado su cuenta gratis antes; no se le cobra nada.</p>
                            <form onSubmit={handleGrant}>
                                <div className="admin-grant-grid">
                                    <div className="form-group">
                                        <label htmlFor="g-email">Correo de la cuenta</label>
                                        <input id="g-email" type="email" required className="form-input" placeholder="asistente@correo.com"
                                            value={grantEmail} onChange={e => setGrantEmail(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="g-months">Duración</label>
                                        <select id="g-months" className="form-input" value={grantMonths} onChange={e => setGrantMonths(Number(e.target.value))}>
                                            {DURATIONS.map(d => <option key={d.months} value={d.months}>{d.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="g-note">Nota (opcional)</label>
                                        <input id="g-note" className="form-input" placeholder="Asistente técnico" maxLength={80}
                                            value={grantNote} onChange={e => setGrantNote(e.target.value)} />
                                    </div>
                                </div>
                                <Notice msg={grantMsg} />
                                <button type="submit" className="btn-upgrade" disabled={granting}>{granting ? 'Activando…' : 'Dar Pro'}</button>
                            </form>
                        </section>

                        {/* ---------- Usuarios ---------- */}
                        <section className="account-section">
                            <div className="admin-section-head">
                                <h3>Usuarios <span className="admin-count">{users.length}</span></h3>
                                <input className="form-input admin-search" placeholder="Buscar por nombre o correo"
                                    value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <div className="admin-filters">
                                {FILTERS.map(f => (
                                    <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>{f.label}</button>
                                ))}
                            </div>
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead>
                                        <tr><th>Usuario</th><th>Plan</th><th>Registro</th><th>Último acceso</th><th className="num">Partidos</th><th></th></tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => {
                                            const badge = SOURCE_LABEL[u.source];
                                            return (
                                                <tr key={u.id}>
                                                    <td>
                                                        <div className="admin-user-name">{u.full_name || '—'}</div>
                                                        <div className="admin-user-email">{u.email}</div>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${badge.cls}`}>{badge.text}</span>
                                                        {u.source !== 'free' && u.source !== 'admin' && (
                                                            <div className="admin-user-email">
                                                                {u.plan === 'team' ? 'Anual' : 'Mensual'}
                                                                {u.current_period_end ? ` · hasta ${formatDate(u.current_period_end)}` : ' · sin vencimiento'}
                                                            </div>
                                                        )}
                                                        {u.admin_note && <div className="admin-user-email">“{u.admin_note}”</div>}
                                                    </td>
                                                    <td>{formatDate(u.created_at)}</td>
                                                    <td>{timeAgo(u.last_sign_in_at)}</td>
                                                    <td className="num">{u.matches_total}</td>
                                                    <td className="admin-row-action">
                                                        {u.source === 'manual' && <button className="btn-danger-link" onClick={() => setRevokeTarget(u)}>Quitar Pro</button>}
                                                        {u.source === 'free' && <button className="btn-secondary" onClick={() => prefillGrant(u.email)}>Dar Pro</button>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {users.length === 0 && <tr><td colSpan={6} className="admin-empty">Sin resultados.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* ---------- Cobros ---------- */}
                        <section className="account-section">
                            <div className="admin-section-head">
                                <h3>Cobros <span className="admin-count">{m.paymentsCount}</span></h3>
                                <button className="btn-secondary" onClick={handleSync} disabled={syncing}>{syncing ? 'Sincronizando…' : 'Sincronizar con PayPal'}</button>
                            </div>
                            <p className="account-hint">Los cobros nuevos se registran solos. Usa “Sincronizar” para importar los anteriores desde PayPal.</p>
                            <Notice msg={syncMsg} />
                            <div className="admin-table-wrap">
                                <table className="admin-table">
                                    <thead><tr><th>Fecha</th><th>Usuario</th><th>Estado</th><th className="num">Monto</th></tr></thead>
                                    <tbody>
                                        {data.payments.map(p => (
                                            <tr key={p.id}>
                                                <td>{formatDate(p.paid_at)}</td>
                                                <td>{p.email || <span className="admin-user-email">cuenta eliminada</span>}</td>
                                                <td>{p.status === 'completed' ? 'Cobrado' : p.status}</td>
                                                <td className="num">{money(p.amount)} {p.currency}</td>
                                            </tr>
                                        ))}
                                        {data.payments.length === 0 && <tr><td colSpan={4} className="admin-empty">Aún no hay cobros registrados.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}
            </div>

            {revokeTarget && (
                <div className="modal-overlay" onClick={() => !revoking && setRevokeTarget(null)}>
                    <div className="dialog-card" onClick={e => e.stopPropagation()}>
                        <div className="dialog-icon">🔓</div>
                        <h3>¿Quitar el acceso Pro?</h3>
                        <p><strong>{revokeTarget.email}</strong> pasará al plan Free. Sus partidos se conservan.</p>
                        <div className="dialog-actions">
                            <button className="btn-cancel" onClick={() => setRevokeTarget(null)} disabled={revoking}>Volver</button>
                            <button className="btn-delete" onClick={handleRevoke} disabled={revoking}>{revoking ? 'Quitando…' : 'Quitar Pro'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
