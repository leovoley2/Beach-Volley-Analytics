import React, { useState, useEffect } from 'react';
import { useMatches } from '../context/MatchContext';

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

const SVG_WIDTH = 500, SVG_HEIGHT = 300, COURT_X_PADDING = 50, COURT_Y_PADDING = 50;
const COURT_WIDTH = SVG_WIDTH - 2 * COURT_X_PADDING, COURT_HEIGHT = SVG_HEIGHT - 2 * COURT_Y_PADDING;

// --- Componente Principal ---
function GameTracker() {
    const { currentMatch, updateMatch, endCurrentMatch } = useMatches();
    const [activePlayerId, setActivePlayerId] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [attackType, setAttackType] = useState(null);
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    // Complejo actual K1 / K2 — se actualiza automáticamente al registrar ciertas acciones
    const [currentComplex, setCurrentComplex] = useState(null);

    // Estado para el marcado en dos fases del ataque
    const [attackStartPos, setAttackStartPos] = useState(null);
    const [attackPhase, setAttackPhase] = useState(null); // 'start' | 'end' | null

    const currentSetIndex = currentMatch ? currentMatch.sets.length - 1 : 0;
    const currentSetScore = currentMatch ? currentMatch.sets[currentSetIndex] : { own: 0, opponent: 0 };

    // Derivado del estado real del partido: no depende de estado local para evitar desfases
    const isMatchOver = currentMatch
        ? (currentMatch.score.own >= currentMatch.setsToWin || currentMatch.score.opponent >= currentMatch.setsToWin)
        : false;

    if (!currentMatch) {
        return <div className="card">No hay ningún partido activo. Ve a "Nuevo Partido" para comenzar.</div>;
    }

    // --- Lógica de Puntuación centralizada ---
    const calculateScore = (skill, outcome, isOwnPlayer, setScore) => {
        const newScore = { ...setScore };
        const baseSkill = skill.startsWith('Ataque') ? 'Ataque' : skill;

        // Doble Positivo: punto para el equipo que ejecuta (solo en Saque, Ataque, Bloqueo)
        const DIRECT_POSITIVE_SKILLS = ['Saque', 'Ataque', 'Bloqueo'];
        if (DIRECT_POSITIVE_SKILLS.includes(baseSkill) && outcome === 'Doble Positivo') {
            if (isOwnPlayer) { newScore.own++; } else { newScore.opponent++; }
        }

        // Doble Negativo: punto siempre para el equipo RIVAL (cualquier fundamento)
        if (outcome === 'Doble Negativo') {
            if (isOwnPlayer) { newScore.opponent++; } else { newScore.own++; }
        }

        return newScore;
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
                alert('Por favor, selecciona el tipo de ataque (Contundente o Coloque).');
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

        const newAction = {
            playerId: activePlayerId,
            skill: finalSkill,
            outcome: selectedOutcome,
            setIndex: currentSetIndex,
            complex,                              // ← K1 o K2
            timestamp: new Date().toISOString(),
            ...(startPos && { startX: startPos.x, startY: startPos.y }),
            ...(endPos && { x: endPos.x, y: endPos.y }),
        };

        // Actualizar el complejo activo para la próxima acción
        if (currentMatch.matchType !== 'scouting') {
            setCurrentComplex(complex);
        }

        const isOwnPlayer = currentMatch.ownPlayers.some(p => p.id === activePlayerId);
        const newSets = [...currentMatch.sets];
        newSets[currentSetIndex] = calculateScore(newAction.skill, selectedOutcome, isOwnPlayer, newSets[currentSetIndex]);

        updateMatch({
            ...currentMatch,
            actions: [...(currentMatch.actions || []), newAction],
            sets: newSets,
        });

        // Resetear selecciones
        setActivePlayerId(null);
        if (currentMatch.matchType !== 'scouting') {
            setSelectedSkill(null);
        }
        setAttackType(null);
        setSelectedOutcome(null);
        setAttackStartPos(null);
        setAttackPhase(null);
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
            setAttackPhase('end');
        } else {
            // Fase 2: marcar fin y registrar
            registerAction(attackStartPos, { x, y });
        }
    };

    const handleScoreChange = (team, delta) => {
        const newSets = [...currentMatch.sets];
        const newCurrentSetScore = { ...newSets[currentSetIndex] };
        newCurrentSetScore[team] = Math.max(0, newCurrentSetScore[team] + delta);
        newSets[currentSetIndex] = newCurrentSetScore;
        updateMatch({ ...currentMatch, sets: newSets });
    };

    const handleUndo = () => {
        if (!currentMatch.actions || currentMatch.actions.length === 0) return;

        const lastAction = currentMatch.actions.slice(-1)[0];
        const newActions = currentMatch.actions.slice(0, -1);
        const wasOwnPlayer = currentMatch.ownPlayers.some(p => p.id === lastAction.playerId);

        // BUG FIX: revert the score in the set where the action was actually recorded
        const actionSetIndex = lastAction.setIndex ?? currentSetIndex;
        const newSets = [...currentMatch.sets];
        const prevScore = { ...newSets[actionSetIndex] };
        const baseSkill = lastAction.skill.startsWith('Ataque') ? 'Ataque' : lastAction.skill;
        const DIRECT_POSITIVE_SKILLS = ['Saque', 'Ataque', 'Bloqueo'];

        // Revertir Doble Positivo
        if (DIRECT_POSITIVE_SKILLS.includes(baseSkill) && lastAction.outcome === 'Doble Positivo') {
            if (wasOwnPlayer) { prevScore.own = Math.max(0, prevScore.own - 1); }
            else { prevScore.opponent = Math.max(0, prevScore.opponent - 1); }
        }
        // Revertir Doble Negativo (cualquier fundamento)
        if (lastAction.outcome === 'Doble Negativo') {
            if (wasOwnPlayer) { prevScore.opponent = Math.max(0, prevScore.opponent - 1); }
            else { prevScore.own = Math.max(0, prevScore.own - 1); }
        }

        newSets[actionSetIndex] = prevScore;
        updateMatch({ ...currentMatch, actions: newActions, sets: newSets });
    };

    const handleFinishSet = () => {
        // BUG FIX: don't allow finishing a set if the match is already over
        if (isMatchOver) {
            alert('El partido ya ha finalizado.');
            return;
        }

        const { own, opponent } = currentSetScore;
        // Tiebreak is the last possible set (setsToWin * 2 - 1), e.g. set 3 in best-of-3
        const maxSets = currentMatch.setsToWin * 2 - 1;
        const isTieBreak = currentSetIndex === maxSets - 1;
        const targetScore = isTieBreak ? 15 : 21;

        const ownWinsSet = own >= targetScore && own >= opponent + 2;
        const opponentWinsSet = opponent >= targetScore && opponent >= own + 2;

        if (!ownWinsSet && !opponentWinsSet) {
            alert(`Ningún equipo ha ganado el set. Un equipo debe alcanzar ${targetScore} puntos con ventaja de 2.`);
            return;
        }

        const newScore = { ...currentMatch.score };
        if (ownWinsSet) { newScore.own++; } else { newScore.opponent++; }

        const ownWinsMatch = newScore.own === currentMatch.setsToWin;
        const opponentWinsMatch = newScore.opponent === currentMatch.setsToWin;

        if (ownWinsMatch || opponentWinsMatch) {
            updateMatch({ ...currentMatch, score: newScore });
            alert(`¡Partido finalizado! Ganador: ${ownWinsMatch ? currentMatch.ownTeamName : currentMatch.opponentTeamName}`);
        } else {
            const newSets = [...currentMatch.sets, { own: 0, opponent: 0 }];
            updateMatch({ ...currentMatch, score: newScore, sets: newSets });
        }
    };

    // Helper: ¿el fundamento actual requiere marcado en cancha?
    const requiresCourt = selectedSkill === 'Ataque';

    // --- Renderizado ---
    return (
        <div className="game-tracker">
            {/* Marcador de Sets Ganados */}
            <div className="card scoreboard-sets">
                <h4>Sets Ganados</h4>
                <div className="team-score">
                    <h3>{currentMatch.ownTeamName}</h3>
                    <span>{currentMatch.score.own}</span>
                </div>
                <div className="team-score">
                    <h3>{currentMatch.opponentTeamName}</h3>
                    <span>{currentMatch.score.opponent}</span>
                </div>
            </div>

            {/* Marcador del Set Actual */}
            <div className={`card scoreboard ${isMatchOver ? 'disabled' : ''}`}>
                <h4>Set Actual (Set {currentSetIndex + 1})</h4>
                <div className="team-score">
                    <h3>{currentMatch.ownTeamName}</h3>
                    <div className="score-controls">
                        <button onClick={() => handleScoreChange('own', -1)}>-</button>
                        <span>{currentSetScore.own}</span>
                        <button onClick={() => handleScoreChange('own', 1)}>+</button>
                    </div>
                </div>
                <div className="team-score">
                    <h3>{currentMatch.opponentTeamName}</h3>
                    <div className="score-controls">
                        <button onClick={() => handleScoreChange('opponent', -1)}>-</button>
                        <span>{currentSetScore.opponent}</span>
                        <button onClick={() => handleScoreChange('opponent', 1)}>+</button>
                    </div>
                </div>
            </div>

            {isMatchOver && (
                <div className="card match-over-banner">
                    <h3>Partido Finalizado</h3>
                    <p>Ganador: {currentMatch.score.own > currentMatch.score.opponent ? currentMatch.ownTeamName : currentMatch.opponentTeamName}</p>
                </div>
            )}

            {/* PASO 1: Jugador */}
            <div className={`card ${isMatchOver ? 'disabled' : ''}`}>
                <h4>1. Selecciona Jugador</h4>
                <h5>{currentMatch.ownTeamName}</h5>
                <div className="button-group">
                    {currentMatch.ownPlayers.map(p => (
                        <button key={p.id} onClick={() => setActivePlayerId(p.id)} className={activePlayerId === p.id ? 'active' : ''}>{p.name}</button>
                    ))}
                </div>
                {currentMatch.opponentPlayers && (
                    <>
                        <h5 style={{ marginTop: '1rem' }}>{currentMatch.opponentTeamName}</h5>
                        <div className="button-group">
                            {currentMatch.opponentPlayers.map(p => (
                                <button key={p.id} onClick={() => setActivePlayerId(p.id)} className={activePlayerId === p.id ? 'active' : ''}>{p.name}</button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* PASO 2: Fundamento (Oculto en modo scouting) */}
            {currentMatch.matchType !== 'scouting' && (
                <div className={`card ${!activePlayerId || isMatchOver ? 'disabled' : ''}`}>
                    <h4>2. Selecciona Fundamento</h4>
                    <div className="button-grid">
                        {SKILLS.map(s => (
                            <button key={s} onClick={() => { setSelectedSkill(s); setAttackType(null); }} disabled={!activePlayerId} className={selectedSkill === s ? 'active' : ''}>{s}</button>
                        ))}
                    </div>
                </div>
            )}

            {/* PASO 2.a: Tipo de Ataque (solo si aplica o en modo scouting) */}
            {(selectedSkill === 'Ataque' || currentMatch.matchType === 'scouting') && (
                <div className={`card ${isMatchOver ? 'disabled' : ''}`}>
                    <h4>2.a. Tipo de Ataque</h4>
                    <div className="button-group">
                        <button onClick={() => setAttackType('Contundente')} className={attackType === 'Contundente' ? 'active' : ''}>⚡ Ataque Contundente</button>
                        <button onClick={() => setAttackType('Coloque')} className={attackType === 'Coloque' ? 'active' : ''}>🎯 Coloque / Tiro</button>
                    </div>
                </div>
            )}

            {/* PASO 3: Resultado */}
            <div className={`card ${(!selectedSkill && currentMatch.matchType !== 'scouting') || isMatchOver ? 'disabled' : ''}`}>
                <h4>3. Evalúa el resultado</h4>
                <div className="outcomes-grid">
                    {OUTCOMES.map(({ key, symbol }) => {
                        const skillToUse = currentMatch.matchType === 'scouting' ? 'Ataque' : selectedSkill;
                        const baseSkillForDesc = skillToUse?.startsWith('Ataque') ? 'Ataque' : skillToUse;
                        const description = baseSkillForDesc && OUTCOME_DESCRIPTIONS[baseSkillForDesc]
                            ? OUTCOME_DESCRIPTIONS[baseSkillForDesc][key]
                            : '';
                        return (
                            <button
                                key={key}
                                onClick={() => setSelectedOutcome(key)}
                                disabled={!skillToUse}
                                className={`outcome-btn outcome-${key.toLowerCase().replace(' ', '-')} ${selectedOutcome === key ? 'active' : ''}`}
                            >
                                <span className="outcome-symbol">{symbol}</span>
                                <span className="outcome-name">{key}</span>
                                {description && <span className="outcome-desc">{description}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* PASO 4: Registrar Acción */}
            <div className={`card ${!selectedOutcome || isMatchOver ? 'disabled' : ''}`}>
                <h4>4. Registrar Acción</h4>

                {(!requiresCourt && currentMatch.matchType !== 'scouting') ? (
                    /* Fundamentos sin cancha: Saque, Recepción, Armado, Bloqueo, Defensa */
                    <div className="register-direct">
                        <p className="court-tip">
                            Este fundamento se registra directamente — no requiere posición en la cancha.
                        </p>
                        <button
                            className="btn-primary btn-register"
                            onClick={() => registerAction()}
                            disabled={!selectedOutcome}
                        >
                            ✓ Registrar Acción
                        </button>
                    </div>
                ) : (
                    /* Ataque: requiere marcar inicio y fin en la cancha */
                    <div>
                        {(selectedSkill || currentMatch.matchType === 'scouting') && !attackType && (
                            <p className="court-tip" style={{ color: '#e07b00', fontWeight: 600 }}>
                                ⚠ Selecciona primero el tipo de ataque (paso 2.a)
                            </p>
                        )}

                        <div className="attack-phase-indicator">
                            <div className={`phase-step ${!attackStartPos ? 'phase-active' : 'phase-done'}`}>
                                <span className="phase-num">①</span>
                                <span>Marca la posición de <strong>INICIO</strong> del ataque</span>
                            </div>
                            <div className={`phase-step ${attackStartPos ? 'phase-active' : ''}`}>
                                <span className="phase-num">②</span>
                                <span>Marca la posición <strong>FINAL</strong> (impacto)</span>
                            </div>
                        </div>

                        <div className="court-container" style={{ marginTop: '1rem' }}>
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

                                {/* Flecha de trayectoria animada desde inicio hacia cursor (solo hay inicio) */}
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
                            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                                <button
                                    onClick={() => { setAttackStartPos(null); setAttackPhase(null); }}
                                    style={{ fontSize: '0.85rem' }}
                                >
                                    ✕ Cancelar inicio y volver a marcar
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Controles */}
            <div className="card">
                <h4>Controles</h4>
                <div className="button-group">
                    <button onClick={handleUndo} disabled={isMatchOver}>↩ Deshacer</button>
                    <button onClick={handleFinishSet} disabled={isMatchOver}>Finalizar Set</button>
                    <button onClick={endCurrentMatch}>Finalizar Partido</button>
                </div>
            </div>
        </div>
    );
}

export default GameTracker;
