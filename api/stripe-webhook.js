const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { buffer } = require('micro');

const stripe   = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel: desactivar body parser para recibir el raw body que Stripe necesita para verificar la firma
export const config = {
    api: { bodyParser: false },
};

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const rawBody = await buffer(req);

    let stripeEvent;
    try {
        stripeEvent = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const { type, data } = stripeEvent;
    console.log('Stripe event:', type);

    try {
        switch (type) {

            case 'checkout.session.completed': {
                const session    = data.object;
                const userId     = session.metadata?.userId;
                const plan       = session.metadata?.plan;
                const customerId = session.customer;
                const subId      = session.subscription;

                if (!userId || !plan) break;

                const sub       = await stripe.subscriptions.retrieve(subId);
                const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

                await supabase.from('subscriptions').upsert({
                    user_id:                userId,
                    plan,
                    status:                 'active',
                    stripe_customer_id:     customerId,
                    stripe_subscription_id: subId,
                    current_period_end:     periodEnd,
                    updated_at:             new Date().toISOString(),
                }, { onConflict: 'user_id' });

                break;
            }

            case 'customer.subscription.updated': {
                const sub    = data.object;
                await supabase.from('subscriptions').update({
                    status:             sub.status,
                    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                    updated_at:         new Date().toISOString(),
                }).eq('stripe_subscription_id', sub.id);
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = data.object;
                await supabase.from('subscriptions').update({
                    plan:       'free',
                    status:     'canceled',
                    updated_at: new Date().toISOString(),
                }).eq('stripe_subscription_id', sub.id);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = data.object;
                await supabase.from('subscriptions').update({
                    status:     'past_due',
                    updated_at: new Date().toISOString(),
                }).eq('stripe_customer_id', invoice.customer);
                break;
            }
        }

        return res.status(200).json({ received: true });

    } catch (err) {
        console.error('Webhook handler error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
