/**
 * Crea (una sola vez) el Producto y los Planes de suscripción en PayPal y
 * te imprime los plan_id (P-XXXX) para pegarlos en las variables de entorno:
 *
 *   PAYPAL_PLAN_PRO=P-xxxxxxxxxxxxx
 *   PAYPAL_PLAN_TEAM=P-xxxxxxxxxxxxx
 *
 * Uso (sandbox por defecto):
 *   PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy node scripts/paypal-setup.mjs
 *
 * Para producción añade  PAYPAL_ENV=live  al comando.
 *
 * Precios (editables aquí abajo): Pro $9/mes · Team $29/mes · moneda USD.
 */

const BASE = process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const CURRENCY = 'USD';
const PLANS = [
    { key: 'PRO',  name: 'Beach Volley Analytics – Pro',  price: '9.00'  },
    { key: 'TEAM', name: 'Beach Volley Analytics – Team', price: '29.00' },
];

async function token() {
    const id = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    if (!id || !secret) {
        console.error('Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET en el entorno.');
        process.exit(1);
    }
    const auth = Buffer.from(`${id}:${secret}`).toString('base64');
    const res = await fetch(`${BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`Auth falló: ${res.status} ${await res.text()}`);
    return (await res.json()).access_token;
}

async function createProduct(accessToken) {
    const res = await fetch(`${BASE}/v1/catalogs/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
            name: 'Beach Volley Analytics',
            description: 'Análisis de rendimiento para voley playa',
            type: 'SERVICE',
            category: 'SOFTWARE',
        }),
    });
    if (!res.ok) throw new Error(`Producto falló: ${res.status} ${await res.text()}`);
    return (await res.json()).id;
}

async function createPlan(accessToken, productId, plan) {
    const res = await fetch(`${BASE}/v1/billing/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
            product_id: productId,
            name: plan.name,
            status: 'ACTIVE',
            billing_cycles: [{
                frequency: { interval_unit: 'MONTH', interval_count: 1 },
                tenure_type: 'REGULAR',
                sequence: 1,
                total_cycles: 0, // 0 = sin fin (hasta cancelar)
                pricing_scheme: { fixed_price: { value: plan.price, currency_code: CURRENCY } },
            }],
            payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee_failure_action: 'CANCEL',
                payment_failure_threshold: 3,
            },
        }),
    });
    if (!res.ok) throw new Error(`Plan ${plan.key} falló: ${res.status} ${await res.text()}`);
    return (await res.json()).id;
}

(async () => {
    const accessToken = await token();
    console.log(`Entorno PayPal: ${BASE}`);
    const productId = await createProduct(accessToken);
    console.log(`Producto creado: ${productId}\n`);

    console.log('Pega estas variables en .env.local y en Vercel:\n');
    for (const plan of PLANS) {
        const planId = await createPlan(accessToken, productId, plan);
        console.log(`PAYPAL_PLAN_${plan.key}=${planId}`);
    }
    console.log('\nListo. Recuerda también configurar PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,');
    console.log('PAYPAL_WEBHOOK_ID y (para producción) PAYPAL_ENV=live.');
})().catch(err => { console.error(err); process.exit(1); });
