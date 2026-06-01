import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
    const [email, setEmail]     = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent]       = useState(false);
    const [error, setError]     = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        setLoading(false);
        if (error) setError(error.message);
        else setSent(true);
    }

    if (sent) {
        return (
            <div className="auth-wrap">
                <div className="auth-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Revisa tu correo
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                        Enviamos un enlace para restablecer tu contraseña a <strong>{email}</strong>.
                        Puede tardar unos minutos.
                    </p>
                    <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.88rem' }}>
                        ← Volver al inicio de sesión
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <div className="auth-logo">
                    <h1>🏐 Beach Volley <span className="accent">Analytics</span></h1>
                    <p>Performance Tracking · Match Analysis</p>
                </div>

                <div className="auth-title">Restablecer contraseña</div>
                <div className="auth-subtitle">
                    Ingresa tu correo y te enviamos un enlace para crear una nueva contraseña.
                </div>

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
                            autoFocus
                        />
                    </div>
                    {error && (
                        <p style={{ color: 'var(--c-dn)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                            {error}
                        </p>
                    )}
                    <button className="btn-auth" type="submit" disabled={loading}>
                        {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                    </button>
                </form>

                <div className="auth-switch" style={{ marginTop: '1.25rem' }}>
                    <Link to="/login">← Volver al inicio de sesión</Link>
                </div>
            </div>
        </div>
    );
}
