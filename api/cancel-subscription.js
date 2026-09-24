import { getPayPalAccessToken, supabaseAdmin, PAYPAL_BASE } from './_paypal.js';
import { requireUser } from './_auth.js';

/**
 * Cancela la suscripción PayPal del usuario autenticado.
 * No hay más cobros, pero el acceso de pago sigue hasta current_period_end
 * (ver is_paid_user() y el caso CANCELLED del webhook).
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const user = await requireUser(req, res, { bucket: 'cancel_subscription', limit: 5 });
    if (!user) return;

    try {
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('plan, status, paypal_subscription_id, current_period_end')
            .eq('user_id', user.id)
            .maybeSingle();

        const subId = sub?.paypal_subscription_id;
        if (!subId || !['pro', 'team'].includes(sub.plan) || sub.status !== 'active') {
            return res.status(400).json({ error: 'No tienes una suscripción activa para cancelar.' });
        }

        const accessToken = await getPayPalAccessToken();

        // Antes de cancelar, leer hasta cuándo está pagado: tras la cancelación
        // PayPal deja de informar next_billing_time.
        let periodEnd = sub.current_period_end;
        const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (subRes.ok) {
            const ppSub = await subRes.json();
            periodEnd = ppSub.billing_info?.next_billing_time ?? periodEnd;
        }

        const cancelRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subId}/cancel`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body:    JSON.stringify({ reason: 'Cancelada por el usuario desde la app' }),
        });
        // 204 = cancelada; 422 = ya no estaba activa en PayPal (idempotente).
        if (!cancelRes.ok && cancelRes.status !== 422) {
            console.error('PayPal cancel error:', cancelRes.status, await cancelRes.text());
            return res.status(502).json({ error: 'PayPal no pudo cancelar la suscripción. Inténtalo de nuevo o escríbenos a soporte.' });
        }

        // Reflejarlo ya en la BD (el webhook CANCELLED llegará después y es idempotente).
        const { data: updated, error: dbError } = await supabaseAdmin
            .from('subscriptions')
            .update({
                status:             'canceled',
                current_period_end: periodEnd,
                updated_at:         new Date().toISOString(),
            })
            .eq('user_id', user.id)
            .eq('paypal_subscription_id', subId)
            .select('*')
            .maybeSingle();
        if (dbError) console.error('cancel-subscription: error actualizando BD', dbError);

        return res.status(200).json({ ok: true, subscription: updated ?? null });

    } catch (err) {
        console.error('cancel-subscription error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
