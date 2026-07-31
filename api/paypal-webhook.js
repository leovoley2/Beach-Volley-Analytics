import { getPayPalAccessToken, supabaseAdmin, PAYPAL_BASE } from './_paypal.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // FAIL-CLOSED: sin webhook id configurado NO podemos verificar la firma,
    // así que rechazamos en vez de procesar eventos no confiables.
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.error('PAYPAL_WEBHOOK_ID no configurado — webhook rechazado');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    try {
        const event = req.body;

        // Verificar la firma del webhook contra la API de PayPal.
        const accessToken = await getPayPalAccessToken();
        const verifyRes   = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
                auth_algo:         req.headers['paypal-auth-algo'],
                cert_url:          req.headers['paypal-cert-url'],
                transmission_id:   req.headers['paypal-transmission-id'],
                transmission_sig:  req.headers['paypal-transmission-sig'],
                transmission_time: req.headers['paypal-transmission-time'],
                webhook_id:        webhookId,
                webhook_event:     event,
            }),
        });
        const verify = await verifyRes.json();
        if (!verifyRes.ok || verify.verification_status !== 'SUCCESS') {
            console.error('PayPal webhook: firma inválida', verify?.verification_status);
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const type           = event.event_type;
        const resource        = event.resource || {};
        const subscriptionId  = resource.id;
        const [userId, plan]  = (resource.custom_id ?? '').split('|');

        switch (type) {
            // Suscripción activada (primer cobro aprobado) o reactivada.
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
            case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
                // Sin nuestra referencia no sabemos a quién pertenece — ignorar.
                if (!userId || !plan || !subscriptionId) {
                    return res.status(200).json({ received: true });
                }

                // Anti doble cobro: si el usuario ya tenía OTRA suscripción PayPal
                // (p. ej. cambió de mensual a anual), la cancelamos antes de sobrescribir
                // para que PayPal no le cobre las dos. La cancelación es idempotente:
                // 422 = ya estaba inactiva → lo ignoramos.
                // Ojo: el evento CANCELLED que dispara esta cancelación llegará después,
                // pero para entonces la fila ya apunta al nuevo id, así que su
                // .eq(paypal_subscription_id, viejo_id) no coincide y no degrada al usuario.
                const { data: prev } = await supabaseAdmin
                    .from('subscriptions')
                    .select('paypal_subscription_id')
                    .eq('user_id', userId)
                    .maybeSingle();
                const prevId = prev?.paypal_subscription_id;
                if (prevId && prevId !== subscriptionId) {
                    try {
                        const cancelRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${prevId}/cancel`, {
                            method:  'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                            body:    JSON.stringify({ reason: 'Reemplazada por un nuevo plan' }),
                        });
                        if (!cancelRes.ok && cancelRes.status !== 422) {
                            console.error('No se pudo cancelar la suscripción previa', prevId, cancelRes.status);
                        }
                    } catch (e) {
                        console.error('Error cancelando suscripción previa', prevId, e);
                    }
                }

                await supabaseAdmin.from('subscriptions').upsert({
                    user_id:                userId,
                    plan,
                    status:                 'active',
                    provider:               'paypal',
                    paypal_subscription_id: subscriptionId,
                    current_period_end:     resource.billing_info?.next_billing_time ?? null,
                    updated_at:             new Date().toISOString(),
                }, { onConflict: 'user_id' });
                break;
            }

            // Cancelada o expirada → volver a Free.
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.EXPIRED': {
                if (!subscriptionId) return res.status(200).json({ received: true });
                await supabaseAdmin.from('subscriptions').update({
                    plan:       'free',
                    status:     'canceled',
                    updated_at: new Date().toISOString(),
                }).eq('paypal_subscription_id', subscriptionId);
                break;
            }

            // Suspendida (p. ej. fallo de cobro) → pausada, sin perder el vínculo.
            case 'BILLING.SUBSCRIPTION.SUSPENDED': {
                if (!subscriptionId) return res.status(200).json({ received: true });
                await supabaseAdmin.from('subscriptions').update({
                    status:     'paused',
                    updated_at: new Date().toISOString(),
                }).eq('paypal_subscription_id', subscriptionId);
                break;
            }

            // Cobro (primer pago o renovación) → reafirmar activo y refrescar la
            // fecha de próxima renovación. En ventas el id de la suscripción viene
            // en billing_agreement_id, no en resource.id.
            case 'PAYMENT.SALE.COMPLETED': {
                const subId = resource.billing_agreement_id;
                if (subId) {
                    // Consultar la suscripción para obtener el nuevo next_billing_time
                    // (el evento de venta no lo trae).
                    let nextBilling = null;
                    try {
                        const token2 = await getPayPalAccessToken();
                        const subRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subId}`, {
                            headers: { Authorization: `Bearer ${token2}` },
                        });
                        if (subRes.ok) {
                            const sub = await subRes.json();
                            nextBilling = sub.billing_info?.next_billing_time ?? null;
                        }
                    } catch (e) {
                        console.error('PAYMENT.SALE.COMPLETED: no se pudo leer la suscripción', e);
                    }

                    const patch = { status: 'active', updated_at: new Date().toISOString() };
                    if (nextBilling) patch.current_period_end = nextBilling;
                    await supabaseAdmin.from('subscriptions').update(patch)
                        .eq('paypal_subscription_id', subId);
                }
                break;
            }

            default:
                break;
        }

        return res.status(200).json({ received: true });

    } catch (err) {
        console.error('PayPal webhook error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
