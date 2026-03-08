import React, { useState } from 'react';
import { useMatches } from '../context/MatchContext';

function MatchSetupForm({ onMatchStart }) {
    const [ownTeamName, setOwnTeamName] = useState('');
    const [opponentTeamName, setOpponentTeamName] = useState('');
    const [player1, setPlayer1] = useState('');
    const [player2, setPlayer2] = useState('');
    const [opponentPlayer1, setOpponentPlayer1] = useState('');
    const [opponentPlayer2, setOpponentPlayer2] = useState('');
    const [setsToWin, setSetsToWin] = useState('2'); // Por defecto, al mejor de 3 (ganar 2)
    const [matchType, setMatchType] = useState('completo'); // 'completo' o 'scouting'
    const { addMatch } = useMatches();

    const handleStartMatch = (e) => {
        e.preventDefault();
        if (!ownTeamName || !opponentTeamName || !player1 || !player2 || !opponentPlayer1 || !opponentPlayer2) {
            alert('Por favor, completa todos los campos.');
            return;
        }

        const newMatchData = {
            date: new Date().toISOString().split('T')[0],
            ownTeamName,
            opponentTeamName,
            ownPlayers: [
                { id: 'player1', name: player1 },
                { id: 'player2', name: player2 }
            ],
            opponentPlayers: [
                { id: 'opponent1', name: opponentPlayer1 },
                { id: 'opponent2', name: opponentPlayer2 }
            ],
            setsToWin: parseInt(setsToWin, 10),
            matchType, // 'completo' (estadísticas totales) o 'scouting' (solo tendencias de ataque)
            sets: [{ own: 0, opponent: 0 }], // El primer set empieza 0-0
            score: { own: 0, opponent: 0 }, // Marcador de sets ganados
            actions: []
        };

        addMatch(newMatchData);
        onMatchStart(); // Cambia la vista en App.jsx
    };

    return (
        <div className="card">
            <h2>Configuración del Partido</h2>
            <form onSubmit={handleStartMatch}>
                <div className="form-group">
                    <label>Nombre de tu Equipo</label>
                    <input type="text" value={ownTeamName} onChange={(e) => setOwnTeamName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Nombre del Equipo Rival</label>
                    <input type="text" value={opponentTeamName} onChange={(e) => setOpponentTeamName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Jugador #1</label>
                    <input type="text" value={player1} onChange={(e) => setPlayer1(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Jugador #2</label>
                    <input type="text" value={player2} onChange={(e) => setPlayer2(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Jugador Rival #1</label>
                    <input type="text" value={opponentPlayer1} onChange={(e) => setOpponentPlayer1(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Jugador Rival #2</label>
                    <input type="text" value={opponentPlayer2} onChange={(e) => setOpponentPlayer2(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Formato del Partido</label>
                    <select value={setsToWin} onChange={(e) => setSetsToWin(e.target.value)}>
                        <option value="1">Partido a 1 set</option>
                        <option value="2">Al mejor de 3 sets (ganar 2)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Modo de Registro</label>
                    <select value={matchType} onChange={(e) => setMatchType(e.target.value)}>
                        <option value="completo">Completo (Todos los fundamentos + K1/K2)</option>
                        <option value="scouting">Scouting Rápido (Solo tendencias de ataque)</option>
                    </select>
                </div>
                <button type="submit" className="btn-primary">Iniciar Partido</button>
            </form>
        </div>
    );
}

export default MatchSetupForm;