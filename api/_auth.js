// Helper compartido de autenticación para las funciones de api/.
// El prefijo "_" hace que Vercel NO lo publique como endpoint.
import { supabaseAdmin } from './_paypal.js';

/**
 * Verifica el JWT de Supabase del header Authorization y aplica un rate limit
 * por usuario. Si algo falla, responde (401/429) y devuelve null.
 * El usuario SIEMPRE sale del token verificado, nunca del body.
 */
export async function requireUser(req, res, { bucket, limit }) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }

    const { error: rlError } = await supabaseAdmin.rpc('enforce_rate_limit_uid', {
        p_uid:    user.id,
        p_bucket: bucket,
        p_limit:  limit,
    });
    if (rlError) {
        res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' });
        return null;
    }

    return user;
}
