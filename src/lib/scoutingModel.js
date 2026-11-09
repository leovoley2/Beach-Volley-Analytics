// Modelo compartido del scouting: fundamentos, resultados y marcador derivado del log de acciones.
// Lo usan el tracker en vivo (GameTracker) y el scouting en video (VideoScout), para que
// ambos registren acciones con el mismo formato y el marcador se calcule igual.
export const SKILLS = ['Saque', 'Recepción', 'Armado', 'Ataque', 'Bloqueo', 'Defensa'];

// Habilidades que requieren marcar posición en la cancha (inicio + fin)
export const COURT_SKILLS = ['Ataque'];

// Símbolo → { nombre, descripción por fundamento }
export const OUTCOMES = [
    { key: 'Doble Positivo', symbol: '#', label: 'Doble Positivo (#)' },
    { key: 'Positivo', symbol: '+', label: 'Positivo (+)' },
    { key: 'Overpass', symbol: '/', label: 'Overpass (/)' },
    { key: 'Negativo', symbol: '-', label: 'Negativo (-)' },
    { key: 'Doble Negativo', symbol: '=', label: 'Doble Negativo (=)' },
];

// Descripciones contextuales por fundamento y resultado
export const OUTCOME_DESCRIPTIONS = {
    'Saque': {
        'Doble Positivo': 'Punto directo (ACE)',
        'Positivo': 'Complica la recepción del rival',
        'Overpass': 'La recepción del rival pasa directo al otro campo',
        'Negativo': 'Saque fácil para el rival',
        'Doble Negativo': 'Error → punto para el rival',
    },
    'Recepción': {
        'Doble Positivo': 'Perfecta – todas las opciones al armador',
        'Positivo': 'Buena – al menos 2 opciones',
        'Overpass': 'La bola pasa directo al otro campo',
        'Negativo': 'Mala – fuera de la zona de 3 metros',
        'Doble Negativo': 'Error → punto para el rival',
    },
    'Armado': {
        'Doble Positivo': 'El atacante queda sin bloqueo',
        'Positivo': 'El atacante queda con 1 bloqueo',
        'Overpass': 'Por impresión, la bola pasa al campo contrario',
        'Negativo': 'Bola pegada / baja / complicada para el atacante',
        'Doble Negativo': 'Error (doble, retención) → punto para el rival',
    },
    'Ataque': {
        'Doble Positivo': 'Punto directo',
        'Positivo': 'Complica la defensa del rival',
        'Overpass': 'Bloqueado – bola continúa en campo rival',
        'Negativo': 'Defendido fácil por el rival',
        'Doble Negativo': 'Error → punto para el rival',
    },
    'Bloqueo': {
        'Doble Positivo': 'Punto directo',
        'Positivo': 'Frena el ataque – defensa positiva en campo propio',
        'Overpass': 'Falta detenida por el árbitro (red, invasión)',
        'Negativo': 'La bola continúa en campo rival',
        'Doble Negativo': 'Error (blockout) → punto para el rival',
    },
    'Defensa': {
        'Doble Positivo': 'Todas las opciones de distribución',
        'Positivo': 'Al menos 2 opciones de distribución',
        'Overpass': 'Al defendir, la bola pasa al otro campo',
        'Negativo': 'Mala – fuera de la zona de 3 metros',
        'Doble Negativo': 'Error → punto para el rival',
    },
};

export const ATTACK_TYPES = [
    { key: 'Contundente', icon: '⚡', label: 'Contundente', sub: 'Remate potente', className: 'attack-type-contundente' },
    { key: 'Coloque', icon: '🎯', label: 'Coloque / Tiro', sub: 'Dirección y precisión', className: 'attack-type-coloque' },
    { key: '2 Toques', icon: '✌️', label: '2 Toques', sub: 'Pase directo al rival', className: 'attack-type-dos-toques' },
];


// Fundamentos que dan punto directo al ejecutar con Doble Positivo.
export const DIRECT_POSITIVE_SKILLS = ['Saque', 'Ataque', 'Bloqueo'];

