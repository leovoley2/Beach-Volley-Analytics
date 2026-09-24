import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccountMenu from '../components/AccountMenu';
import Notice from '../components/Notice';
import { formatDate, postApi } from '../lib/accountApi';

/** Mi cuenta: perfil, seguridad y eliminación de la cuenta. */
export default function Account() {
    const { user, session, subscription, updateDisplayName, updatePassword, signOut } = useAuth();
    const navigate = useNavigate();

    // ---- Perfil ----
    const currentName = user?.user_metadata?.full_name || '';
    const [name, setName] = useState(currentName);
    const [savingName, setSavingName] = useState(false);
    const [nameMsg, setNameMsg] = useState(null);

    // ---- Contraseña ----
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [savingPw, setSavingPw] = useState(false);
    const [pwMsg, setPwMsg] = useState(null);

    // ---- Eliminar cuenta ----
    const [showDelete, setShowDelete] = useState(false);
    const [deleteText, setDeleteText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const memberSince = formatDate(user?.created_at);
    const hasActivePayPal = subscription?.status === 'active' && !!subscription?.paypal_subscription_id;

    async function handleSaveName(e) {
        e.preventDefault();
        const trimmed = name.trim().replace(/\s+/g, ' ');
        if (trimmed.length < 2 || trimmed.length > 60) {
            setNameMsg({ ok: false, text: 'El nombre debe tener entre 2 y 60 caracteres.' });
            return;
        }
        setSavingName(true);
        setNameMsg(null);
        try {
            const { error } = await updateDisplayName(trimmed);
            if (error) throw error;
            setName(trimmed);
            setNameMsg({ ok: true, text: 'Nombre actualizado.' });
        } catch (err) {
            setNameMsg({ ok: false, text: err.message || 'No se pudo guardar el nombre.' });
        }
        setSavingName(false);
    }

    async function handleSavePassword(e) {
        e.preventDefault();
        if (password.length < 8) { setPwMsg({ ok: false, text: 'La contraseña debe tener al menos 8 caracteres.' }); return; }
        if (password !== confirm) { setPwMsg({ ok: false, text: 'Las contraseñas no coinciden.' }); return; }
        setSavingPw(true);
        setPwMsg(null);
        try {
            const { error } = await updatePassword(password);
            if (error) throw error;
            setPassword('');
            setConfirm('');
            setPwMsg({ ok: true, text: 'Contraseña actualizada.' });
        } catch (err) {
            const text = /different from the old/i.test(err.message || '')
                ? 'La nueva contraseña debe ser distinta de la actual.'
                : (err.message || 'No se pudo cambiar la contraseña.');
            setPwMsg({ ok: false, text });
        }
        setSavingPw(false);
    }

    async function handleDeleteAccount() {
        if (!session?.access_token) { setDeleteError('Sesión expirada. Vuelve a iniciar sesión.'); return; }
        setDeleting(true);
        setDeleteError('');
        try {
            await postApi('/api/delete-account', session.access_token, { confirm: deleteText });
            await signOut(); // limpia la sesión local y vuelve a la landing
        } catch (err) {
            setDeleteError(err.message);
            setDeleting(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button onClick={() => navigate('/dashboard')}>Mis partidos</button>
                </div>
                <div className="topbar-right">
                    <AccountMenu />
                </div>
            </div>

            <div className="page-wrap account-page">
                <div className="page-header">
                    <h2>Mi cuenta</h2>
                    <p>Gestiona tu perfil y la seguridad de tu cuenta.</p>
                </div>

                {/* ---------- Perfil ---------- */}
                <section className="account-section">
                    <h3>Perfil</h3>
                    <form onSubmit={handleSaveName}>
                        <div className="form-group">
                            <label htmlFor="acc-name">Nombre</label>
                            <input id="acc-name" className="form-input" value={name} maxLength={60}
                                onChange={e => setName(e.target.value)} autoComplete="name" />
                        </div>
                        <div className="form-group">
                            <label>Correo electrónico</label>
                            <input className="form-input" value={user?.email || ''} disabled />
                        </div>
                        {memberSince && <p className="account-hint">Miembro desde el {memberSince}.</p>}
                        <Notice msg={nameMsg} />
                        <button type="submit" className="btn-upgrade"
                            disabled={savingName || name.trim() === currentName}>
                            {savingName ? 'Guardando…' : 'Guardar nombre'}
                        </button>
                    </form>
                </section>

                {/* ---------- Seguridad ---------- */}
                <section className="account-section">
                    <h3>Seguridad</h3>
                    <form onSubmit={handleSavePassword}>
                        <div className="account-grid">
                            <div className="form-group">
                                <label htmlFor="acc-pw">Nueva contraseña</label>
                                <input id="acc-pw" type="password" className="form-input" placeholder="Mínimo 8 caracteres"
                                    value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="acc-pw2">Repite la contraseña</label>
                                <input id="acc-pw2" type="password" className="form-input"
                                    value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
                            </div>
                        </div>
                        <Notice msg={pwMsg} />
                        <button type="submit" className="btn-upgrade" disabled={savingPw || !password}>
                            {savingPw ? 'Guardando…' : 'Cambiar contraseña'}
                        </button>
                    </form>
                </section>

                {/* ---------- Eliminar cuenta ---------- */}
                <section className="account-section danger-zone">
                    <h3>Eliminar cuenta</h3>
                    <p className="account-text">
                        Se borrarán de forma permanente tu cuenta y todos tus partidos e informes.
                        {hasActivePayPal && ' Tu suscripción de PayPal se cancelará automáticamente.'} Esta acción no se puede deshacer.
                    </p>
                    <button className="btn-delete" style={{ flex: 'none', padding: '0.55rem 1.1rem' }}
                        onClick={() => { setShowDelete(true); setDeleteText(''); setDeleteError(''); }}>
                        Eliminar mi cuenta
                    </button>
                </section>
            </div>

            {showDelete && (
                <div className="modal-overlay" onClick={() => !deleting && setShowDelete(false)}>
                    <div className="dialog-card" onClick={e => e.stopPropagation()}>
                        <div className="dialog-icon">⚠️</div>
                        <h3>Eliminar cuenta definitivamente</h3>
                        <p>Se borrarán tu cuenta y todos tus partidos. Escribe <strong>ELIMINAR</strong> para confirmar.</p>
                        <input className="form-input" value={deleteText} onChange={e => setDeleteText(e.target.value)}
                            placeholder="ELIMINAR" autoFocus style={{ marginBottom: '1rem', textAlign: 'center' }} />
                        {deleteError && <div className="notice notice-error">{deleteError}</div>}
                        <div className="dialog-actions">
                            <button className="btn-cancel" onClick={() => setShowDelete(false)} disabled={deleting}>Volver</button>
                            <button className="btn-delete" onClick={handleDeleteAccount}
                                disabled={deleting || deleteText !== 'ELIMINAR'}>
                                {deleting ? 'Eliminando…' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
