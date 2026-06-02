const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLANS = {
    pro:  process.env.STRIPE_PRO_PRICE_ID,
    team: process.env.STRIPE_TEAM_PRICE_ID,
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Verificar JWT — el userId del body debe coincidir con el token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { plan, userId, userEmail } = req.body;

        if (user.id !== userId) return res.status(403).json({ error: 'Forbidden' });

        if (!PLANS[plan]) {
            return res.status(400).json({ error: 'Plan inválido' });
        }

        const baseUrl = process.env.VITE_APP_URL || `https://${process.env.VERCEL_URL}`;

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: userEmail,
            line_items: [{ price: PLANS[plan], quantity: 1 }],
            success_url: `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${baseUrl}/pricing`,
            metadata: { userId, plan },
            subscription_data: {
                metadata: { userId, plan },
            },
        });

        return res.status(200).json({ url: session.url });

    } catch (err) {
        console.error('create-checkout error:', err);
        return res.status(500).json({ error: err.message });
    }
};
