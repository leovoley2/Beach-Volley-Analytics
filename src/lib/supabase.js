import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Lock de auth NO-OP (ejecuta la operación directamente, sin navigator.locks).
 *
 * El lock por defecto de Supabase usa navigator.locks para serializar refresh de
 * token entre pestañas, pero en la práctica se quedaba RETENIDO sin liberarse:
 * getSession() y cualquier query del cliente (insert/update) se colgaban para
 * siempre, mientras que las mismas llamadas a la API REST (sin lock) funcionaban.
 *
 * Sin lock, el cliente se comporta igual que en navegadores sin navigator.locks
 * (modo soportado por el SDK). Único riesgo: dos pestañas podrían refrescar el
 * token a la vez (poco frecuente; el SDK lo maneja). A cambio, nunca hay deadlock.
 */
const noopLock = (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        lock: noopLock,
    },
});
