// Graba la reproducción de la pizarra 3D como video (MP4 si el navegador lo soporta, si no WebM)
// para compartirla por WhatsApp o redes. Cada cuadro 3D se copia a un lienzo 2D donde se
// añaden el título, el paso actual y la marca de la app.

const MIME_TYPES = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const MAX_SIDE = 1280;
const PRE_ROLL_MS = 600, POST_ROLL_MS = 300;

export function videoSupport() {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
    const mimeType = MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t));
    return mimeType ? { mimeType, ext: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm' } : null;
}

function pill(ctx, text, x, y, size, align = 'left', bg = 'rgba(11, 15, 26, 0.78)') {
    ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
    const w = ctx.measureText(text).width + size * 1.2, h = size * 1.8;
    const left = align === 'right' ? x - w : x;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(left, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + size * 0.6, y + h / 2);
}

// Reproduce `steps` en el motor mientras graba. Resuelve con { blob, ext } al terminar.
export function recordPlayback(engine, steps, { title }) {
    const support = videoSupport();
    if (!support) return Promise.reject(new Error('Este navegador no permite grabar video.'));

    const src = engine.renderer.domElement;
    const k = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((src.width * k) / 2) * 2; // dimensiones pares para el códec
    canvas.height = Math.round((src.height * k) / 2) * 2;
    const ctx = canvas.getContext('2d');
    const size = Math.max(14, Math.round(canvas.height * 0.035));
    const pad = Math.round(size * 0.8);

    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: support.mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    // Se llama justo después de cada render del motor (el búfer WebGL aún es válido).
    engine.frameHook = () => {
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
        if (title) pill(ctx, title.slice(0, 50), pad, pad, size);
        const step = engine.playingStep;
        if (steps.length > 1 && step !== null && step !== undefined) {
            pill(ctx, `Paso ${step + 1} de ${steps.length}`, canvas.width - pad, pad, size, 'right', 'rgba(22, 163, 74, 0.9)');
        }
        pill(ctx, 'beachvolleyanalytics.com', canvas.width - pad, canvas.height - pad - size * 1.8, Math.round(size * 0.75), 'right');
    };

    return new Promise((resolve, reject) => {
        const finish = () => {
            engine.frameHook = null;
            if (recorder.state !== 'inactive') recorder.stop();
        };
        recorder.onstop = () => {
            if (chunks.length === 0) { reject(new Error('No se pudo grabar el video.')); return; }
            resolve({ blob: new Blob(chunks, { type: support.mimeType.split(';')[0] }), ext: support.ext });
        };
        recorder.onerror = () => { finish(); reject(new Error('Falló la grabación del video.')); };
        recorder.start(250);
        setTimeout(() => {
            const started = engine.play(steps, 0, () => setTimeout(finish, POST_ROLL_MS));
            if (!started) {
                finish();
                reject(new Error('Añade desplazamientos o trayectorias para grabar la jugada.'));
            }
        }, PRE_ROLL_MS);
    });
}
