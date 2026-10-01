import { POSES } from './poses';

// Utilidades de ejercicios y pasos de la pizarra 3D.
// Un ejercicio es { key, name, category, notes, steps: [{ items }] }. Los del usuario se
// guardan en Supabase (ver drillsApi.js) y se pueden exportar/importar como .json para
// compartir una versión editable con otros entrenadores.

const FILE_TYPE = 'bva-pizarra3d-ejercicios';
const MAX_DRILLS = 300, MAX_STEPS = 30, MAX_ITEMS = 40;
export const BALL_GROUND = 0.11;

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

// Los ejercicios incluidos de un solo paso usan `items`; los de varios pasos, `steps`.
export const drillSteps = (drill) => drill.steps ?? [{ items: drill.items }];

// Estado final de un elemento tras su movimiento: punto de partida del paso siguiente.
export function endState(it) {
    if (!it.to) return it;
    const { to, ...rest } = it;
    return { ...rest, x: to.x, z: to.z, ...(it.kind === 'ball' && { y: to.y ?? BALL_GROUND }) };
}

// Crea los pasos de una escena a partir de un ejercicio. El mismo elemento conserva el
// mismo id en todos los pasos (con `ref` en los incluidos) para poder animar entre pasos.
export function instantiate(drill, labelFor) {
    const ids = new Map();
    const idOf = (key) => {
        if (!ids.has(key)) ids.set(key, newId());
        return ids.get(key);
    };
    return drillSteps(drill).map((step, s) => ({
        id: newId(),
        items: step.items.map((it, i) => {
            const { ref, ...rest } = it;
            return {
                ...rest,
                id: idOf(ref ?? it.id ?? `${s}-${i}`),
                ...(it.kind === 'player' && { label: it.label ?? labelFor(it.team, it.slot ?? 0) }),
            };
        }),
    }));
}

// --- Validación de lo importado (el archivo puede venir de cualquier parte) ---
const num = (v, min, max, def) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanItem(it) {
    if (!it || typeof it !== 'object') return null;
    const base = { id: str(it.id, 40) || newId(), x: num(it.x, -13, 13, 0), z: num(it.z, -9, 9, 0) };
    if (it.kind === 'player') {
        const to = it.to && { x: num(it.to.x, -13, 13, base.x), z: num(it.to.z, -9, 9, base.z) };
        return {
            ...base, kind: 'player',
            team: ['A', 'B', 'C'].includes(it.team) ? it.team : 'A',
            slot: num(it.slot, 0, 9, 0),
            ...(str(it.label, 4).trim() && { label: str(it.label, 4).trim() }), // sin etiqueta: se asigna al cargar
            rot: num(it.rot, -180, 180, base.x < 0 ? 90 : -90),
            pose: POSES[it.pose] ? it.pose : 'standing',
            ...(to && { to }),
        };
    }
    if (it.kind === 'ball') {
        const to = it.to && {
            x: num(it.to.x, -13, 13, 0), z: num(it.to.z, -9, 9, 0),
            y: num(it.to.y, BALL_GROUND, 3.5, BALL_GROUND), peak: num(it.to.peak, 0, 7, 2),
        };
        return { ...base, kind: 'ball', y: num(it.y, BALL_GROUND, 4, 1), ...(to && { to }) };
    }
    if (it.kind === 'cone') return { ...base, kind: 'cone' };
    return null;
}

function cleanDrill(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.steps)) return null;
    const steps = d.steps.slice(0, MAX_STEPS)
        .map(s => ({ items: (Array.isArray(s?.items) ? s.items : []).slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean) }));
    if (steps.length === 0) return null;
    return {
        key: newId(),
        name: str(d.name, 60).trim() || 'Ejercicio importado',
        category: str(d.category, 40).trim() || 'Mis ejercicios',
        notes: str(d.notes, 3000),
        steps,
    };
}

export function downloadDrills(drills, fileName) {
    const data = {
        type: FILE_TYPE, version: 1,
        drills: drills.map(({ name, category, notes, steps }) => ({ name, category, notes, steps })),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `${fileName}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Devuelve los ejercicios válidos del archivo o lanza un Error con un mensaje para el usuario.
export function parseDrillsFile(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido.'); }
    if (data?.type !== FILE_TYPE || !Array.isArray(data.drills)) {
        throw new Error('El archivo no contiene ejercicios de la pizarra 3D.');
    }
    const drills = data.drills.slice(0, MAX_DRILLS).map(cleanDrill).filter(Boolean);
    if (drills.length === 0) throw new Error('No se encontró ningún ejercicio válido en el archivo.');
    return drills;
}
