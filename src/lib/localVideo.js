// Video local "por partes".
//
// Normalmente el video se abre con un blob: URL y el navegador lo lee directo del archivo. En iPad,
// con archivos de varios GB, el reproductor se queda en "Cargando…" y no se recupera. En este modo
// el video se pide a /__localvideo/<token>; el service worker (public/video-sw.js) responde los
// rangos pidiendo cada trozo a esta página, que controla el ritmo: no entrega datos muy por delante
// de lo que se está reproduciendo.
const PREFIX = '/__localvideo/';
const MODE_KEY = 'bva:video:modo'; // 'partes' | 'directo' para forzar un modo (pruebas / soporte)
const BIG_FILE = 300 * 1024 * 1024;

// token → { token, file, getVideo, extra: Set<HTMLVideoElement> }
const sources = new Map();

// Otro reproductor que usa la misma URL (la exportación de clips): el control de ritmo también
// lo tiene en cuenta. Devuelve una función para soltarlo.
export function attachPlayer(url, el) {
    const src = typeof url === 'string' && url.startsWith(PREFIX) ? sources.get(url.slice(PREFIX.length)) : null;
    if (!src) return () => {};
    src.extra.add(el);
    return () => src.extra.delete(el);
}

const isIOS = () => typeof navigator !== 'undefined'
    && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const chunksSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    && typeof ReadableStream !== 'undefined';

// ¿Conviene abrir este archivo por partes desde el principio?
export function prefersChunks(file) {
    let forced = null;
    try { forced = localStorage.getItem(MODE_KEY); } catch { /* sin almacenamiento */ }
    if (forced === 'partes') return true;
    if (forced === 'directo') return false;
    return isIOS() && file.size > BIG_FILE;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Control de ritmo: espera mientras el trozo pedido esté muy por delante de la reproducción.
// Los dos primeros trozos de cada respuesta salen de inmediato (cabeceras, saltos) y nunca se
// espera más de 20 s, para que la conexión con el reproductor no se corte durante una pausa larga.
async function pace(src, start, seq) {
    if (seq < 2) return;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
        if (!sources.has(src.token)) return;
        const players = [src.getVideo?.(), ...src.extra].filter(Boolean);
        if (!players.length) return;
        for (const el of players) {
            // Sin metadatos aún (se están leyendo las cabeceras): no frenar.
            if (el.readyState < 1 || !Number.isFinite(el.duration) || el.duration <= 0) return;
            const bytesPerSec = src.file.size / el.duration;
            const playhead = (el.currentTime / el.duration) * src.file.size;
            const windowBytes = Math.max(32 * 1024 * 1024, bytesPerSec * 30);
            if (start <= playhead + windowBytes) return;
        }
        await sleep(250);
    }
}

let listening = false;
function listen() {
    if (listening) return;
    listening = true;
    navigator.serviceWorker.addEventListener('message', async (e) => {
        const msg = e.data;
        const port = e.ports?.[0];
        if (!port || !msg?.type?.startsWith('bva-video-')) return;
        const src = sources.get(msg.token);
        if (!src) { port.postMessage(null); return; }
        if (msg.type === 'bva-video-info') {
            port.postMessage({ size: src.file.size, type: src.file.type || 'video/mp4' });
            return;
        }
        if (msg.type === 'bva-video-read') {
            try {
                await pace(src, msg.start, msg.seq);
                const buf = await src.file.slice(msg.start, msg.end).arrayBuffer();
                port.postMessage(buf, [buf]);
            } catch {
                port.postMessage(null);
            }
        }
    });
}

// Registra el service worker y espera a que controle esta página. Devuelve true si está listo.
let ready = null;
export function ensureChunkWorker() {
    if (!chunksSupported()) return Promise.resolve(false);
    if (!ready) {
        ready = (async () => {
            try {
                listen();
                await navigator.serviceWorker.register('/video-sw.js', { scope: '/' });
                await navigator.serviceWorker.ready;
                if (!navigator.serviceWorker.controller) {
                    await Promise.race([
                        new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })),
                        sleep(4000),
                    ]);
                }
                return !!navigator.serviceWorker.controller;
            } catch {
                return false;
            }
        })();
        ready.then(ok => { if (!ok) ready = null; });
    }
    return ready;
}

// Abre un archivo de video. Devuelve { url, mode: 'partes' | 'directo', release() }.
export async function openVideoSource(file, getVideo, wantChunks) {
    if (wantChunks && await ensureChunkWorker()) {
        const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        sources.set(token, { token, file, getVideo, extra: new Set() });
        return { url: `${PREFIX}${token}`, mode: 'partes', release: () => sources.delete(token) };
    }
    const url = URL.createObjectURL(file);
    return { url, mode: 'directo', release: () => URL.revokeObjectURL(url) };
}
