import React, { useState, useMemo, useRef } from 'react';
import { useMatches } from '../context/MatchContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PlayerReport from './PlayerReport';

const SKILLS = ['Saque', 'Recepción', 'Colocación', 'Ataque Contundente', 'Ataque Coloque', 'Bloqueo', 'Defensa'];
const SVG_WIDTH = 500, SVG_HEIGHT = 300, COURT_X_PADDING = 50, COURT_Y_PADDING = 50;
const COURT_WIDTH = SVG_WIDTH - 2 * COURT_X_PADDING, COURT_HEIGHT = SVG_HEIGHT - 2 * COURT_Y_PADDING;

function ReportViewer() {
    const { matches } = useMatches();
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
                    playerStats[player.id].skills[skill] = { total: 0, Positivo: 0, Neutro: 0, Negativo: 0 };
                });
            });

            (selectedMatch.actions || []).forEach(action => {
                if (action && playerStats[action.playerId] && playerStats[action.playerId].skills[action.skill]) {
                    const skillStats = playerStats[action.playerId].skills[action.skill];
                    skillStats.total++;
                    skillStats[action.outcome]++;
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

    const getOutcomeClass = (o) => (o === 'Positivo' ? 'marker-positivo' : o === 'Neutro' ? 'marker-neutro' : 'marker-negativo');

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
                    <button onClick={generatePdf} className="btn-primary" disabled={isGeneratingPdf}>
                        {isGeneratingPdf ? 'Generando PDF...' : 'Descargar Informe en PDF'}
                    </button>
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
                                    <line x1={SVG_WIDTH/2} y1={COURT_Y_PADDING} x2={SVG_WIDTH/2} y2={COURT_Y_PADDING+COURT_HEIGHT} stroke="#6d6d72" strokeWidth="2" strokeDasharray="4" />
                                    {(selectedMatch.actions || []).filter(a => a.x != null).map((action, i) => (
                                        <g key={i} transform={`translate(${action.x * SVG_WIDTH}, ${action.y * SVG_HEIGHT})`}>
                                            <circle r="8" className={`court-marker ${getOutcomeClass(action.outcome)}`} />
                                            <text textAnchor="middle" dy=".3em" style={{ fontSize: '8px', fill: 'white', fontWeight: 'bold' }}>
                                                {playerIdentifiers[action.playerId]}
                                            </text>
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
                            </div>
                        </div>
                        {Object.keys(stats).map(playerId => (
                            <PlayerReport key={playerId} playerName={stats[playerId].name} playerStats={stats[playerId]} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportViewer;
