import { supabase } from './supabase';

// Torneos del usuario (tabla public.tournaments). Los partidos siguen guardando el nombre del
// torneo como texto (matches.tournament); esta tabla añade portada, sede, fechas y color.
// El vínculo es por nombre normalizado (sin mayúsculas ni espacios sobrantes).

const TIMEOUT_MS = 12000;
const COLUMNS = 'id, name, location, start_date, end_date, color, image, updated_at';
const MAX_IMAGE_BYTES = 380_000; // la BD acepta hasta 400 KB por portada

export const normalizeName = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

function withTimeout(promise) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('El servidor tardó demasiado en responder.')), TIMEOUT_MS)),
    ]);
}

async function run(query) {
    const { data, error } = await withTimeout(query);
    if (error) {
        if (error.code === '23505') throw new Error('Ya tienes un torneo con ese nombre.');
        if (error.code === 'P0001') throw new Error(error.message);
        if (/operaciones por minuto/i.test(error.message || '')) throw new Error('Demasiadas operaciones seguidas. Espera un momento.');
        throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }
    return data;
}

const toRow = (t) => ({
    name: t.name.trim().replace(/\s+/g, ' '),
    location: t.location?.trim() || null,
    start_date: t.start_date || null,
    end_date: t.end_date || null,
    color: t.color || null,
    image: t.image || null,
});

export async function fetchTournaments() {
    return (await run(supabase.from('tournaments').select(COLUMNS).order('name'))) || [];
}

// Crea o actualiza el torneo. `matchNames` son los nombres exactos con que sus partidos lo
// guardan (pueden variar en mayúsculas/espacios): se unifican al nombre nuevo.
export async function saveTournament(t, { userId, matchNames = [] } = {}) {
    const row = toRow(t);
    const saved = t.id
        ? await run(supabase.from('tournaments').update(row).eq('id', t.id).select(COLUMNS).single())
        : await run(supabase.from('tournaments').insert([{ ...row, user_id: userId }]).select(COLUMNS).single());

    const toRename = matchNames.filter(n => n !== row.name);
    if (toRename.length && userId) {
        await run(supabase.from('matches').update({ tournament: row.name })
            .eq('user_id', userId).in('tournament', toRename));
    }
    return saved;
}

export async function deleteTournament(id) {
    await run(supabase.from('tournaments').delete().eq('id', id));
}

// Reduce la imagen a portada (máx. 1200 px de ancho, WebP/JPEG) para guardarla ligera.
export async function compressCover(file) {
    if (!file?.type?.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            el.src = url;
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const supportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        const type = supportsWebp ? 'image/webp' : 'image/jpeg';

        for (const maxW of [1200, 960, 720, 520]) {
            const scale = Math.min(1, maxW / img.naturalWidth);
            canvas.width = Math.round(img.naturalWidth * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            for (const q of [0.82, 0.7, 0.58]) {
                const data = canvas.toDataURL(type, q);
                if (data.length <= MAX_IMAGE_BYTES) return data;
            }
        }
        throw new Error('La imagen es demasiado pesada. Prueba con otra.');
    } finally {
        URL.revokeObjectURL(url);
    }
}
