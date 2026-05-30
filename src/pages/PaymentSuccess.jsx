import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PaymentSuccess() {
    const navigate      = useNavigate();
    const [params]      = useSearchParams();
    const { subscription } = useAuth();
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(timer); navigate('/dashboard'); }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [navigate]);

    const plan = subscription?.plan || 'pro';

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎉</div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
                    ¡Bienvenido al plan <span style={{ color: 'var(--accent)' }}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</span>!
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.7 }}>
                    Tu suscripción está activa. Ya tienes acceso a partidos ilimitados y exportación de PDF.
                </p>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {['Partidos ilimitados', 'Exportar informe en PDF', 'Historial completo', 'Mapa de cancha con trayectorias'].map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--c-pos)', fontWeight: 700 }}>✓</span> {f}
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => navigate('/dashboard')}
                    style={{ padding: '0.85rem 2.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', boxShadow: '0 4px 24px rgba(249,115,22,0.35)' }}
                >
                    Ir a mis partidos
                </button>

                <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Redirigiendo automáticamente en {countdown}s...
                </p>
            </div>
        </div>
    );
}
