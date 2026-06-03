import {
    MercadoPagoConfig,
    PreApproval,
    WebhookSignatureValidator,
    InvalidWebhookSignatureError,
} from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
});
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { type, data } = req.body;
        const dataId = data?.id;

        // Solo nos interesan los eventos de suscripción
        if (type !== 'preapproval') {
            return res.status(200).json({ received: true });
        }

        if (!dataId) return res.status(400).json({ error: 'Missing data.id' });

        // Verificar firma con el validador nativo del SDK de MP
        if (process.env.MP_WEBHOOK_SECRET) {
            try {
                const validator = new WebhookSignatureValidator();
                validator.validate({
                    xSignature:  req.headers['x-signature'],
                    xRequestId:  req.headers['x-request-id'],
                    dataId,
                    secret:      process.env.MP_WEBHOOK_SECRET,
                });
            } catch (err) {
                if (err instanceof InvalidWebhookSignatureError) {
                    console.error('MP webhook: firma inválida');
                    return res.status(400).json({ error: 'Invalid signature' });
                }
                throw err;
            }
        }

        // Obtener la suscripción completa desde la API de MP
        const preApproval  = new PreApproval(mpClient);
        const subscription = await preApproval.get({ id: dataId });

        const [userId, plan] = (subscription.external_reference ?? '').split('|');
        if (!userId || !plan) {
            // Suscripción no creada por esta app — ignorar
            return res.status(200).json({ received: true });
        }

        const status = subscription.status; // 'authorized' | 'paused' | 'cancelled' | 'pending'

        switch (status) {
            case 'authorized': {
                await supabase.from('subscriptions').upsert({
                    user_id:            userId,
                    plan,
                    status:             'active',
                    mp_subscription_id: subscription.id,
                    current_period_end: subscription.next_payment_date ?? null,
                    updated_at:         new Date().toISOString(),
                }, { onConflict: 'user_id' });
                break;
            }
            case 'cancelled': {
                await supabase.from('subscriptions').update({
                    plan:       'free',
                    status:     'canceled',
                    updated_at: new Date().toISOString(),
                }).eq('mp_subscription_id', subscription.id);
                break;
            }
            case 'paused': {
                await supabase.from('subscriptions').update({
                    status:     'paused',
                    updated_at: new Date().toISOString(),
                }).eq('mp_subscription_id', subscription.id);
                break;
            }
            default:
                break;
        }

        return res.status(200).json({ received: true });

    } catch (err) {
        console.error('MP webhook error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
