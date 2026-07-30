import { getPayPalAccessToken, supabaseAdmin, PAYPAL_BASE } from './_paypal.js';

// Los IDs de plan (P-XXXX) se crean una vez en PayPal (ver scripts/paypal-setup.mjs)
// y se inyectan por variable de entorno. El código nunca los hardcodea.
const PLAN_IDS = {
    pro:  process.env.PAYPAL_PLAN_PRO,
    team: process.env.PAYPAL_PLAN_TEAM,
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Verificar JWT: sólo un usuario autenticado puede iniciar un checkout.
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    // Rate limit: máx 10 intentos de checkout por usuario por minuto.
    const { error: rlError } = await supabaseAdmin.rpc('enforce_rate_limit_uid', {
        p_uid:    user.id,
        p_bucket: 'create_checkout',
        p_limit:  10,
    });
    if (rlError) {
        return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' });
    }

    try {
        // Sólo confiamos en `plan` del body; el userId/email salen del token verificado.
        const { plan } = req.body;
        const planId = PLAN_IDS[plan];
        if (!planId) return res.status(400).json({ error: 'Plan inválido' });

        const baseUrl     = process.env.VITE_APP_URL || `https://${process.env.VERCEL_URL}`;
        const accessToken = await getPayPalAccessToken();

        const resp = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
            method:  'POST',
            headers: {
                'Content-Type':    'application/json',
                Authorization:     `Bearer ${accessToken}`,
                // Idempotencia: reintentos del mismo usuario no duplican suscripciones.
                'PayPal-Request-Id': `${user.id}-${plan}-${Date.now()}`,
            },
            body: JSON.stringify({
                plan_id:   planId,
                // Referencia para identificar al usuario en el webhook (verificado, no del body).
                custom_id: `${user.id}|${plan}`,
                subscriber: { email_address: user.email },
                application_context: {
                    brand_name:          'Beach Volley Analytics',
                    user_action:         'SUBSCRIBE_NOW',
                    shipping_preference: 'NO_SHIPPING',
                    return_url:          `${baseUrl}/payment-success`,
                    cancel_url:          `${baseUrl}/pricing`,
                },
            }),
        });

        const data = await resp.json();
        if (!resp.ok) {
            console.error('PayPal create subscription error:', resp.status, data);
            return res.status(502).json({ error: 'No se pudo iniciar el pago con PayPal.' });
        }

        const approve = (data.links || []).find(l => l.rel === 'approve');
        if (!approve) {
            console.error('PayPal: respuesta sin enlace approve', data);
            return res.status(502).json({ error: 'PayPal no devolvió enlace de aprobación.' });
        }

        return res.status(200).json({ url: approve.href });

    } catch (err) {
        console.error('create-checkout error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
