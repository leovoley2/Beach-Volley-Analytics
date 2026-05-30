const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
    pro:  process.env.STRIPE_PRO_PRICE_ID,
    team: process.env.STRIPE_TEAM_PRICE_ID,
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { plan, userId, userEmail } = JSON.parse(event.body);

        if (!PLANS[plan]) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Plan inválido' }) };
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: userEmail,
            line_items: [{ price: PLANS[plan], quantity: 1 }],
            success_url: `${process.env.URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${process.env.URL}/pricing`,
            metadata: { userId, plan },
            subscription_data: {
                metadata: { userId, plan },
            },
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: session.url }),
        };
    } catch (err) {
        console.error('create-checkout error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
