import React from 'react';
import { useNavigate } from 'react-router-dom';
import AccountMenu from '../components/AccountMenu';
import BoardWorkspace from '../components/BoardWorkspace';

// Pizarra de entrenamiento: la misma pizarra 2D/3D pero sin partido, para armar y explicar ejercicios.
export default function TrainingBoard() {
    const navigate = useNavigate();
    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button onClick={() => navigate('/dashboard')}>Mis partidos</button>
                    <button className="active">Pizarra</button>
                </div>
                <div className="topbar-right">
                    <AccountMenu />
                </div>
            </div>
            <div className="page-wrap page-wrap--board">
                <div className="page-header">
                    <h2>Pizarra de entrenamiento</h2>
                    <p>Arma ejercicios y explica situaciones de juego en 2D o en una cancha 3D. Se guarda solo en este dispositivo.</p>
                </div>
                <BoardWorkspace scope="entreno" ownTeamName="entreno" />
            </div>
        </div>
    );
}
