import React, { useState, useMemo, useRef } from 'react';
import { useMatches } from '../context/MatchContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PlayerReport from './PlayerReport';

const SKILLS = ['Saque', 'Recepción', 'Armado', 'Ataque Contundente', 'Ataque Coloque', 'Bloqueo', 'Defensa'];
const OUTCOMES = ['Doble Positivo', 'Positivo', 'Overpass', 'Negativo', 'Doble Negativo'];
const SVG_WIDTH = 500, SVG_HEIGHT = 300, COURT_X_PADDING = 50, COURT_Y_PADDING = 50;
const COURT_WIDTH = SVG_WIDTH - 2 * COURT_X_PADDING, COURT_HEIGHT = SVG_HEIGHT - 2 * COURT_Y_PADDING;

function ReportViewer({ onGoToTracker }) {
    const { matches, setCurrentMatch } = useMatches();
    const [selectedMatchId, setSelectedMatchId] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const reportContentRef = useRef(null);

    const selectedMatch = useMemo(() => {
        return matches.find(m => m.id === selectedMatchId) || null;
    }, [selectedMatchId, matches]);

    const playerIdentifiers = useMemo(() => {
        if (!selectedMatch) return {};
        const identifiers = {};
        (selectedMatch.ownPlayers || []).forEach((p, i) => {
            identifiers[p.id] = `J${i + 1}`;
        });
        (selectedMatch.opponentPlayers || []).forEach((p, i) => {
            identifiers[p.id] = `R${i + 1}`;
        });
        return identifiers;
    }, [selectedMatch]);

    const stats = useMemo(() => {
        if (!selectedMatch) return null;
        try {
            const playerStats = {};
            const allPlayers = [
                ...(selectedMatch.ownPlayers || []),
                ...(selectedMatch.opponentPlayers || [])
            ];

            allPlayers.forEach(player => {
                playerStats[player.id] = { name: player.name, skills: {} };
                SKILLS.forEach(skill => {
                    playerStats[player.id].skills[skill] = { total: 0, 'Doble Positivo': 0, 'Positivo': 0, 'Overpass': 0, 'Negativo': 0, 'Doble Negativo': 0 };
                });
            });

            (selectedMatch.actions || []).forEach(action => {
                if (action && playerStats[action.playerId] && playerStats[action.playerId].skills[action.skill]) {
                    const skillStats = playerStats[action.playerId].skills[action.skill];
                    skillStats.total++;
                    if (skillStats[action.outcome] !== undefined) skillStats[action.outcome]++;
                }
            });
            return playerStats;
        } catch (error) {
            console.error("Error calculating stats:", error);
            return null;
        }
    }, [selectedMatch]);

    const generatePdf = async () => {
        const reportElement = reportContentRef.current;
        if (!reportElement) return;
        setIsGeneratingPdf(true);
        const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
        pdf.addImage(imgData, 'PNG', (pdfWidth - canvas.width * ratio) / 2, 20, canvas.width * ratio, canvas.height * ratio);
        pdf.save(`informe_${selectedMatch.ownTeamName}.pdf`);
        setIsGeneratingPdf(false);
    };

    const getOutcomeClass = (o) => (o === 'Doble Positivo' ? 'marker-positivo' : o === 'Doble Negativo' ? 'marker-negativo' : 'marker-neutro');

    const handleGoToMatch = () => {
        if (!selectedMatch) return;
        setCurrentMatch(selectedMatch);
        onGoToTracker();
    };

    return (
        <div className="card">
            <h2>Visor de Informes</h2>
            <div className="form-group">
                <label>Selecciona un partido para analizar:</label>
                <select onChange={(e) => setSelectedMatchId(e.target.value)} value={selectedMatchId}>
                    <option value="">-- Elige un partido --</option>
                    {matches.map(match => (
                        <option key={match.id} value={match.id}>
                            {`${match.date} - ${match.ownTeamName} vs ${match.opponentTeamName}`}
                        </option>
                    ))}
                </select>
            </div>

            {selectedMatch && stats && (
                <div className="report-content">
                    <div className="report-actions">
                        <button onClick={handleGoToMatch} className="btn-go-match" title="Volver al partido para corregir acciones">
                            ✏️ Ir al Partido
                        </button>
                        <button onClick={generatePdf} className="btn-primary" disabled={isGeneratingPdf}>
                            {isGeneratingPdf ? 'Generando PDF...' : '📄 Descargar PDF'}
                        </button>
                    </div>
                    <div ref={reportContentRef} className="pdf-container">
                        <div className="pdf-header">
                            <h1>Informe de Partido</h1>
                            <h2>{`${selectedMatch.ownTeamName} vs ${selectedMatch.opponentTeamName}`}</h2>
                            <p>{`Resultado Final (Sets): ${selectedMatch.score.own} - ${selectedMatch.score.opponent} | Fecha: ${selectedMatch.date}`}</p>
                        </div>

                        <div className="sets-summary">
                            <h4>Resumen por Sets</h4>
                            <table className="compact-table">
                                <thead>
                                    <tr>
                                        <th>Set</th>
                                        <th>{selectedMatch.ownTeamName}</th>
                                        <th>{selectedMatch.opponentTeamName}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedMatch.sets.map((set, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>{set.own}</td>
                                            <td>{set.opponent}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="court-section">
                            <h4>Mapa de Acciones</h4>
                            <div className="court-container">
                                <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="volleyball-court">
                                    <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="#fdf6e3" />
                                    <rect x={COURT_X_PADDING} y={COURT_Y_PADDING} width={COURT_WIDTH} height={COURT_HEIGHT} fill="#ffe8a1" stroke="#6d6d72" strokeWidth="1" />
                                    <line x1={SVG_WIDTH / 2} y1={COURT_Y_PADDING} x2={SVG_WIDTH / 2} y2={COURT_Y_PADDING + COURT_HEIGHT} stroke="#6d6d72" strokeWidth="2" strokeDasharray="4" />
                                    {(selectedMatch.actions || []).filter(a => a.x != null).map((action, i) => (
                                        <g key={i}>
                                            {/* Trayectoria del ataque: diferenciada por tipo */}
                                            {action.startX != null && (() => {
                                                const x1 = action.startX * SVG_WIDTH;
                                                const y1 = action.startY * SVG_HEIGHT;
                                                const x2 = action.x * SVG_WIDTH;
                                                const y2 = action.y * SVG_HEIGHT;
                                                const isColoque = action.skill === 'Ataque Coloque';
                                                const isContundente = action.skill === 'Ataque Contundente';
                                                // Punto de control para el arco del coloque (mitad elevada)
                                                const cx = (x1 + x2) / 2;
                                                const cy = (y1 + y2) / 2 - 55;

                                                return (
                                                    <>
                                                        {/* Marcador de INICIO (azul) */}
                                                        <circle cx={x1} cy={y1} r="6" fill="#007aff" stroke="white" strokeWidth="1.5" opacity="0.9" />

                                                        {isColoque ? (
                                                            /* Coloque → semi-arco curvo con línea punteada */
                                                            <path
                                                                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                                                                fill="none"
                                                                stroke="#9b59b6"
                                                                strokeWidth="1.8"
                                                                strokeDasharray="4 3"
                                                                strokeLinecap="round"
                                                                opacity="0.75"
                                                            />
                                                        ) : isContundente ? (
                                                            /* Contundente → línea recta sólida y gruesa */
                                                            <line
                                                                x1={x1} y1={y1} x2={x2} y2={y2}
                                                                stroke="#e74c3c"
                                                                strokeWidth="2.8"
                                                                strokeLinecap="round"
                                                                opacity="0.8"
                                                            />
                                                        ) : (
                                                            /* Otro → línea punteada genérica */
                                                            <line
                                                                x1={x1} y1={y1} x2={x2} y2={y2}
                                                                stroke="rgba(0,0,0,0.35)"
                                                                strokeWidth="1.5"
                                                                strokeDasharray="5 3"
                                                            />
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            {/* Marcador de FIN / impacto */}
                                            <g transform={`translate(${action.x * SVG_WIDTH}, ${action.y * SVG_HEIGHT})`}>
                                                <circle r="8" className={`court-marker ${getOutcomeClass(action.outcome)}`} />
                                                <text textAnchor="middle" dy=".3em" style={{ fontSize: '8px', fill: 'white', fontWeight: 'bold' }}>
                                                    {playerIdentifiers[action.playerId]}
                                                </text>
                                            </g>
                                        </g>
                                    ))}
                                </svg>
                            </div>
                            <div className="court-legend">
                                <h4>Leyenda de Jugadores</h4>
                                <ul style={{ listStyle: 'none', padding: 0, textAlign: 'center' }}>
                                    {(selectedMatch.ownPlayers || []).map((p, i) => (
                                        <li key={p.id} style={{ display: 'inline-block', marginRight: '1rem' }}>
                                            <strong>J{i + 1}:</strong> {p.name}
                                        </li>
                                    ))}
                                    {(selectedMatch.opponentPlayers || []).map((p, i) => (
                                        <li key={p.id} style={{ display: 'inline-block', marginRight: '1rem' }}>
                                            <strong>R{i + 1}:</strong> {p.name}
                                        </li>
                                    ))}
                                </ul>
                                {/* Leyenda de trayectorias */}
                                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#6d6d72', display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="32" height="12"><line x1="0" y1="6" x2="32" y2="6" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" /></svg>
                                        Ataque Contundente
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="32" height="16"><path d="M 0 12 Q 16 0 32 12" fill="none" stroke="#9b59b6" strokeWidth="1.8" strokeDasharray="4 3" strokeLinecap="round" /></svg>
                                        Coloque / Tiro
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#007aff" stroke="white" strokeWidth="1.5" /></svg>
                                        Posición de inicio
                                    </span>
                                </div>
                            </div>
                        </div>
                        {Object.keys(stats)
                            .filter(playerId => {
                                // Solo mostrar jugadores con al menos una acción registrada
                                const skills = stats[playerId].skills;
                                return Object.values(skills).some(s => s.total > 0);
                            })
                            .map(playerId => (
                                <PlayerReport key={playerId} playerName={stats[playerId].name} playerStats={stats[playerId]} />
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportViewer;
