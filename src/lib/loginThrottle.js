/**
 * Anti fuerza-bruta en el cliente.
 *
 * Esto NO sustituye a la protección del servidor (Supabase Auth ya limita
 * intentos por IP y deberías activar Captcha en el panel). Es una capa extra
 * que frena el abuso desde el propio navegador: tras varios intentos fallidos
 * bloquea el formulario con una espera creciente (backoff exponencial).
 *
 * Se guarda por email en localStorage para que cerrar/abrir la pestaña no
 * reinicie el contador. Un atacante con devtools podría borrarlo, por eso la
 * defensa real vive en el servidor (Captcha + rate limit de Supabase); aquí
 * solo elevamos el costo del ataque casual y protegemos al usuario legítimo.
 */

const KEY_PREFIX = 'bva_login_attempts:';
const MAX_ATTEMPTS = 5;          // intentos fallidos antes del primer bloqueo
const BASE_LOCK_MS = 30 * 1000;  // 30s, se duplica en cada bloqueo posterior
const MAX_LOCK_MS  = 15 * 60 * 1000; // tope: 15 min
const WINDOW_MS    = 15 * 60 * 1000; // ventana para olvidar intentos viejos

function keyFor(email) {
    return KEY_PREFIX + (email || '').trim().toLowerCase();
}

function read(email) {
    try {
        const raw = localStorage.getItem(keyFor(email));
        if (!raw) return { fails: 0, lockUntil: 0, lockLevel: 0, last: 0 };
        return JSON.parse(raw);
    } catch {
        return { fails: 0, lockUntil: 0, lockLevel: 0, last: 0 };
    }
}

function write(email, state) {
    try {
        localStorage.setItem(keyFor(email), JSON.stringify(state));
    } catch {
        /* localStorage lleno o bloqueado: ignorar */
    }
}

/**
 * Devuelve el estado de bloqueo para un email.
 * { locked: boolean, remainingMs: number, remainingSeconds: number }
 */
export function getLockState(email) {
    const s = read(email);
    const now = Date.now();

    // Si pasó la ventana sin actividad, olvidamos los intentos acumulados.
    if (s.last && now - s.last > WINDOW_MS && now > s.lockUntil) {
        clearAttempts(email);
        return { locked: false, remainingMs: 0, remainingSeconds: 0 };
    }

    if (s.lockUntil && now < s.lockUntil) {
        const remainingMs = s.lockUntil - now;
        return {
            locked: true,
            remainingMs,
            remainingSeconds: Math.ceil(remainingMs / 1000),
        };
    }
    return { locked: false, remainingMs: 0, remainingSeconds: 0 };
}

/** Registra un intento fallido y aplica bloqueo con backoff si corresponde. */
export function recordFailure(email) {
    const s = read(email);
    const now = Date.now();
    const fails = (s.fails || 0) + 1;

    let lockUntil = s.lockUntil || 0;
    let lockLevel = s.lockLevel || 0;

    if (fails >= MAX_ATTEMPTS) {
        lockLevel = lockLevel + 1;
        const lockMs = Math.min(BASE_LOCK_MS * 2 ** (lockLevel - 1), MAX_LOCK_MS);
        lockUntil = now + lockMs;
    }

    write(email, { fails, lockUntil, lockLevel, last: now });
    return getLockState(email);
}

/** Limpia el contador tras un login exitoso. */
export function clearAttempts(email) {
    try {
        localStorage.removeItem(keyFor(email));
    } catch {
        /* ignorar */
    }
}

export const THROTTLE_CONFIG = { MAX_ATTEMPTS, BASE_LOCK_MS, MAX_LOCK_MS };
