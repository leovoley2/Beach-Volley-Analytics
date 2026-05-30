import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PLANS = [
    {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: '',
        desc: 'Para probar la plataforma.',
        features: [
            { ok: true,  text: '5 partidos por mes' },
            { ok: true,  text: 'Tracker completo' },
            { ok: true,  text: 'Mapa de cancha con trayectorias' },
            { ok: false, text: 'Exportar PDF' },
            { ok: false, text: 'Historial ilimitado' },
            { ok: false, text: 'Múltiples usuarios' },
        ],
        cta: 'Tu plan actual',
        featured: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$9',
        period: '/ mes',
        desc: 'Para entrenadores y analistas activos.',
        features: [
            { ok: true, text: 'Partidos ilimitados' },
            { ok: true, text: 'Tracker completo' },
            { ok: true, text: 'Mapa de cancha con trayectorias' },
            { ok: true, text: 'Exportar PDF' },
            { ok: true, text: 'Historial ilimitado' },
            { ok: false, text: 'Múltiples usuarios' },
        ],
        cta: 'Empezar Pro',
        featured: true,
    },
    {
        id: 'team',
        name: 'Team',
        price: '$29',
        period: '/ mes',
        desc: 'Para clubs y academias.',
        features: [
            { ok: true, text: 'Todo lo de Pro' },
            { ok: true, text: 'Hasta 5 usuarios' },
            { ok: true, text: 'Dashboard compartido' },
            { ok: true, text: 'Exportar PDF' },
            { ok: true, text: 'Historial ilimitado' },
            { ok: true, text: 'Soporte prioritario' },
        ],
        cta: 'Empezar Team',
        featured: false,
    },
];

export default function Pricing() {
    const { user, subscription, isPaid, signOut } = useAuth();
    const navigate = useNavigate();
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [error, setError] = useState('');

    const currentPlan = subscription?.plan || 'free';
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
    const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

    async function handleUpgrade(planId) {
        if (planId === 'free' || planId === currentPlan) return;
        setLoadingPlan(planId);
        setError('');

        try {
            const res = await fetch('/.netlify/functions/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan:      planId,
                    userId:    user.id,
                    userEmail: user.email,
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url; // Redirige a Stripe Checkout
            } else {
                setError(data.error || 'Error al crear la sesión de pago.');
            }
        } catch (err) {
            setError('Error de conexión. Intenta de nuevo.');
        }
        setLoadingPlan(null);
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Topbar */}
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button onClick={() => navigate('/dashboard')}>Mis partidos</button>
                </div>
                <div className="topbar-right">
                    <span className="plan-chip">{currentPlan.toUpperCase()}</span>
                    <div className="avatar">{initials}</div>
                    <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>Salir</button>
                </div>
            </div>

            <div className="page-wrap" style={{ maxWidth: 1000 }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: '0.75rem' }}>Planes</div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>Simple y transparente</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Cancela cuando quieras. Sin permanencia.</p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid var(--c-dn)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: 'var(--c-dn)', fontSize: '0.85rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {PLANS.map(plan => {
                        const isCurrentPlan = currentPlan === plan.id;
                        const isLoading     = loadingPlan === plan.id;

                        return (
                            <div key={plan.id} style={{
                                background: 'var(--bg-card)',
                                border: `1px solid ${plan.featured ? 'var(--accent)' : 'var(--border)'}`,
                                borderRadius: 'var(--radius-lg)',
                                padding: '2rem',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: plan.featured ? '0 0 0 1px var(--accent), 0 8px 32px rgba(249,115,22,0.15)' : 'none',
                                position: 'relative',
                            }}>
                                {plan.featured && (
                                    <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.75rem', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                                        Más popular
                                    </div>
                                )}

                                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    {plan.name}
                                    {isCurrentPlan && <span style={{ marginLeft: '0.5rem', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '0.65rem', padding: '0.1rem 0.5rem', borderRadius: '50px' }}>Actual</span>}
                                </div>

                                <div style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.25rem' }}>
                                    {plan.price} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{plan.period}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{plan.desc}</div>

                                <ul style={{ listStyle: 'none', flex: 1, marginBottom: '1.5rem' }}>
                                    {plan.features.map((f, i) => (
                                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.85rem', color: f.ok ? 'var(--text-secondary)' : 'var(--text-muted)', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ color: f.ok ? 'var(--c-pos)' : 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>{f.ok ? '✓' : '–'}</span>
                                            {f.text}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => handleUpgrade(plan.id)}
                                    disabled={isCurrentPlan || isLoading || plan.id === 'free'}
                                    style={{
                                        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)',
                                        fontFamily: 'var(--font)', fontSize: '0.9rem', fontWeight: 700,
                                        cursor: (isCurrentPlan || plan.id === 'free') ? 'default' : 'pointer',
                                        transition: 'var(--trans)', border: 'none',
                                        background: isCurrentPlan
                                            ? 'var(--bg-hover)'
                                            : plan.featured
                                                ? 'var(--accent)'
                                                : 'transparent',
                                        color: isCurrentPlan ? 'var(--text-muted)' : plan.featured ? 'white' : 'var(--text-secondary)',
                                        border: (!plan.featured && !isCurrentPlan) ? '1.5px solid var(--border)' : 'none',
                                        opacity: isLoading ? 0.7 : 1,
                                        boxShadow: plan.featured && !isCurrentPlan ? '0 2px 12px rgba(249,115,22,0.3)' : 'none',
                                    }}
                                >
                                    {isLoading ? 'Redirigiendo a Stripe...' : isCurrentPlan ? 'Plan actual' : plan.cta}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Badge Stripe */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6772e5" strokeWidth="2"/></svg>
                    Pagos seguros procesados por <strong style={{ color: '#6772e5' }}>Stripe</strong> · SSL 256-bit · Cancela en cualquier momento
                </div>
            </div>
        </div>
    );
}
