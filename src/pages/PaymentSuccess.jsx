import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 2000;   // verificar cada 2 segundos
const MAX_WAIT_MS      = 30000;  // esperar máximo 30 segundos

export default function PaymentSuccess() {
    const navigate                     = useNavigate();
    const { refreshSubscription }      = useAuth();
    const [status, setStatus]          = useState('waiting'); // 'waiting' | 'confirmed' | 'timeout'
    const [secondsLeft, setSecondsLeft] = useState(Math.floor(MAX_WAIT_MS / 1000));
    const startRef                     = useRef(Date.now());

    useEffect(() => {
        let pollTimer;
        let countdownTimer;

        async function checkSubscription() {
            const data = await refreshSubscription();
            const isPaid = (data?.plan === 'pro' || data?.plan === 'team') && data?.status === 'active';

            if (isPaid) {
                setStatus('confirmed');
                clearInterval(pollTimer);
                clearInterval(countdownTimer);
                setTimeout(() => navigate('/dashboard'), 2500);
                return;
            }

            if (Date.now() - startRef.current >= MAX_WAIT_MS) {
                setStatus('timeout');
                clearInterval(pollTimer);
                clearInterval(countdownTimer);
                setTimeout(() => navigate('/dashboard'), 4000);
            }
        }

        // Iniciar polling inmediatamente y luego cada POLL_INTERVAL_MS
        checkSubscription();
        pollTimer = setInterval(checkSubscription, POLL_INTERVAL_MS);

        // Countdown visual
        countdownTimer = setInterval(() => {
            setSecondsLeft(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => {
            clearInterval(pollTimer);
            clearInterval(countdownTimer);
        };
    }, [navigate, refreshSubscription]);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>

                {status === 'waiting' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>⏳</div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
                            Confirmando tu pago…
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.7 }}>
                            Estamos verificando con Stripe. Tarda unos segundos.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: 'var(--accent)',
                                    animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
                                }} />
                            ))}
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            Tiempo máximo de espera: {secondsLeft}s
                        </p>
                    </>
                )}

                {status === 'confirmed' && (
                    <>
                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎉</div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
                            ¡Suscripción activada!
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.7 }}>
                            Ya tienes acceso a partidos ilimitados y exportación de PDF.
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
                            Redirigiendo automáticamente…
                        </p>
                    </>
                )}

                {status === 'timeout' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>⚠️</div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
                            El pago fue recibido
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.7 }}>
                            La confirmación está tardando más de lo normal. Tu plan se actualizará en los próximos minutos automáticamente. Prueba a recargar el dashboard.
                        </p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            style={{ padding: '0.85rem 2.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}
                        >
                            Ir al dashboard
                        </button>
                    </>
                )}

            </div>

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
                    40%           { transform: scale(1);   opacity: 1;   }
                }
            `}</style>
        </div>
    );
}
