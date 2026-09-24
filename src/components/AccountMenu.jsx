import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Chip del plan + avatar que abre el menú de cuenta (topbar de las páginas privadas).
 * Se cierra al hacer clic fuera, con Escape o al elegir una opción.
 */
export default function AccountMenu() {
    const { user, subscription, isPaid, isCanceling, isAdmin, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!open) return;
        const onPointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('touchstart', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('touchstart', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario';
    const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    const planLabel   = isPaid ? (subscription?.plan === 'team' ? 'PRO ANUAL' : 'PRO') : 'FREE';

    function go(path) {
        setOpen(false);
        navigate(path);
    }

    return (
        <div className="account-menu" ref={ref}>
            <span className="plan-chip">{planLabel}</span>
            <button
                type="button"
                className="account-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Menú de cuenta"
                onClick={() => setOpen(o => !o)}
            >
                <span className="avatar">{initials}</span>
                <span className={`account-caret${open ? ' open' : ''}`}>▾</span>
            </button>

            {open && (
                <div className="account-dropdown" role="menu">
                    <div className="account-dropdown-header">
                        <div className="avatar avatar-lg">{initials}</div>
                        <div style={{ minWidth: 0 }}>
                            <div className="account-name">{displayName}</div>
                            <div className="account-email">{user?.email}</div>
                            {isCanceling && <div className="account-note">Cancelada · sin renovación</div>}
                        </div>
                    </div>

                    {isAdmin && (
                        <button type="button" role="menuitem" className="highlight" onClick={() => go('/admin')}>
                            <span>🛠</span> Panel de administración
                        </button>
                    )}
                    <button type="button" role="menuitem" onClick={() => go('/account')}>
                        <span>👤</span> Mi cuenta
                    </button>
                    <button type="button" role="menuitem" onClick={() => go('/subscription')}>
                        <span>💳</span> Suscripción y pagos
                    </button>
                    {!isPaid && (
                        <button type="button" role="menuitem" className="highlight" onClick={() => go('/pricing')}>
                            <span>⭐</span> Mejorar a Pro
                        </button>
                    )}
                    <button type="button" role="menuitem" onClick={() => go('/support')}>
                        <span>💬</span> Soporte
                    </button>

                    <div className="account-divider" />

                    <button type="button" role="menuitem" onClick={() => { setOpen(false); signOut(); }}>
                        <span>↩</span> Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}
