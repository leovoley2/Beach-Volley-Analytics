import { useState, useEffect, useRef, useCallback } from 'react';
import { savePending, getPending, pushPending } from '../lib/offlineSync';

const DEBOUNCE_MS = 1500;
const RETRY_MS = 15000;

// Huella de lo que se guarda, para no reescribir si nada cambió.
const fingerprint = (m) => JSON.stringify([m.sets, m.score, m.actions, m.status]);

// Guarda el partido en curso: primero en el dispositivo, después en el servidor.
// status: 'saved' (todo subido) | 'saving' (subiendo) | 'offline' (pendiente en el dispositivo).
export function useMatchSync(userId, matchId, currentMatch) {
    const [status, setStatus] = useState(() => (getPending(userId, matchId) ? 'offline' : 'saved'));
    const lastSaved = useRef(null);
    const timer = useRef(null);

    // Marca una versión como ya guardada (p. ej. la recién cargada del servidor).
    const markSynced = useCallback((match) => { lastSaved.current = match ? fingerprint(match) : null; }, []);

    const flush = useCallback(async () => {
        if (!userId || !matchId || !getPending(userId, matchId)) { setStatus('saved'); return; }
        setStatus('saving');
        const res = await pushPending(userId, matchId);
        if (res.ok) setStatus(getPending(userId, matchId) ? 'saving' : 'saved');
        else setStatus('offline');
    }, [userId, matchId]);

    // Cada cambio: respaldo local inmediato + subida con un pequeño retraso.
    useEffect(() => {
        if (!userId || !currentMatch || currentMatch.id !== matchId) return;
        const fp = fingerprint(currentMatch);
        if (fp === lastSaved.current) return;
        lastSaved.current = fp;
        savePending(userId, currentMatch);
        setStatus(navigator.onLine === false ? 'offline' : 'saving');
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, DEBOUNCE_MS);
    }, [userId, matchId, currentMatch, flush]);
    useEffect(() => () => clearTimeout(timer.current), []);

    // Reintentos: al volver la conexión, cada cierto tiempo y al abrir el partido.
    useEffect(() => {
        if (!userId || !matchId) return;
        const onOnline = () => flush();
        window.addEventListener('online', onOnline);
        const iv = setInterval(() => { if (getPending(userId, matchId)) flush(); }, RETRY_MS);
        if (getPending(userId, matchId)) flush();
        return () => { window.removeEventListener('online', onOnline); clearInterval(iv); };
    }, [userId, matchId, flush]);

    return { status, flush, markSynced };
}
