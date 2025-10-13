import React, { useState, useEffect } from 'react';
import { useMatches } from '../context/MatchContext';

// --- Constantes del Componente ---
const SKILLS = ['Saque', 'Recepción', 'Colocación', 'Ataque', 'Bloqueo', 'Defensa'];
const OUTCOMES = { Positivo: '#', Neutro: '/', Negativo: '=' };
const SVG_WIDTH = 500, SVG_HEIGHT = 300, COURT_X_PADDING = 50, COURT_Y_PADDING = 50;
const COURT_WIDTH = SVG_WIDTH - 2 * COURT_X_PADDING, COURT_HEIGHT = SVG_HEIGHT - 2 * COURT_Y_PADDING;

// --- Componente Principal ---
function GameTracker() {
    const { currentMatch, updateMatch, endCurrentMatch } = useMatches();
    const [activePlayerId, setActivePlayerId] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [attackType, setAttackType] = useState(null); // Nuevo estado para el tipo de ataque
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    const [isMatchOver, setIsMatchOver] = useState(false);

    const currentSetIndex = currentMatch ? currentMatch.sets.length - 1 : 0;
    const currentSetScore = currentMatch ? currentMatch.sets[currentSetIndex] : { own: 0, opponent: 0 };

    useEffect(() => {
        if (!currentMatch) return;
        const { score, setsToWin } = currentMatch;
        if (score.own === setsToWin || score.opponent === setsToWin) {
            setIsMatchOver(true);
        } else {
            setIsMatchOver(false);
        }
    }, [currentMatch]);

    if (!currentMatch) {
        return <div className="card">No hay ningún partido activo. Ve a "Nuevo Partido" para comenzar.</div>;
    }
    
    // --- Lógica Principal ---

    /**
     * Función centralizada para registrar una acción.
     * Acepta una posición opcional. Si no se provee, la acción se guarda sin coordenadas.
     * @param {object|null} position - Objeto con {x, y} o null.
     */
    const registerAction = (position = null) => {
        if (!activePlayerId || !selectedSkill || !selectedOutcome) return;

        // Validaciones específicas para ataque
        if (selectedSkill === 'Ataque') {
            if (!position) {
                alert('Para registrar un ataque, debes marcar la posición en la cancha.');
                return;
            }
            if (!attackType) {
                alert('Por favor, selecciona el tipo de ataque.');
                return;
            }
        }

        const newAction = {
            playerId: activePlayerId,
            skill: selectedSkill === 'Ataque' ? `${selectedSkill} ${attackType}` : selectedSkill, // Guarda el tipo de ataque
            outcome: selectedOutcome,
            timestamp: new Date().toISOString(),
            ...(position && { x: position.x, y: position.y })
        };
        
        const isOwnPlayer = currentMatch.ownPlayers.some(p => p.id === activePlayerId);
        
        const newSets = [...currentMatch.sets];
        const newCurrentSetScore = { ...newSets[currentSetIndex] };

        // --- LÓGICA DE PUNTUACIÓN ACTUALIZADA ---
        // Punto ganado por ataque positivo
        if (selectedSkill === 'Ataque' && selectedOutcome === 'Positivo') {
            if (isOwnPlayer) {
                newCurrentSetScore.own++;
            } else {
                newCurrentSetScore.opponent++;
            }
        }
        // Punto para el rival por error no forzado (saque o ataque)
        if ((selectedSkill === 'Ataque' && selectedOutcome === 'Negativo') || (selectedSkill === 'Saque' && selectedOutcome === 'Negativo')) {
            if (isOwnPlayer) {
                newCurrentSetScore.opponent++;
            } else {
                newCurrentSetScore.own++;
            }
        }
        
        newSets[currentSetIndex] = newCurrentSetScore;

        updateMatch({
            ...currentMatch,
            actions: [...(currentMatch.actions || []), newAction],
            sets: newSets,
        });

        // Resetear el estado para la siguiente acción
        setActivePlayerId(null);
        setSelectedSkill(null);
        setAttackType(null); // Resetear tipo de ataque
        setSelectedOutcome(null);
    };

    const handleCourtClick = (e) => {
        if (!activePlayerId || !selectedSkill || !selectedOutcome) {
            alert('Por favor, selecciona jugador, acción y resultado antes de marcar.');
            return;
        }
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        registerAction({ x, y });
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
        
        const newSets = [...currentMatch.sets];
        const newCurrentSetScore = { ...newSets[currentSetIndex] };

        // Revertir el punto si la última acción lo sumó
        if (lastAction.skill === 'Ataque' && lastAction.outcome === 'Positivo') {
            if (wasOwnPlayer) {
                newCurrentSetScore.own = Math.max(0, newCurrentSetScore.own - 1);
            } else {
                newCurrentSetScore.opponent = Math.max(0, newCurrentSetScore.opponent - 1);
            }
        }
        // Revertir el punto si la última acción fue un error
        if ((lastAction.skill === 'Ataque' && lastAction.outcome === 'Negativo') || (lastAction.skill === 'Saque' && lastAction.outcome === 'Negativo')) {
            if (wasOwnPlayer) {
                newCurrentSetScore.opponent = Math.max(0, newCurrentSetScore.opponent - 1);
            } else {
                newCurrentSetScore.own = Math.max(0, newCurrentSetScore.own - 1);
            }
        }

        newSets[currentSetIndex] = newCurrentSetScore;
        updateMatch({ ...currentMatch, actions: newActions, sets: newSets });
    };

    const handleFinishSet = () => {
        const { own, opponent } = currentSetScore;
        const isTieBreak = currentSetIndex === 2; // El 3er set es el tie-break
        const targetScore = isTieBreak ? 15 : 21;

        const ownWinsSet = own >= targetScore && own >= opponent + 2;
        const opponentWinsSet = opponent >= targetScore && opponent >= own + 2;

        if (!ownWinsSet && !opponentWinsSet) {
            alert(`Ningún equipo ha ganado el set. Un equipo debe alcanzar ${targetScore} puntos con una ventaja de 2.`);
            return;
        }

        const newScore = { ...currentMatch.score };
        if (ownWinsSet) {
            newScore.own++;
        } else {
            newScore.opponent++;
        }

        const ownWinsMatch = newScore.own === currentMatch.setsToWin;
        const opponentWinsMatch = newScore.opponent === currentMatch.setsToWin;

        if (ownWinsMatch || opponentWinsMatch) {
            updateMatch({ ...currentMatch, score: newScore });
            setIsMatchOver(true);
            alert(`¡Partido finalizado! Ganador: ${ownWinsMatch ? currentMatch.ownTeamName : currentMatch.opponentTeamName}`);
        } else {
            const newSets = [...currentMatch.sets, { own: 0, opponent: 0 }];
            updateMatch({ ...currentMatch, score: newScore, sets: newSets });
        }
    };
    
    // --- Renderizado del Componente ---
    return (
        <div className="game-tracker">
            {/* Marcador de Sets */}
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

            {/* Pasos para registrar acción */}
            <div className={`card ${isMatchOver ? 'disabled' : ''}`}>
                <h4>1. Selecciona Jugador</h4>
                <h5>{currentMatch.ownTeamName}</h5>
                <div className="button-group">{currentMatch.ownPlayers.map(p => <button key={p.id} onClick={() => setActivePlayerId(p.id)} className={activePlayerId === p.id ? 'active' : ''}>{p.name}</button>)}</div>
                {currentMatch.opponentPlayers && (
                    <>
                        <h5 style={{ marginTop: '1rem' }}>{currentMatch.opponentTeamName}</h5>
                        <div className="button-group">{currentMatch.opponentPlayers.map(p => <button key={p.id} onClick={() => setActivePlayerId(p.id)} className={activePlayerId === p.id ? 'active' : ''}>{p.name}</button>)}</div>
                    </>
                )}
            </div>
            <div className={`card ${!activePlayerId || isMatchOver ? 'disabled' : ''}`}>
                <h4>2. Selecciona Fundamento</h4>
                <div className="button-grid">{SKILLS.map(s => <button key={s} onClick={() => setSelectedSkill(s)} disabled={!activePlayerId} className={selectedSkill === s ? 'active' : ''}>{s}</button>)}</div>
            </div>

            {/* PASO 2.5: TIPO DE ATAQUE (si aplica) */}
            {selectedSkill === 'Ataque' && (
                <div className={`card ${isMatchOver ? 'disabled' : ''}`}>
                    <h4>2.a. Tipo de Ataque</h4>
                    <div className="button-group">
                        <button onClick={() => setAttackType('Contundente')} className={attackType === 'Contundente' ? 'active' : ''}>Ataque Contundente</button>
                        <button onClick={() => setAttackType('Coloque')} className={attackType === 'Coloque' ? 'active' : ''}>Coloque / Tiro</button>
                    </div>
                </div>
            )}

            <div className={`card ${!selectedSkill || isMatchOver ? 'disabled' : ''}`}>
                <h4>3. Evalúa el resultado</h4>
                <div className="button-group evaluation">{Object.entries(OUTCOMES).map(([o, s]) => <button key={o} onClick={() => setSelectedOutcome(o)} disabled={!selectedSkill} className={`${selectedOutcome === o ? 'active ' : ''}outcome-${o.toLowerCase()}`}>{o} ({s})</button>)}</div>
            </div>
            
            {/* PASO 4 ACTUALIZADO: Registrar con o sin posición */}
            <div className={`card ${!selectedOutcome || isMatchOver ? 'disabled' : ''}`}>
                <h4>4. Registrar Acción</h4>
                
                {selectedSkill === 'Ataque' ? (
                    <p><strong>Ataque seleccionado:</strong> Debes marcar la posición en la cancha para registrar el punto.</p>
                ) : (
                    <p>Registra la acción directamente o marca su posición en la cancha.</p>
                )}

                <div className="button-group">
                    <button 
                        className="btn-primary" 
                        onClick={() => registerAction(null)}
                        disabled={!selectedOutcome || selectedSkill === 'Ataque'} // Deshabilitado para ataques
                    >
                        Registrar Acción (sin posición)
                    </button>
                </div>

                <div className="court-container" style={{marginTop: '1.5rem'}}>
                    <p className="court-tip">
                        {selectedSkill === 'Ataque' 
                            ? <strong>Marca la posición final del ataque</strong>
                            : <strong>Opcional: Marca la posición en la cancha</strong>
                        }
                    </p>
                    <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="volleyball-court" onClick={handleCourtClick}>
                        <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="#fdf6e3" />
                        <rect x={COURT_X_PADDING} y={COURT_Y_PADDING} width={COURT_WIDTH} height={COURT_HEIGHT} fill="#ffe8a1" stroke="#6d6d72" strokeWidth="1" />
                        <line x1={SVG_WIDTH/2} y1={COURT_Y_PADDING} x2={SVG_WIDTH/2} y2={COURT_Y_PADDING+COURT_HEIGHT} stroke="#6d6d72" strokeWidth="2" strokeDasharray="4" />
                    </svg>
                </div>
            </div>

            <div className="card">
                 <h4>Controles</h4>
                 <div className="button-group">
                    <button onClick={handleUndo} disabled={isMatchOver}>Deshacer</button>
                    <button onClick={handleFinishSet} disabled={isMatchOver}>Finalizar Set</button>
                    <button onClick={endCurrentMatch}>Finalizar Partido</button>
                </div>
            </div>
        </div>
    );
}

export default GameTracker;

