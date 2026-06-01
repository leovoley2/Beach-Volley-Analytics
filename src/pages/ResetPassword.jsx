import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword]   = useState('');
    const [confirm, setConfirm]     = useState('');
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [ready, setReady]         = useState(false);

    // Supabase envía el token como hash en la URL. Al cargarse la página,
    // el cliente de Supabase lo procesa automáticamente vía onAuthStateChange.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setReady(true);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);

        if (error) setError(error.message);
        else {
            // Contraseña cambiada — ir al dashboard
            navigate('/dashboard');
        }
    }

    if (!ready) {
        return (
            <div className="auth-wrap">
                <div className="auth-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔐</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Verificando enlace de recuperación...
                    </p>
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

                <div className="auth-title">Nueva contraseña</div>
                <div className="auth-subtitle">Elige una contraseña segura para tu cuenta.</div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nueva contraseña</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="Mínimo 8 caracteres"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirmar contraseña</label>
                        <input
                            className="form-input"
                            type="password"
                            placeholder="Repite la contraseña"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            required
                        />
                    </div>
                    {error && (
                        <p style={{ color: 'var(--c-dn)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                            {error}
                        </p>
                    )}
                    <button className="btn-auth" type="submit" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
}
