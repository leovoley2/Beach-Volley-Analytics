// Respaldo local + sincronización de partidos.
//
// Cada cambio del partido se guarda primero en el dispositivo (localStorage) y después se sube
// a Supabase. Si no hay conexión, el cambio queda pendiente y se reintenta solo: al volver la
// señal, cada cierto tiempo, al reabrir el partido o al entrar a "Mis partidos".
// Así no se pierden acciones aunque se caiga la señal o se cierre la pestaña.
//
// Cada subida envía el partido completo (sets, marcador, acciones, estado), por lo que basta con
// guardar la última versión: no hace falta una cola de operaciones.
import { supabase } from './supabase';

const PREFIX = 'bva:pending:';
const keyFor = (userId, matchId) => `${PREFIX}${userId}:${matchId}`;
const PUSH_TIMEOUT_MS = 12000;

// Aviso a la interfaz (indicador de estado, Mis partidos) cuando cambia algo pendiente.
const EVENT = 'bva:sync';
const notify = (detail) => window.dispatchEvent(new CustomEvent(EVENT, { detail }));
export function onSyncChange(fn) {
    const handler = (e) => fn(e.detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
}

function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

// Guarda en el dispositivo la última versión del partido (formato de MatchContext).
export function savePending(userId, match) {
    if (!userId || !match?.id) return false;
    const entry = { userId, matchId: match.id, savedAt: Date.now(), match };
    try {
        localStorage.setItem(keyFor(userId, match.id), JSON.stringify(entry));
    } catch {
        return false; // almacenamiento lleno o bloqueado: se sigue intentando subir igual
    }
    notify({ matchId: match.id, pending: true });
    return true;
}

export const getPending = (userId, matchId) => (userId && matchId ? read(keyFor(userId, matchId)) : null);

export function clearPending(userId, matchId, savedAt = null) {
    const key = keyFor(userId, matchId);
    const cur = read(key);
    // Si mientras se subía hubo otro cambio, no borrar la versión nueva.
    if (savedAt != null && cur && cur.savedAt !== savedAt) return;
    try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
    notify({ matchId, pending: false });
}

export function listPending(userId) {
    if (!userId) return [];
    const out = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith(`${PREFIX}${userId}:`)) {
                const e = read(k);
                if (e?.match) out.push(e);
            }
        }
    } catch { /* sin almacenamiento */ }
    return out;
}

const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms)),
]);

// ¿El error es de conexión (reintentar) o definitivo (el partido ya no existe)?
const isGone = (error) => error?.code === 'PGRST116'; // .single() sin filas: borrado o ajeno

// Una sola subida a la vez por partido.
const inFlight = new Map();

// Sube la versión pendiente de un partido. Devuelve { ok, offline, error }.
export function pushPending(userId, matchId) {
    const k = `${userId}:${matchId}`;
    if (inFlight.has(k)) return inFlight.get(k);
    const run = (async () => {
        const entry = getPending(userId, matchId);
        if (!entry) return { ok: true };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, offline: true };
        const m = entry.match;
        try {
            const { error } = await withTimeout(
                supabase.from('matches')
                    .update({
                        sets: m.sets,
                        score: m.score,
                        actions: m.actions,
                        status: m.status || 'in_progress',
                        updated_at: new Date(entry.savedAt).toISOString(),
                    })
                    .eq('id', matchId)
                    .eq('user_id', userId)
                    .select('id')
                    .single(),
                PUSH_TIMEOUT_MS,
            );
            if (error) {
                if (isGone(error)) { clearPending(userId, matchId); return { ok: false, error: 'El partido ya no existe.' }; }
                return { ok: false, offline: /fetch|network|tiempo/i.test(error.message || ''), error: error.message };
            }
            clearPending(userId, matchId, entry.savedAt);
            return { ok: true };
        } catch (err) {
            return { ok: false, offline: true, error: err?.message || String(err) };
        } finally {
            inFlight.delete(k);
        }
    })();
    inFlight.set(k, run);
    return run;
}

// Sube todo lo pendiente del usuario. Devuelve cuántos partidos se subieron.
export async function syncAllPending(userId) {
    let synced = 0;
    for (const e of listPending(userId)) {
        const res = await pushPending(userId, e.matchId);
        if (res.ok) synced++;
    }
    return synced;
}

// Decide qué versión usar al abrir un partido: la del servidor o la guardada en el dispositivo.
// Gana la local si es posterior al último guardado del servidor (cambios sin subir).
export function pickNewer(pending, serverUpdatedAt) {
    if (!pending) return null;
    const server = serverUpdatedAt ? Date.parse(serverUpdatedAt) : 0;
    return pending.savedAt > server ? pending : null;
}
