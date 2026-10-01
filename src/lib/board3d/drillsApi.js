import { supabase } from '../supabase';

// "Mis ejercicios" en Supabase (tabla public.drills). La RLS limita cada fila a su dueño y
// solo deja crear/editar a usuarios PRO. Las llamadas llevan timeout para que la UI nunca
// se quede colgada si el cliente de Supabase no responde.

const TIMEOUT_MS = 12000;
const COLUMNS = 'id, name, category, notes, steps, updated_at';
const LEGACY_KEY = 'bva:pizarra3d:mis-ejercicios'; // versión anterior, solo en el navegador

function withTimeout(promise) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('El servidor tardó demasiado en responder.')), TIMEOUT_MS)),
    ]);
}

async function run(query) {
    const { data, error } = await withTimeout(query);
    if (error) {
        if (error.code === '42501') throw new Error('Guardar ejercicios en la nube es una función PRO.');
        if (error.code === 'P0001') throw new Error(error.message);
        throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }
    return data;
}

const fromRow = (r) => ({ key: r.id, name: r.name, category: r.category, notes: r.notes, steps: r.steps });
const toRow = (d) => ({ name: d.name, category: d.category, notes: d.notes || '', steps: d.steps });

export async function fetchDrills() {
    const rows = await run(supabase.from('drills').select(COLUMNS).order('category').order('name'));
    return rows.map(fromRow);
}

export async function createDrills(drills) {
    const rows = await run(supabase.from('drills').insert(drills.map(toRow)).select(COLUMNS));
    return rows.map(fromRow);
}

export async function updateDrill(key, drill) {
    const rows = await run(supabase.from('drills').update(toRow(drill)).eq('id', key).select(COLUMNS));
    if (!rows?.length) throw new Error('No se encontró el ejercicio.');
    return fromRow(rows[0]);
}

export async function deleteDrill(key) {
    await run(supabase.from('drills').delete().eq('id', key));
}

// Sube a la nube los ejercicios que quedaron guardados solo en este navegador (versión anterior).
export async function migrateLocalDrills() {
    let local;
    try { local = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); } catch { return []; }
    if (!Array.isArray(local) || local.length === 0) return [];
    const created = await createDrills(local.filter(d => d?.name && Array.isArray(d.steps)));
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* sin almacenamiento */ }
    return created;
}
