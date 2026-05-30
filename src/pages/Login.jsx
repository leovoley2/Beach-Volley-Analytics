import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { signIn, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);
        if (error) setError(error.message);
        else navigate('/dashboard');
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
                        <input className="form-input" type="email" placeholder="tu@correo.com"
                            value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input className="form-input" type="password" placeholder="••••••••"
                            value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    {error && <p style={{ color: 'var(--c-dn)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}
                    <button className="btn-auth" type="submit" disabled={loading}>
                        {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </button>
                </form>

                <div className="auth-switch">
                    ¿No tienes cuenta? <Link to="/signup">Crear cuenta gratis</Link>
                </div>
            </div>
        </div>
    );
}