/**
 * Única fuente de verdad del marcador: el score de cada set se DERIVA del log de acciones.
 * - Acciones de juego: Doble Positivo (Saque/Ataque/Bloqueo) y Doble Negativo (cualquiera) suman.
 * - Acciones de ajuste manual ({ type:'score_adjust' }): suman/restan el delta indicado (sin bajar de 0).
 * Reproducir el historial en orden hace que el marcador sea siempre consistente con deshacer/rehacer.
 */
export function computeSetScores(actions, numSets, ownPlayerIds) {
    const scores = Array.from({ length: Math.max(numSets, 1) }, () => ({ own: 0, opponent: 0 }));
    for (const a of actions || []) {
        const si = a.setIndex ?? 0;
        if (si < 0 || si >= scores.length) continue;

        if (a.type === 'score_adjust') {
            scores[si][a.team] = Math.max(0, scores[si][a.team] + a.delta);
            continue;
        }

        const isOwn = ownPlayerIds.includes(a.playerId);
        const baseSkill = a.skill?.startsWith('Ataque') ? 'Ataque' : a.skill;
        if (DIRECT_POSITIVE_SKILLS.includes(baseSkill) && a.outcome === 'Doble Positivo') {
            if (isOwn) { scores[si].own++; } else { scores[si].opponent++; }
        }
        if (a.outcome === 'Doble Negativo') {
            if (isOwn) { scores[si].opponent++; } else { scores[si].own++; }
        }
    }
    return scores;
}

// Puntos necesarios para ganar un set. El último set posible (tiebreak) es a 15; el resto a 21.
export function setTargetScore(setIndex, setsToWin) {
    const maxSets = setsToWin * 2 - 1;          // best-of-3 → 3 sets máximo
    const isTieBreak = setIndex === maxSets - 1; // el último set posible
    return isTieBreak ? 15 : 21;
}

// ¿Está terminado el set y quién lo ganó? Devuelve 'own' | 'opponent' | null.
// Un set se gana al alcanzar el objetivo (21/15) con ventaja mínima de 2 puntos.
export function setWinner(setScore, setIndex, setsToWin) {
    const target = setTargetScore(setIndex, setsToWin);
    const { own, opponent } = setScore;
    if (own >= target && own >= opponent + 2) return 'own';
    if (opponent >= target && opponent >= own + 2) return 'opponent';
    return null;
}

// Marcador de SETS GANADOS derivado de los marcadores reales de cada set.
// Fuente de verdad única: evita que el contador de sets quede desincronizado de
// lo que realmente pasó en la cancha (bug: ganar 2 sets sin declararse ganador).
export function computeSetsWon(derivedSets, setsToWin) {
    const won = { own: 0, opponent: 0 };
    derivedSets.forEach((s, i) => {
        const w = setWinner(s, i, setsToWin);
        if (w) won[w]++;
    });
    return won;
}

// Estado a persistir a partir de un nuevo log de acciones: deriva sets, sets ganados y estado
// (completado / en progreso) para que el ganador se declare en cuanto se cierra el set decisivo.
export function buildMatchState(match, newActions, numSets) {
    const ownPlayerIds = (match.ownPlayers || []).map(p => p.id);
    const sets = computeSetScores(newActions, numSets, ownPlayerIds);
    const won = computeSetsWon(sets, match.setsToWin);
    const over = won.own >= match.setsToWin || won.opponent >= match.setsToWin;
    return {
        ...match,
        actions: newActions,
        sets,
        score: won,
        status: over ? 'completed' : 'in_progress',
    };
}

// Complejo (K1 / K2) de una acción: la recepción abre K1; saque, defensa y bloqueo son K2;
// armado y ataque heredan el complejo de la jugada en curso (`inherited`).
export function complexFor(skill, inherited = null) {
    if (skill === 'Recepción') return 'K1';
    if (skill === 'Saque' || skill === 'Defensa' || skill === 'Bloqueo') return 'K2';
    return inherited;
}
