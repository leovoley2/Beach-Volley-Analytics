import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccountMenu from '../components/AccountMenu';
import Notice from '../components/Notice';
import { formatDate, postApi } from '../lib/accountApi';
import { LEGAL } from '../lib/legalConfig';

const PLAN_INFO = {
    free: { name: 'Free',      price: 'Gratis',     detail: '2 partidos por mes, sin PDF' },
    pro:  { name: 'Pro',       price: '$10 / mes',  detail: 'Partidos ilimitados y PDF' },
    team: { name: 'Pro Anual', price: '$100 / año', detail: 'Partidos ilimitados y PDF' },
};
const PAYPAL_AUTOPAY_URL = 'https://www.paypal.com/myaccount/autopay/';

/** Suscripción y pagos: estado del plan, renovación y cancelación. */
export default function Subscription() {
    const { session, subscription, isPaid, isCanceling, setSubscription, refreshSubscription } = useAuth();
    const navigate = useNavigate();
    const [showCancel, setShowCancel] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const [subMsg, setSubMsg] = useState(null);

    // Datos frescos al entrar (p. ej. tras un webhook reciente).
    useEffect(() => { refreshSubscription(); }, [refreshSubscription]);

    async function handleCancelSubscription() {
        if (!session?.access_token) { setSubMsg({ ok: false, text: 'Sesión expirada. Vuelve a iniciar sesión.' }); return; }
        setCanceling(true);
        setSubMsg(null);
        try {
            const data = await postApi('/api/cancel-subscription', session.access_token);
            if (data.subscription) setSubscription(data.subscription);
            else await refreshSubscription();
            setSubMsg({ ok: true, text: 'Suscripción cancelada. No se te volverá a cobrar.' });
        } catch (err) {
            setSubMsg({ ok: false, text: err.message });
        }
        setShowCancel(false);
        setCanceling(false);
    }

    const planKey   = isPaid ? subscription?.plan : 'free';
    const plan      = PLAN_INFO[planKey] || PLAN_INFO.free;
    const periodEnd = formatDate(subscription?.current_period_end);
    const hasPayPal = !!subscription?.paypal_subscription_id;
    const isPaused  = subscription?.status === 'paused' && ['pro', 'team'].includes(subscription?.plan);
    const canCancel = isPaid && !isCanceling && hasPayPal && subscription?.status === 'active';

    let statusBadge = { text: 'Activa', cls: 'ok' };
    if (isCanceling) statusBadge = { text: 'Cancelada', cls: 'warn' };
    else if (isPaused) statusBadge = { text: 'Suspendida', cls: 'error' };

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
                    <h2>Suscripción y pagos</h2>
                    <p>Consulta tu plan, la próxima renovación o cancela cuando quieras.</p>
                </div>

                <section className="account-section">
                    <h3>Tu plan</h3>
                    <div className="plan-summary">
                        <div>
                            <div className="plan-summary-name">
                                Plan {plan.name}
                                {(planKey !== 'free' || isPaused) && <span className={`status-badge ${statusBadge.cls}`}>{statusBadge.text}</span>}
                            </div>
                            <div className="account-hint">{plan.price} · {plan.detail}</div>
                        </div>
                    </div>

                    {isPaid && !isCanceling && hasPayPal && periodEnd && (
                        <p className="account-text">Próxima renovación: <strong>{periodEnd}</strong>. Se cobra automáticamente con PayPal.</p>
                    )}
                    {isPaid && !hasPayPal && (
                        <p className="account-text">Tu plan se gestiona manualmente. Para cualquier cambio escríbenos a {' '}
                            <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.</p>
                    )}
                    {isCanceling && (
                        <p className="account-text">Cancelaste la renovación. Conservas el acceso Pro hasta el <strong>{periodEnd}</strong>; después tu cuenta pasa al plan Free. Tus partidos no se borran.</p>
                    )}
                    {isPaused && (
                        <p className="account-text">PayPal suspendió tu suscripción, normalmente por un problema con el cobro. Revisa tu método de pago en PayPal.</p>
                    )}
                    {!isPaid && !isPaused && (
                        <p className="account-text">Con Pro tienes partidos ilimitados y puedes exportar tus informes en PDF.</p>
                    )}

                    <Notice msg={subMsg} />

                    <div className="account-actions">
                        {!isPaid && <button className="btn-upgrade" onClick={() => navigate('/pricing')}>Mejorar a Pro</button>}
                        {isCanceling && <button className="btn-upgrade" onClick={() => navigate('/pricing')}>Volver a suscribirme</button>}
                        {canCancel && <button className="btn-secondary" onClick={() => navigate('/pricing')}>Cambiar de plan</button>}
                        {(hasPayPal || isPaused) && (
                            <a className="btn-secondary" href={PAYPAL_AUTOPAY_URL} target="_blank" rel="noopener noreferrer">Ver pagos en PayPal ↗</a>
                        )}
                        {canCancel && <button className="btn-danger-link" onClick={() => setShowCancel(true)}>Cancelar suscripción</button>}
                    </div>
                </section>

                <p className="account-hint" style={{ textAlign: 'center' }}>
                    Los pagos los procesa PayPal; no guardamos los datos de tu tarjeta. Al cancelar conservas el acceso
                    hasta el final del periodo pagado. Los pagos realizados no son reembolsables salvo que la ley lo exija.
                </p>
            </div>

            {showCancel && (
                <div className="modal-overlay" onClick={() => !canceling && setShowCancel(false)}>
                    <div className="dialog-card" onClick={e => e.stopPropagation()}>
                        <div className="dialog-icon">💳</div>
                        <h3>¿Cancelar tu suscripción?</h3>
                        <p>
                            No se te volverá a cobrar. Seguirás teniendo Pro hasta el <strong>{periodEnd || 'final del periodo pagado'}</strong> y
                            después tu cuenta pasará al plan Free (2 partidos al mes, sin PDF). Tus partidos se conservan.
                        </p>
                        <div className="dialog-actions">
                            <button className="btn-cancel" onClick={() => setShowCancel(false)} disabled={canceling}>Mantener mi plan</button>
                            <button className="btn-delete" onClick={handleCancelSubscription} disabled={canceling}>
                                {canceling ? 'Cancelando…' : 'Sí, cancelar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
