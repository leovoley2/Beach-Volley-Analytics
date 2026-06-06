import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Lock de auth con timeout. El lock por defecto de Supabase (navigator.locks)
 * espera INDEFINIDAMENTE: si un tab queda atascado reteniendo el lock, cualquier
 * otro tab cuelga en getSession() para siempre (la app no carga y bota a login).
 *
 * Esta versión intenta el lock cross-tab pero, si no lo obtiene en 3s, continúa
 * SIN lock en vez de colgarse. El único riesgo es un refresh de token concurrente
 * entre tabs (poco frecuente e inofensivo), a cambio de que la app nunca se bloquee.
 */
async function lockWithTimeout(name, _acquireTimeout, fn) {
    if (typeof navigator === 'undefined' || !navigator.locks?.request) {
        return fn();
    }
    try {
        return await navigator.locks.request(
            name,
            { mode: 'exclusive', signal: AbortSignal.timeout(3000) },
            async () => fn()
        );
    } catch {
        // Timeout esperando el lock (otro tab lo retiene) → ejecutar igualmente.
        return fn();
    }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        lock: lockWithTimeout,
    },
});
