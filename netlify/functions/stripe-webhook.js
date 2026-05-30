const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe    = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase  = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // service role bypasa RLS
);

exports.handler = async (event) => {
    const sig = event.headers['stripe-signature'];

    let stripeEvent;
    try {
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    const { type, data } = stripeEvent;
    console.log('Stripe event:', type);

    try {
        switch (type) {

            case 'checkout.session.completed': {
                const session   = data.object;
                const userId    = session.metadata?.userId;
                const plan      = session.metadata?.plan;
                const customerId = session.customer;
                const subId      = session.subscription;

                if (!userId || !plan) break;

                // Obtener fecha de expiración del período actual
                const sub = await stripe.subscriptions.retrieve(subId);
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
                const userId = sub.metadata?.userId;
                if (!userId) break;

                await supabase.from('subscriptions').update({
                    status:             sub.status,       // 'active' | 'past_due' | 'canceled'
                    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                    updated_at:         new Date().toISOString(),
                }).eq('stripe_subscription_id', sub.id);

                break;
            }

            case 'customer.subscription.deleted': {
                // Cancelación — downgrade a Free
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

        return { statusCode: 200, body: JSON.stringify({ received: true }) };

    } catch (err) {
        console.error('Webhook handler error:', err);
        return { statusCode: 500, body: err.message };
    }
};
