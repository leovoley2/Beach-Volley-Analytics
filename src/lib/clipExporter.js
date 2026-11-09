// Exporta clips a un archivo de video dentro del navegador (sin subir nada).
// Reproduce cada tramo en un <video> oculto, lo dibuja en un canvas con rótulos y graba
// canvas + audio con MediaRecorder. Es en tiempo real: exportar 1 min de clips tarda ~1 min.
// Portado de Beach Scout (js/exporter.js).

const TYPES = [
    ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1,mp4a.40.2', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
];

export function pickType() {
    if (typeof window === 'undefined' || !window.MediaRecorder) return null;
    for (const [mime, ext] of TYPES) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
    return null;
}

const ACCENT = '#f97316';
const FONT = 'Inter, -apple-system, "Segoe UI", sans-serif';
const once = (el, ev) => new Promise(r => el.addEventListener(ev, r, { once: true }));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
}

function drawTitle(ctx, W, H, title, subtitle) {
    ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ACCENT; ctx.fillRect(W * 0.35, H * 0.6, W * 0.3, Math.max(3, H * 0.01));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eceef2';
    ctx.font = `800 ${Math.round(H * 0.075)}px ${FONT}`;
    ctx.fillText(title, W / 2, H * 0.45, W * 0.9);
    ctx.fillStyle = '#8a919e';
    ctx.font = `500 ${Math.round(H * 0.04)}px ${FONT}`;
    ctx.fillText(subtitle, W / 2, H * 0.7, W * 0.9);
    ctx.font = `700 ${Math.round(H * 0.032)}px ${FONT}`;
    ctx.fillStyle = '#eceef2';
    const brand = 'Beach Volley ';
    const bw = ctx.measureText(brand).width;
    const aw = ctx.measureText('Analytics').width;
    ctx.textAlign = 'left';
    ctx.fillText(brand, W / 2 - (bw + aw) / 2, H * 0.9);
    ctx.fillStyle = ACCENT;
    ctx.fillText('Analytics', W / 2 - (bw + aw) / 2 + bw, H * 0.9);
}

// Rótulo inferior (jugador · fundamento · resultado) + contador arriba a la derecha.
function drawLabel(ctx, W, H, label, counter) {
    const fs = Math.round(H * 0.042), pad = fs * 0.5;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    if (counter) {
        ctx.font = `600 ${Math.round(fs * 0.8)}px ${FONT}`;
        const w = ctx.measureText(counter).width + pad * 2;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; roundRect(ctx, W - w - pad, pad, w, fs * 1.4, pad / 2);
        ctx.fillStyle = '#fff'; ctx.fillText(counter, W - w, pad + fs * 0.7);
    }
    if (!label) return;
    const boxH = fs * 1.35 + pad;
    ctx.fillStyle = 'rgba(0,0,0,.68)'; ctx.fillRect(0, H - boxH, W, boxH);
    ctx.fillStyle = label.color || ACCENT; ctx.fillRect(0, H - boxH, fs * 0.25, boxH);
    ctx.font = `700 ${fs}px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(label.main, fs * 0.7, H - boxH / 2, W - fs * 1.4);
}

/* opts: { src, ranges:[{start,end}], labels:[{main,color}], title, subtitle, titleCard, overlay,
 *         maxHeight, onProgress(fraction, text), signal:{cancelled} }
 * Devuelve { blob, ext } o null si se canceló. */
export async function exportClips(opts) {
    const type = pickType();
    if (!type) throw new Error('Este navegador no puede grabar video (usa Chrome o Safari actualizados).');

    const v = document.createElement('video');
    v.src = opts.src; v.preload = 'auto'; v.playsInline = true;
    if (v.readyState < 1) await once(v, 'loadedmetadata');
    const k = Math.min(1, (opts.maxHeight || 720) / v.videoHeight);
    const W = Math.round((v.videoWidth * k) / 2) * 2, H = Math.round((v.videoHeight * k) / 2) * 2;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Audio del video → grabación, sin sonar por los parlantes.
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = AC ? new AC() : null;
    let dest = null;
    if (ac) {
        dest = ac.createMediaStreamDestination();
        try { ac.createMediaElementSource(v).connect(dest); } catch { /* video sin audio */ }
        await ac.resume().catch(() => {});
    }

    const stream = canvas.captureStream(30);
    dest?.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: H >= 1000 ? 8e6 : 5e6 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(r => (rec.onstop = r));

    const total = opts.ranges.reduce((s, r) => s + (r.end - r.start), 0) + (opts.titleCard ? 2.5 : 0);
    let done = 0;
    const report = (text) => opts.onProgress?.(Math.min(1, done / total), text);
    const cancelled = () => !!opts.signal?.cancelled;

    // Si la pestaña se oculta, el navegador deja de dibujar: se pausa todo hasta que vuelva.
    let hidden = document.hidden;
    const onVis = () => {
        hidden = document.hidden;
        if (hidden) { v.pause(); if (rec.state === 'recording') rec.pause(); }
    };
    document.addEventListener('visibilitychange', onVis);
    const waitVisible = async () => { while (hidden && !cancelled()) await sleep(200); };

    try {
        rec.start(1000);
        if (opts.titleCard) {
            const t0 = performance.now();
            while (performance.now() - t0 < 2500 && !cancelled()) {
                drawTitle(ctx, W, H, opts.title, opts.subtitle);
                done = (performance.now() - t0) / 1000; report('Portada');
                await sleep(33);
                await waitVisible();
            }
            done = 2.5;
        }
        rec.pause();

        for (let i = 0; i < opts.ranges.length && !cancelled(); i++) {
            const r = opts.ranges[i];
            const label = opts.overlay ? opts.labels[i] : null;
            const counter = opts.overlay && opts.ranges.length > 1 ? `${i + 1}/${opts.ranges.length}` : '';
            const step = `Clip ${i + 1} de ${opts.ranges.length}`;
            report(step);
            v.currentTime = r.start; await once(v, 'seeked');
            await waitVisible();
            ctx.drawImage(v, 0, 0, W, H); drawLabel(ctx, W, H, label, counter);
            rec.resume();
            await v.play();
            const base = done;
            await new Promise((resolve) => {
                const frame = () => {
                    if (cancelled()) return resolve();
                    if (hidden) { // esperar a que vuelva la pestaña y continuar
                        waitVisible().then(() => { if (rec.state === 'paused') rec.resume(); v.play().then(schedule); });
                        return;
                    }
                    ctx.drawImage(v, 0, 0, W, H); drawLabel(ctx, W, H, label, counter);
                    done = base + Math.max(0, v.currentTime - r.start); report(step);
                    if (v.currentTime >= r.end || v.ended) return resolve();
                    schedule();
                };
                const schedule = () => ('requestVideoFrameCallback' in v ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame));
                schedule();
            });
            v.pause(); rec.pause();
            done = base + (r.end - r.start);
        }
        if (rec.state === 'paused') rec.resume();
        rec.stop();
        await stopped;
    } finally {
        document.removeEventListener('visibilitychange', onVis);
        v.pause(); v.removeAttribute('src'); v.load();
        stream.getTracks().forEach(t => t.stop());
        ac?.close().catch(() => {});
    }
    if (cancelled()) return null;
    return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext };
}

// Nombre de archivo seguro a partir del título.
export function safeFileName(title, ext) {
    const base = (title || 'Clips').replace(/\s*·\s*/g, ' - ').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'Clips';
    return `${base}.${ext}`;
}

export function saveBlob(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
