// Helper compartido de PayPal. El prefijo "_" hace que Vercel NO lo publique
// como endpoint serverless: es sólo un módulo importado por las funciones de api/.
import { createClient } from '@supabase/supabase-js';

// Sandbox por defecto; producción sólo si PAYPAL_ENV === 'live'.
export const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Obtiene un access_token OAuth2 (client_credentials) de PayPal.
 * Lanza si faltan credenciales — nunca opera sin ellas.
 */
export async function getPayPalAccessToken() {
    const id     = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    if (!id || !secret) throw new Error('PayPal credentials not configured');

    const auth = Buffer.from(`${id}:${secret}`).toString('base64');
    const res  = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method:  'POST',
        headers: {
            Authorization:  `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`PayPal auth failed: ${res.status} ${t}`);
    }
    const data = await res.json();
    return data.access_token;
}
