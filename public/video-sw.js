// Service worker de video local (Beach Volley Analytics).
//
// Sirve el video que el entrenador abrió desde su equipo como si fuera una descarga normal:
// el reproductor pide rangos (/__localvideo/<token>) y aquí se responden trozo a trozo, pidiendo
// cada trozo a la página, que es la que tiene el archivo. Así un video de varios GB no llega
// entero de golpe al reproductor (en iPad eso lo deja trabado en "Cargando…").
//
// Solo atiende /__localvideo/: el resto de las peticiones de la app pasan sin tocarse.
const PREFIX = '/__localvideo/';
const CHUNK = 1024 * 1024; // 1 MB por trozo

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(PREFIX)) return;
    event.respondWith(handle(event));
});

// Pregunta a una página y espera su respuesta (o null si no contesta a tiempo).
function ask(client, message, timeoutMs) {
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(null), timeoutMs);
        channel.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
        try { client.postMessage(message, [channel.port2]); } catch { clearTimeout(timer); resolve(null); }
    });
}

// Busca la pestaña que tiene abierto ese video.
async function findSource(token, clientId) {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const ordered = [...all.filter(c => c.id === clientId), ...all.filter(c => c.id !== clientId)];
    for (const client of ordered) {
        const info = await ask(client, { type: 'bva-video-info', token }, 3000);
        if (info && info.size > 0) return { client, size: info.size, type: info.type };
    }
    return null;
}

async function handle(event) {
    const token = decodeURIComponent(new URL(event.request.url).pathname.slice(PREFIX.length));
    const source = await findSource(token, event.clientId);
    if (!source) return new Response('', { status: 404 });
    const { client, size, type } = source;

    let start = 0;
    let end = size - 1;
    const range = /bytes=(\d*)-(\d*)/.exec(event.request.headers.get('range') || '');
    const partial = !!range && (range[1] !== '' || range[2] !== '');
    if (partial) {
        if (range[1] === '') start = Math.max(0, size - Number(range[2])); // últimos N bytes
        else {
            start = Number(range[1]);
            if (range[2] !== '') end = Math.min(Number(range[2]), size - 1);
        }
    }
    if (start >= size || start > end) {
        return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }

    let pos = start;
    let seq = 0;
    let cancelled = false;
    const body = new ReadableStream({
        async pull(controller) {
            if (pos > end) { controller.close(); return; }
            const to = Math.min(pos + CHUNK, end + 1);
            // La página puede demorar la respuesta para no adelantarse demasiado a la reproducción.
            const buf = await ask(client, { type: 'bva-video-read', token, start: pos, end: to, seq: seq++ }, 90000);
            if (cancelled) return;
            if (!buf || !buf.byteLength) { controller.error(new Error('No se pudo leer el video')); return; }
            pos += buf.byteLength;
            controller.enqueue(new Uint8Array(buf));
            if (pos > end) controller.close();
        },
        cancel() { cancelled = true; },
    });

    const headers = {
        'Content-Type': type || 'video/mp4',
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
    };
    if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    return new Response(body, { status: partial ? 206 : 200, headers });
}
