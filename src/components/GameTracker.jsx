import React, { useState, useRef } from 'react';
import { useMatches } from '../context/MatchContext';
import { SKILL_DETAILS, baseSkillOf } from '../lib/scoutingDetails';

// --- Constantes del Componente ---
const SKILLS = ['Saque', 'Recepción', 'Armado', 'Ataque', 'Bloqueo', 'Defensa'];

// Habilidades que requieren marcar posición en la cancha (inicio + fin)
const COURT_SKILLS = ['Ataque'];

// Símbolo → { nombre, descripción por fundamento }
const OUTCOMES = [
    { key: 'Doble Positivo', symbol: '#', label: 'Doble Positivo (#)' },
    { key: 'Positivo', symbol: '+', label: 'Positivo (+)' },
    { key: 'Overpass', symbol: '/', label: 'Overpass (/)' },
    { key: 'Negativo', symbol: '-', label: 'Negativo (-)' },
    { key: 'Doble Negativo', symbol: '=', label: 'Doble Negativo (=)' },
];

// Descripciones contextuales por fundamento y resultado
const OUTCOME_DESCRIPTIONS = {
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

const ATTACK_TYPES = [
    { key: 'Contundente', icon: '⚡', label: 'Contundente', sub: 'Remate potente', className: 'attack-type-contundente' },
    { key: 'Coloque', icon: '🎯', label: 'Coloque / Tiro', sub: 'Dirección y precisión', className: 'attack-type-coloque' },
    { key: '2 Toques', icon: '✌️', label: '2 Toques', sub: 'Pase directo al rival', className: 'attack-type-dos-toques' },
];

const SVG_WIDTH = 500, SVG_HEIGHT = 300, COURT_X_PADDING = 50, COURT_Y_PADDING = 50;
const COURT_WIDTH = SVG_WIDTH - 2 * COURT_X_PADDING, COURT_HEIGHT = SVG_HEIGHT - 2 * COURT_Y_PADDING;

// Fundamentos que dan punto directo al ejecutar con Doble Positivo.
const DIRECT_POSITIVE_SKILLS = ['Saque', 'Ataque', 'Bloqueo'];

/**
 * Única fuente de verdad del marcador: el score de cada set se DERIVA del log de acciones.
 * - Acciones de juego: Doble Positivo (Saque/Ataque/Bloqueo) y Doble Negativo (cualquiera) suman.
 * - Acciones de ajuste manual ({ type:'score_adjust' }): suman/restan el delta indicado (sin bajar de 0).
 * Reproducir el historial en orden hace que el marcador sea siempre consistente con deshacer/rehacer.
 */
function computeSetScores(actions, numSets, ownPlayerIds) {
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
function setTargetScore(setIndex, setsToWin) {
    const maxSets = setsToWin * 2 - 1;          // best-of-3 → 3 sets máximo
    const isTieBreak = setIndex === maxSets - 1; // el último set posible
    return isTieBreak ? 15 : 21;
}

// ¿Está terminado el set y quién lo ganó? Devuelve 'own' | 'opponent' | null.
// Un set se gana al alcanzar el objetivo (21/15) con ventaja mínima de 2 puntos.
function setWinner(setScore, setIndex, setsToWin) {
    const target = setTargetScore(setIndex, setsToWin);
    const { own, opponent } = setScore;
    if (own >= target && own >= opponent + 2) return 'own';
    if (opponent >= target && opponent >= own + 2) return 'opponent';
    return null;
}

// Marcador de SETS GANADOS derivado de los marcadores reales de cada set.
// Fuente de verdad única: evita que el contador de sets quede desincronizado de
// lo que realmente pasó en la cancha (bug: ganar 2 sets sin declararse ganador).
function computeSetsWon(derivedSets, setsToWin) {
    const won = { own: 0, opponent: 0 };
    derivedSets.forEach((s, i) => {
        const w = setWinner(s, i, setsToWin);
        if (w) won[w]++;
    });
    return won;
}

// --- Componente Principal ---
function GameTracker({ onFinishMatch }) {
    const { currentMatch, updateMatch, endCurrentMatch } = useMatches();
    const [activePlayerId, setActivePlayerId] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [attackType, setAttackType] = useState(null);
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    // Detalles opcionales del fundamento (p. ej. { tipoSaque: 'Flotante' }). Se limpian al registrar.
    const [actionDetails, setActionDetails] = useState({});
    // Complejo actual K1 / K2 — se actualiza automáticamente al registrar ciertas acciones
    const [currentComplex, setCurrentComplex] = useState(null);

    // Estado para el marcado en dos fases del ataque
    const [attackStartPos, setAttackStartPos] = useState(null);

    // Pasos a los que se desplaza la vista en móvil tras cada selección.
    const skillRef = useRef(null);
    const attackTypeRef = useRef(null);
    const outcomeRef = useRef(null);
    const courtRef = useRef(null);

    const currentSetIndex = currentMatch ? currentMatch.sets.length - 1 : 0;
    // El marcador del set actual se deriva del log de acciones (única fuente de verdad).
    const ownPlayerIds = currentMatch ? currentMatch.ownPlayers.map(p => p.id) : [];
    const derivedSets = currentMatch
        ? computeSetScores(currentMatch.actions, currentMatch.sets.length, ownPlayerIds)
        : [{ own: 0, opponent: 0 }];
    const currentSetScore = derivedSets[currentSetIndex] || { own: 0, opponent: 0 };

    // SETS GANADOS derivados de los marcadores reales de cada set (fuente de verdad única).
    // Así, en cuanto un equipo cierra su 2º set, el marcador y el fin de partido se
    // reflejan de inmediato, sin depender de un contador manual que puede desincronizarse.
    const setsWon = currentMatch
        ? computeSetsWon(derivedSets, currentMatch.setsToWin)
        : { own: 0, opponent: 0 };

    // El partido termina en cuanto un equipo gana `setsToWin` sets (2 en voleibol de playa).
    const isMatchOver = currentMatch
        ? (setsWon.own >= currentMatch.setsToWin || setsWon.opponent >= currentMatch.setsToWin)
        : false;
    const matchWinnerName = currentMatch
        ? (setsWon.own > setsWon.opponent ? currentMatch.ownTeamName : currentMatch.opponentTeamName)
        : '';

    if (!currentMatch) {
        return <div className="card">No hay ningún partido activo. Ve a "Nuevo Partido" para comenzar.</div>;
    }

    // Construye el estado a persistir a partir de un nuevo log de acciones.
    // Deriva sets, marcador de sets ganados y estado (completado/en progreso) de forma
    // consistente para que el ganador se declare en cuanto se cierra el set decisivo.
    const buildMatchState = (newActions, numSets) => {
        const newSets = computeSetScores(newActions, numSets, ownPlayerIds);
        const won = computeSetsWon(newSets, currentMatch.setsToWin);
        const over = won.own >= currentMatch.setsToWin || won.opponent >= currentMatch.setsToWin;
        return {
            ...currentMatch,
            actions: newActions,
            sets: newSets,
            score: won,
            status: over ? 'completed' : 'in_progress',
        };
    };

    /**
     * Registra una acción con posición opcional de inicio y fin (para ataques).
     */
    const registerAction = (startPos = null, endPos = null) => {
        // En modo scouting asumimos Ataque si no hay skill seleccionado.
        const skillToUse = currentMatch.matchType === 'scouting' ? 'Ataque' : selectedSkill;

        if (!activePlayerId || !skillToUse || !selectedOutcome) return;

        if (skillToUse === 'Ataque') {
            if (!attackType) {
                alert('Por favor, selecciona el tipo de ataque (Contundente, Coloque o 2 Toques).');
                return;
            }
            if (!startPos || !endPos) {
                alert('Para registrar un ataque, marca la posición de INICIO y FIN en la cancha.');
                return;
            }
        }

        const finalSkill = skillToUse === 'Ataque' ? `Ataque ${attackType}` : skillToUse;

        // --- Determinar el Complejo (K1 / K2) ---
        // Recepción: siempre inicia K1
        // Saque, Defensa, Bloqueo: siempre K2
        // Armado, Ataque: heredan el contexto activo
        // En modo scouting, el complejo no importa mucho, pero lo dejamos heredar.
        let complex = currentComplex;
        if (finalSkill === 'Recepción') {
            complex = 'K1';
        } else if (finalSkill === 'Saque' || finalSkill === 'Defensa' || finalSkill === 'Bloqueo') {
            complex = 'K2';
        }
        // Para Armado y Ataque, mantiene el complejo actual (null si no se ha definido aún)

        // Detalles opcionales de scouting (solo los que tengan valor seleccionado).
        const cleanDetail = Object.fromEntries(
            Object.entries(actionDetails).filter(([, v]) => v != null)
        );

        const newAction = {
            playerId: activePlayerId,
            skill: finalSkill,
            outcome: selectedOutcome,
            setIndex: currentSetIndex,
            complex,                              // ← K1 o K2
            timestamp: new Date().toISOString(),
            ...(Object.keys(cleanDetail).length > 0 && { detail: cleanDetail }),
            ...(startPos && { startX: startPos.x, startY: startPos.y }),
            ...(endPos && { x: endPos.x, y: endPos.y }),
        };

        // Actualizar el complejo activo para la próxima acción
        if (currentMatch.matchType !== 'scouting') {
            setCurrentComplex(complex);
        }

        const newActions = [...(currentMatch.actions || []), newAction];
        updateMatch(buildMatchState(newActions, currentMatch.sets.length));

        // Resetear selecciones
        setActivePlayerId(null);
        if (currentMatch.matchType !== 'scouting') {
            setSelectedSkill(null);
        }
        setAttackType(null);
        setSelectedOutcome(null);
        setAttackStartPos(null);
        setActionDetails({});
    };

    const handleCourtClick = (e) => {
        const skillToUse = currentMatch.matchType === 'scouting' ? 'Ataque' : selectedSkill;
        if (!activePlayerId || !skillToUse || !selectedOutcome) {
            alert('Por favor, selecciona jugador, fundamento y resultado antes de marcar.');
            return;
        }
        if (skillToUse !== 'Ataque') return;
        if (!attackType) {
            alert('Por favor, selecciona el tipo de ataque primero.');
            return;
        }

        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        if (!attackStartPos) {
            // Fase 1: marcar inicio
            setAttackStartPos({ x, y });
        } else {
            // Fase 2: marcar fin y registrar
            registerAction(attackStartPos, { x, y });
        }
    };

    // El ajuste manual se registra como una acción en el log → el marcador se deriva de ahí.
    // Así el ajuste sobrevive a recargas y se puede deshacer como cualquier otra acción.
    const handleScoreChange = (team, delta) => {
        const adjustAction = {
            type: 'score_adjust',
            team,
            delta,
            setIndex: currentSetIndex,
            timestamp: new Date().toISOString(),
        };
        const newActions = [...(currentMatch.actions || []), adjustAction];
        updateMatch(buildMatchState(newActions, currentMatch.sets.length));
    };

    // Deshacer = quitar la última acción (de juego o de ajuste) y recalcular el marcador.
    const handleUndo = () => {
        if (!currentMatch.actions || currentMatch.actions.length === 0) return;
        const newActions = currentMatch.actions.slice(0, -1);
        updateMatch(buildMatchState(newActions, currentMatch.sets.length));
    };

    // "Finalizar Set" ahora solo ABRE el siguiente set. El fin de partido (2 sets ganados)
    // se detecta automáticamente al cerrarse el set decisivo, no aquí.
    const handleFinishSet = () => {
        if (isMatchOver) {
            alert('El partido ya ha finalizado.');
            return;
        }

        const targetScore = setTargetScore(currentSetIndex, currentMatch.setsToWin);
        const winner = setWinner(currentSetScore, currentSetIndex, currentMatch.setsToWin);
        if (!winner) {
            alert(`Ningún equipo ha ganado el set. Un equipo debe alcanzar ${targetScore} puntos con ventaja de 2.`);
            return;
        }

        // El set actual está ganado pero el partido continúa → añadir el siguiente set
        // para que los nuevos puntos se registren allí. El marcador de sets se re-deriva.
        updateMatch(buildMatchState(currentMatch.actions, currentMatch.sets.length + 1));
    };

    // Helper: ¿el fundamento actual requiere marcado en cancha?
    const isScouting = currentMatch.matchType === 'scouting';
    const skillToUse = isScouting ? 'Ataque' : selectedSkill;
    const requiresCourt = skillToUse === 'Ataque';

    // Fundamento base para decidir qué detalles de scouting mostrar.
    // En modo scouting siempre se registra Ataque; en completo depende del fundamento elegido.
    const baseSkillForDetails = isScouting ? 'Ataque' : baseSkillOf(selectedSkill);
    const detailDims = baseSkillForDetails ? (SKILL_DETAILS[baseSkillForDetails] || []) : [];

    // Alternar una opción de detalle (volver a pulsar la deselecciona).
    const toggleDetail = (dimKey, option) => {
        setActionDetails(prev => ({
            ...prev,
            [dimKey]: prev[dimKey] === option ? undefined : option,
        }));
    };

    // En móvil (una sola columna) lleva a la vista el siguiente paso tras cada selección,
    // para no tener que hacer scroll a mano durante el scouting en vivo.
    // 'nearest' solo desplaza si el paso no está ya visible.
    const revealStep = (ref) => {
        if (!window.matchMedia('(max-width: 719px)').matches) return;
        requestAnimationFrame(() => {
            ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    const handleSelectPlayer = (id) => {
        setActivePlayerId(id);
        revealStep(isScouting ? attackTypeRef : skillRef);
    };

    const handleSelectSkill = (s) => {
        setSelectedSkill(s);
        setAttackType(null);
        setActionDetails({});
        setAttackStartPos(null);
        revealStep(s === 'Ataque' ? attackTypeRef : outcomeRef);
    };

    const handleSelectAttackType = (type) => {
        setAttackType(type);
        revealStep(outcomeRef);
    };

    const handleSelectOutcome = (key) => {
        setSelectedOutcome(key);
        if (requiresCourt) revealStep(courtRef);
    };

    const activePlayer = [...currentMatch.ownPlayers, ...(currentMatch.opponentPlayers || [])]
        .find(p => p.id === activePlayerId);
    const selectedOutcomeInfo = OUTCOMES.find(o => o.key === selectedOutcome);
    const baseSkillForDesc = skillToUse?.startsWith('Ataque') ? 'Ataque' : skillToUse;
    const selectedOutcomeDesc = selectedOutcome && baseSkillForDesc
        ? OUTCOME_DESCRIPTIONS[baseSkillForDesc]?.[selectedOutcome]
        : null;
    const skillSummary = requiresCourt ? `Ataque${attackType ? ` ${attackType}` : ''}` : selectedSkill;
    const canRegisterDirect = !requiresCourt && activePlayerId && selectedSkill && selectedOutcome && !isMatchOver;
    const currentSetHasWinner = !!setWinner(currentSetScore, currentSetIndex, currentMatch.setsToWin);

    // Qué falta para completar la acción (texto de ayuda en la barra inferior).
    let nextHint = null;
    if (!isMatchOver) {
        if (!activePlayerId) nextHint = 'Selecciona jugador';
        else if (!skillToUse) nextHint = 'Selecciona fundamento';
        else if (requiresCourt && !attackType) nextHint = 'Selecciona tipo de ataque';
        else if (!selectedOutcome) nextHint = 'Evalúa el resultado';
        else if (requiresCourt) nextHint = attackStartPos ? 'Marca el FINAL en la cancha' : 'Marca el INICIO en la cancha';
    }

    const stepDisabled = (cond) => (cond || isMatchOver ? 'disabled' : '');

    // --- Renderizado ---
    return (
        <div className="game-tracker">
            {/* Marcador compacto y fijo arriba: siempre visible mientras se registra */}
            <div className={`tracker-scorebar ${isMatchOver ? 'is-over' : ''}`}>
                <div className="sb-team">
                    <span className="sb-name" title={currentMatch.ownTeamName}>{currentMatch.ownTeamName}</span>
                    <div className="sb-controls">
                        <button onClick={() => handleScoreChange('own', -1)} disabled={isMatchOver} aria-label="Restar punto propio">−</button>
                        <span className="sb-points">{currentSetScore.own}</span>
                        <button onClick={() => handleScoreChange('own', 1)} disabled={isMatchOver} aria-label="Sumar punto propio">+</button>
                    </div>
                </div>
                <div className="sb-center">
                    <span className="sb-set">Set {currentSetIndex + 1}</span>
                    <span className="sb-sets">{setsWon.own} – {setsWon.opponent}</span>
                    {currentSetHasWinner && !isMatchOver && (
                        <button className="sb-next-set" onClick={handleFinishSet}>Siguiente set →</button>
                    )}
                </div>
                <div className="sb-team">
                    <span className="sb-name" title={currentMatch.opponentTeamName}>{currentMatch.opponentTeamName}</span>
                    <div className="sb-controls">
                        <button onClick={() => handleScoreChange('opponent', -1)} disabled={isMatchOver} aria-label="Restar punto rival">−</button>
                        <span className="sb-points">{currentSetScore.opponent}</span>
                        <button onClick={() => handleScoreChange('opponent', 1)} disabled={isMatchOver} aria-label="Sumar punto rival">+</button>
                    </div>
                </div>
            </div>

            {isMatchOver && (
                <div className="card match-over-banner">
                    <h3>Partido Finalizado</h3>
                    <p>Ganador: {matchWinnerName}</p>
                </div>
            )}

            <div className="tracker-grid">
                <div className="tracker-col">
                    {/* PASO 1: Jugador */}
                    <div className={`card tracker-step ${stepDisabled(false)}`}>
                        <h4>1. Jugador</h4>
                        <div className="player-teams">
                            <div>
                                <h5>{currentMatch.ownTeamName}</h5>
                                <div className="button-group">
                                    {currentMatch.ownPlayers.map(p => (
                                        <button key={p.id} onClick={() => handleSelectPlayer(p.id)} className={activePlayerId === p.id ? 'active' : ''}>{p.name}</button>
                                    ))}
                                </div>
                            </div>
                            {currentMatch.opponentPlayers && (
                                <div>
                                    <h5>{currentMatch.opponentTeamName}</h5>
                                    <div className="button-group">
                                        {currentMatch.opponentPlayers.map(p => (
                                            <button key={p.id} onClick={() => handleSelectPlayer(p.id)} className={activePlayerId === p.id ? 'active' : ''}>{p.name}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PASO 2: Fundamento (Oculto en modo scouting) */}
                    {!isScouting && (
                        <div ref={skillRef} className={`card tracker-step ${stepDisabled(!activePlayerId)}`}>
                            <h4>2. Fundamento</h4>
                            <div className="skill-grid">
                                {SKILLS.map(s => (
                                    <button key={s} onClick={() => handleSelectSkill(s)} disabled={!activePlayerId} className={selectedSkill === s ? 'active' : ''}>{s}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PASO 2.a: Tipo de Ataque (solo si aplica o en modo scouting) */}
                    {requiresCourt && (
                        <div ref={attackTypeRef} className={`card tracker-step ${stepDisabled(false)}`}>
                            <h4>2.a. Tipo de ataque</h4>
                            <div className="attack-type-group">
                                {ATTACK_TYPES.map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => handleSelectAttackType(t.key)}
                                        className={`attack-type-btn ${t.className} ${attackType === t.key ? 'active' : ''}`}
                                    >
                                        <span className="attack-type-icon">{t.icon}</span>
                                        <span className="attack-type-label">{t.label}</span>
                                        <span className="attack-type-sub">{t.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PASO 2.b: Detalles del fundamento (opcional, según el fundamento activo) */}
                    {detailDims.length > 0 && (
                        <div className={`card tracker-step ${stepDisabled(!skillToUse)}`}>
                            <h4>
                                2.b. Detalles <span className="step-optional">(opcional)</span>
                            </h4>
                            {detailDims.map(dim => (
                                <div key={dim.key} className="detail-dimension">
                                    <h5>{dim.label}</h5>
                                    <div className="button-group">
                                        {dim.options.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => toggleDetail(dim.key, opt)}
                                                className={actionDetails[dim.key] === opt ? 'active' : ''}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="tracker-col">
                    {/* PASO 3: Resultado */}
                    <div ref={outcomeRef} className={`card tracker-step ${stepDisabled(!skillToUse)}`}>
                        <h4>3. Resultado</h4>
                        <div className="outcomes-grid">
                            {OUTCOMES.map(({ key, symbol }) => {
                                const description = baseSkillForDesc && OUTCOME_DESCRIPTIONS[baseSkillForDesc]
                                    ? OUTCOME_DESCRIPTIONS[baseSkillForDesc][key]
                                    : '';
                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleSelectOutcome(key)}
                                        disabled={!skillToUse}
                                        title={description}
                                        className={`outcome-btn outcome-${key.toLowerCase().replace(' ', '-')} ${selectedOutcome === key ? 'active' : ''}`}
                                    >
                                        <span className="outcome-symbol">{symbol}</span>
                                        <span className="outcome-name">{key}</span>
                                        {description && <span className="outcome-desc">{description}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        {/* En pantallas chicas las descripciones se ocultan: se muestra solo la elegida */}
                        {selectedOutcomeDesc && (
                            <p className="outcome-selected-desc">{selectedOutcomeInfo?.symbol} {selectedOutcomeDesc}</p>
                        )}
                    </div>

                    {/* PASO 4 (solo ataque): marcar inicio y fin en la cancha → registra solo */}
                    {requiresCourt && (
                        <div ref={courtRef} className={`card tracker-step ${stepDisabled(!selectedOutcome)}`}>
                            <div className="court-step-header">
                                <h4>4. Cancha</h4>
                                <div className="attack-phase-indicator">
                                    <span className={`phase-step ${!attackStartPos ? 'phase-active' : 'phase-done'}`}>① Inicio</span>
                                    <span className={`phase-step ${attackStartPos ? 'phase-active' : ''}`}>② Final</span>
                                </div>
                            </div>

                            <div className="court-container">
                                <svg
                                    viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                                    className="volleyball-court"
                                    onClick={handleCourtClick}
                                    style={{ cursor: attackType && selectedOutcome ? 'crosshair' : 'not-allowed' }}
                                >
                                    {/* Fondo */}
                                    <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="#fdf6e3" />
                                    {/* Cancha */}
                                    <rect x={COURT_X_PADDING} y={COURT_Y_PADDING} width={COURT_WIDTH} height={COURT_HEIGHT} fill="#ffe8a1" stroke="#6d6d72" strokeWidth="1" />
                                    {/* Red central */}
                                    <line x1={SVG_WIDTH / 2} y1={COURT_Y_PADDING} x2={SVG_WIDTH / 2} y2={COURT_Y_PADDING + COURT_HEIGHT} stroke="#6d6d72" strokeWidth="2" strokeDasharray="4" />

                                    {/* Marcador de INICIO (punto azul con "S") */}
                                    {attackStartPos && (
                                        <g transform={`translate(${attackStartPos.x * SVG_WIDTH}, ${attackStartPos.y * SVG_HEIGHT})`}>
                                            <circle r="12" fill="#007aff" stroke="white" strokeWidth="2" opacity="0.9" />
                                            <text textAnchor="middle" dy=".35em" style={{ fontSize: '10px', fill: 'white', fontWeight: 'bold' }}>S</text>
                                        </g>
                                    )}

                                    {/* Flecha de trayectoria desde el inicio (solo hay inicio) */}
                                    {attackStartPos && (
                                        <line
                                            x1={attackStartPos.x * SVG_WIDTH}
                                            y1={attackStartPos.y * SVG_HEIGHT}
                                            x2={attackStartPos.x * SVG_WIDTH + 40}
                                            y2={attackStartPos.y * SVG_HEIGHT}
                                            stroke="#007aff"
                                            strokeWidth="2"
                                            strokeDasharray="6 3"
                                            opacity="0.5"
                                        />
                                    )}
                                </svg>
                            </div>

                            {attackStartPos && (
                                <div className="court-cancel">
                                    <button onClick={() => setAttackStartPos(null)}>✕ Volver a marcar inicio</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Controles de set/partido (poco frecuentes, no necesitan estar fijos) */}
                    <div className="card tracker-step tracker-controls">
                        <div className="button-group">
                            <button onClick={handleFinishSet} disabled={isMatchOver}>Finalizar Set</button>
                            <button
                                onClick={() => onFinishMatch ? onFinishMatch() : endCurrentMatch()}
                                className="btn-primary"
                                style={{ background: isMatchOver ? 'var(--c-pos)' : undefined }}
                            >
                                {isMatchOver ? '✓ Guardar y salir' : 'Finalizar Partido'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barra de acción fija abajo: resumen + Deshacer + Registrar al alcance del pulgar */}
            <div className="tracker-actionbar">
                <div className="ab-summary">
                    {/* Solo lo ya elegido; lo que falta lo indica el texto de ayuda */}
                    {activePlayer && (
                        <div className="ab-chips">
                            <span className="ab-chip is-set">{activePlayer.name}</span>
                            {skillSummary && <span className="ab-chip is-set">{skillSummary}</span>}
                            {selectedOutcomeInfo && (
                                <span className={`ab-chip is-set ab-outcome-${selectedOutcome.toLowerCase().replace(' ', '-')}`}>
                                    {selectedOutcomeInfo.symbol}
                                </span>
                            )}
                        </div>
                    )}
                    {nextHint && <span className="ab-hint">{nextHint}</span>}
                </div>
                <div className="ab-buttons">
                    {/* Deshacer siempre disponible: permite corregir el último punto aunque
                        haya cerrado el partido (p. ej. un marcado por error). */}
                    <button className="ab-undo" onClick={handleUndo} disabled={!currentMatch.actions?.length} aria-label="Deshacer última acción">↩<span className="ab-btn-text"> Deshacer</span></button>
                    {!requiresCourt && (
                        <button className="btn-primary ab-register" onClick={() => registerAction()} disabled={!canRegisterDirect}>
                            ✓ Registrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GameTracker;
