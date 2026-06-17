import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLockState, recordFailure, clearAttempts } from '../lib/loginThrottle';

export default function Login() {
    const { signIn, signInWithGoogle, user } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);
    // Segundos restantes de bloqueo por demasiados intentos fallidos (0 = sin bloqueo)
    const [lockSeconds, setLockSeconds] = useState(0);

    // Navegar cuando el user quede establecido en AuthContext
    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    // Cuenta regresiva del bloqueo: refresca el mensaje cada segundo.
    useEffect(() => {
        if (lockSeconds <= 0) return;
        const t = setInterval(() => {
            const { locked, remainingSeconds } = getLockState(email);
            setLockSeconds(locked ? remainingSeconds : 0);
        }, 1000);
        return () => clearInterval(t);
    }, [lockSeconds, email]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        // Defensa anti fuerza-bruta en el cliente (complementa el rate limit de Supabase Auth)
        const lock = getLockState(email);
        if (lock.locked) {
            setLockSeconds(lock.remainingSeconds);
            setError(`Demasiados intentos fallidos. Espera ${lock.remainingSeconds}s antes de volver a intentar.`);
            return;
        }

        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);
        if (error) {
            // Traducir los errores más comunes de Supabase al español
            if (error.message.includes('Invalid login credentials')) {
                const state = recordFailure(email);
                if (state.locked) {
                    setLockSeconds(state.remainingSeconds);
                    setError(`Demasiados intentos fallidos. Cuenta protegida temporalmente: espera ${state.remainingSeconds}s.`);
                } else {
                    setError('Correo o contraseña incorrectos. Verifica tus datos.');
                }
            } else if (error.message.includes('Email not confirmed')) {
                setError('Debes confirmar tu correo antes de iniciar sesión.');
            } else if (error.status === 429 || /rate limit/i.test(error.message)) {
                setError('Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.');
            } else {
                setError(error.message);
            }
            return;
        }
        // Login exitoso: limpiar el contador de intentos fallidos.
        clearAttempts(email);
        // El useEffect de arriba navega cuando AuthContext actualiza el user
    }

    async function handleGoogle() {
        const { error } = await signInWithGoogle();
        if (error) setError(error.message);
    }

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>🏐 Beach Volley <span className="accent">Analytics</span></h1>
                    <p>Performance Tracking · Match Analysis</p>
                </div>

                <div className="auth-title">Bienvenido de vuelta</div>
                <div className="auth-subtitle">Inicia sesión para acceder a tus partidos.</div>

                <button className="btn-google" onClick={handleGoogle}>
                    <svg width="16" height="16" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continuar con Google
                </button>

                <div className="auth-divider">o con tu correo</div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Correo electrónico</label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="tu@correo.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(220,38,38,0.08)', border: '1px solid var(--c-dn)',
                            borderRadius: 'var(--radius)', padding: '0.65rem 0.9rem',
                            color: 'var(--c-dn)', fontSize: '0.82rem', marginBottom: '0.75rem',
                        }}>
                            {error}
                        </div>
                    )}

                    <button className="btn-auth" type="submit" disabled={loading || lockSeconds > 0}>
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                                Iniciando sesión...
                            </span>
                        ) : lockSeconds > 0 ? `Bloqueado (${lockSeconds}s)` : 'Iniciar sesión'}
                    </button>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </form>

                <div className="auth-switch">
                    ¿No tienes cuenta? <Link to="/signup">Crear cuenta gratis</Link>
                </div>
                <div className="auth-switch" style={{ marginTop: '0.5rem' }}>
                    <Link to="/forgot-password" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        ¿Olvidaste tu contraseña?
                    </Link>
                </div>
                <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    <Link to="/terms" style={{ color: 'var(--text-muted)' }}>Términos</Link>
                    {' · '}
                    <Link to="/privacy" style={{ color: 'var(--text-muted)' }}>Privacidad</Link>
                </div>
            </div>
        </div>
    );
}
