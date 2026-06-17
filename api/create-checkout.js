import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
});
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// MP solo cobra en la moneda local de la cuenta vendedora (cuenta Perú → PEN).
// Equivalencias aprox. de los precios originales en USD ($9 / $29).
const PLAN_CONFIG = {
    pro: {
        amount:   35,
        currency: 'PEN',
        name:     'Plan Pro – Beach Volley Analytics',
    },
    team: {
        amount:   109,
        currency: 'PEN',
        name:     'Plan Team – Beach Volley Analytics',
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Verificar JWT — el userId del body debe coincidir con el token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    // Rate limit: máx 10 intentos de checkout por usuario por minuto.
    // Evita que alguien con sesión válida martillee la creación de suscripciones.
    const { error: rlError } = await supabaseAdmin.rpc('enforce_rate_limit_uid', {
        p_uid: user.id,
        p_bucket: 'create_checkout',
        p_limit: 10,
    });
    if (rlError) {
        return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' });
    }

    try {
        const { plan, userId, userEmail } = req.body;

        if (user.id !== userId) return res.status(403).json({ error: 'Forbidden' });

        const planConfig = PLAN_CONFIG[plan];
        if (!planConfig) return res.status(400).json({ error: 'Plan inválido' });

        const baseUrl = process.env.VITE_APP_URL || `https://${process.env.VERCEL_URL}`;

        const preApproval = new PreApproval(mpClient);
        const response = await preApproval.create({
            body: {
                reason:      planConfig.name,
                payer_email: userEmail,
                back_url:    `${baseUrl}/payment-success`,
                auto_recurring: {
                    frequency:          1,
                    frequency_type:     'months',
                    transaction_amount: planConfig.amount,
                    currency_id:        planConfig.currency,
                },
                // Referencia para identificar al usuario en el webhook
                external_reference: `${userId}|${plan}`,
                status: 'pending',
            },
        });

        return res.status(200).json({ url: response.init_point });

    } catch (err) {
        console.error('create-checkout error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
