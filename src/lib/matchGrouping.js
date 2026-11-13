// Agrupación de partidos para "Mis partidos": por torneo y por mes.
import { normalizeName } from './tournamentsApi';

export const NO_TOURNAMENT_KEY = '__sin-torneo';

// Fecha del partido (YYYY-MM-DD). Si no tiene, la de creación.
export const matchDay = (m) => m.match_date || (m.created_at || '').slice(0, 10);

const byDayDesc = (a, b) =>
    matchDay(b).localeCompare(matchDay(a)) || (b.created_at || '').localeCompare(a.created_at || '');

const parseDay = (d) => new Date(`${d}T12:00:00`);

export function formatDay(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!d) return '—';
    return parseDay(d).toLocaleDateString('es-ES', opts).replace('.', '');
}

// "12 – 15 nov 2026", "28 oct – 2 nov 2026", "14 nov 2026"
export function formatRange(from, to) {
    if (!from) return '';
    if (!to || to === from) return formatDay(from);
    const a = parseDay(from), b = parseDay(to);
    const sameYear = a.getFullYear() === b.getFullYear();
    const sameMonth = sameYear && a.getMonth() === b.getMonth();
    const left = sameMonth
        ? a.getDate()
        : formatDay(from, sameYear ? { day: 'numeric', month: 'short' } : undefined);
    return `${left} – ${formatDay(to)}`;
}

// Iniciales para la portada sin imagen: "Copa Regional Lima 2026" → "CR"
export function monogram(name) {
    const words = (name || '').split(/\s+/).filter(w => w.length > 2 && !/^\d+$/.test(w));
    const src = words.length ? words : (name || '?').split(/\s+/);
    return src.slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

const PALETTE = ['#f97316', '#3b82f6', '#14b8a6', '#a855f7', '#eab308', '#ef4444', '#22c55e', '#ec4899'];
export const TOURNAMENT_COLORS = PALETTE;
export function colorFor(name, explicit) {
    if (explicit) return explicit;
    let h = 0;
    for (const c of normalizeName(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
}

// Agrupa los partidos por torneo, uniendo los datos guardados de cada torneo.
// Incluye torneos creados que aún no tienen partidos. "Sin torneo" queda al final.
export function groupByTournament(matches, tournaments = []) {
    const groups = new Map();
    const metaByKey = new Map(tournaments.map(t => [normalizeName(t.name), t]));

    const ensure = (key, name) => {
        if (!groups.has(key)) {
            groups.set(key, {
                key, name, meta: metaByKey.get(key) || null, matches: [], matchNames: new Set(),
                inProgress: 0, completed: 0, actions: 0, firstDay: null, lastDay: null,
            });
        }
        return groups.get(key);
    };

    for (const m of matches) {
        const key = normalizeName(m.tournament) || NO_TOURNAMENT_KEY;
        const g = ensure(key, key === NO_TOURNAMENT_KEY ? 'Sin torneo' : m.tournament.trim());
        g.matches.push(m);
        if (m.tournament) g.matchNames.add(m.tournament);
        if (m.status === 'completed') g.completed++; else g.inProgress++;
        g.actions += m.action_count ?? (m.actions?.filter(a => a.skill).length || 0);
        const d = matchDay(m);
        if (d && (!g.firstDay || d < g.firstDay)) g.firstDay = d;
        if (d && (!g.lastDay || d > g.lastDay)) g.lastDay = d;
    }
    for (const t of tournaments) ensure(normalizeName(t.name), t.name);

    const list = [...groups.values()].map(g => {
        g.matches.sort(byDayDesc);
        if (g.meta) g.name = g.meta.name;
        g.from = g.meta?.start_date || g.firstDay;
        g.to = g.meta?.end_date || g.lastDay;
        g.sortDay = g.lastDay || g.meta?.end_date || g.meta?.start_date || (g.meta?.updated_at || '').slice(0, 10);
        g.color = colorFor(g.name, g.meta?.color);
        return g;
    });

    return list.sort((a, b) => {
        if (a.key === NO_TOURNAMENT_KEY) return 1;
        if (b.key === NO_TOURNAMENT_KEY) return -1;
        return (b.sortDay || '').localeCompare(a.sortDay || '') || a.name.localeCompare(b.name);
    });
}

// Agrupa por mes ("noviembre 2026") y, dentro, por día descendente.
export function groupByMonth(matches) {
    const months = new Map();
    for (const m of [...matches].sort(byDayDesc)) {
        const d = matchDay(m);
        const key = d.slice(0, 7);
        if (!months.has(key)) {
            const label = d ? parseDay(d).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Sin fecha';
            months.set(key, { key, label, matches: [] });
        }
        months.get(key).matches.push(m);
    }
    return [...months.values()];
}

// Agrupa por día (dentro de un torneo).
export function groupByDay(matches) {
    const days = new Map();
    for (const m of [...matches].sort(byDayDesc)) {
        const d = matchDay(m);
        if (!days.has(d)) days.set(d, { key: d, label: formatDay(d, { weekday: 'long', day: 'numeric', month: 'long' }), matches: [] });
        days.get(d).matches.push(m);
    }
    return [...days.values()];
}

// Texto de búsqueda de un partido: equipos, jugadores, torneo, sede.
export function matchHaystack(m) {
    const players = [...(m.own_players || []), ...(m.opponent_players || [])].map(p => p?.name).join(' ');
    return normalizeName([m.own_team_name, m.opponent_team_name, players, m.tournament, m.location].join(' '))
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
}
export const normalizeQuery = (q) => normalizeName(q).normalize('NFD').replace(/[̀-ͯ]/g, '');
