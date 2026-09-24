import { getPayPalAccessToken, supabaseAdmin, PAYPAL_BASE } from './_paypal.js';
import { requireUser } from './_auth.js';

/**
 * Elimina la cuenta del usuario autenticado y todos sus datos (derecho de
 * supresión, ver Privacidad). Pasos:
 *   1. Si tiene una suscripción PayPal activa, la cancela. Si PayPal falla,
 *      NO se borra la cuenta: no queremos un usuario borrado al que se le siga cobrando.
 *   2. Borra filas sin ON DELETE CASCADE (athletes/payments, tablas legacy).
 *   3. Borra el usuario de auth → matches, profiles y subscriptions caen en cascada.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const user = await requireUser(req, res, { bucket: 'delete_account', limit: 3 });
    if (!user) return;

    // Confirmación explícita escrita por el usuario (evita borrados por error).
    if (req.body?.confirm !== 'ELIMINAR') {
        return res.status(400).json({ error: 'Confirmación inválida.' });
    }

    try {
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('status, paypal_subscription_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (sub?.paypal_subscription_id && sub.status === 'active') {
            const accessToken = await getPayPalAccessToken();
            const cancelRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${sub.paypal_subscription_id}/cancel`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                body:    JSON.stringify({ reason: 'Cuenta eliminada por el usuario' }),
            });
            if (!cancelRes.ok && cancelRes.status !== 422) {
                console.error('delete-account: PayPal cancel error', cancelRes.status, await cancelRes.text());
                return res.status(502).json({ error: 'No pudimos cancelar tu suscripción en PayPal, así que no se eliminó la cuenta. Inténtalo de nuevo o escríbenos a soporte.' });
            }
        }

        // Tablas legacy sin cascade: bloquearían el borrado del usuario.
        await supabaseAdmin.from('payments').delete().eq('created_by', user.id);
        await supabaseAdmin.from('athletes').delete().eq('created_by', user.id);

        const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (delError) {
            console.error('delete-account: deleteUser error', delError);
            return res.status(500).json({ error: 'No se pudo eliminar la cuenta. Escríbenos a soporte.' });
        }

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('delete-account error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
