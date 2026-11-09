// Scouting en video: clips a partir de las acciones que tienen `videoTime` (segundos del video).
//
// Las acciones registradas desde el video son acciones normales del partido (mismo formato que
// el tracker en vivo) con un campo extra `videoTime`. Así alimentan las Tendencias y el PDF
// sin cambios, y además se pueden ver como clips.
import { baseSkillOf } from './scoutingDetails';

// Segundos antes / después del momento marcado, por fundamento. En playa un rally es muy rápido
// (saque → recepción → armado → ataque en ~4 s): un margen único haría que el clip de un ataque
// empiece en el saque rival.
export const CLIP_MARGINS = {
    'Saque':     { pre: 1,   post: 3 },
    'Recepción': { pre: 2,   post: 2 },
    'Armado':    { pre: 1.5, post: 2 },
    'Ataque':    { pre: 2,   post: 2.5 },
    'Bloqueo':   { pre: 2,   post: 2 },
    'Defensa':   { pre: 2,   post: 2 },
};
const DEFAULT_MARGIN = { pre: 2, post: 2 };

export const hasVideoTime = (a) => !!a?.skill && Number.isFinite(a.videoTime);

export function clipBounds(action) {
    const m = CLIP_MARGINS[baseSkillOf(action.skill)] || DEFAULT_MARGIN;
    return { start: Math.max(0, action.videoTime - m.pre), end: action.videoTime + m.post };
}

// filters: { players, skills, outcomes, sets } — cada uno un Set; vacío = sin filtrar.
// `skills` usa el fundamento base (los tres tipos de ataque cuentan como "Ataque").
export function matchesFilters(action, filters, skip = null) {
    const pass = (key, value) => skip === key || !filters[key]?.size || filters[key].has(value);
    return pass('players', action.playerId)
        && pass('skills', baseSkillOf(action.skill))
        && pass('outcomes', action.outcome)
        && pass('sets', action.setIndex ?? 0);
}

export function filterClips(actions, filters) {
    return (actions || [])
        .filter(a => hasVideoTime(a) && matchesFilters(a, filters))
        .sort((a, b) => a.videoTime - b.videoTime);
}

// Duración total (s) de una lista de clips, para mostrar "12 clips · 0:48".
export function totalDuration(clips) {
    return clips.reduce((sum, a) => {
        const { start, end } = clipBounds(a);
        return sum + (end - start);
    }, 0);
}

export function fmtTime(t, withTenths = true) {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    const sec = withTenths ? s.toFixed(1).padStart(4, '0') : String(Math.floor(s)).padStart(2, '0');
    return `${String(m).padStart(2, '0')}:${sec}`;
}
