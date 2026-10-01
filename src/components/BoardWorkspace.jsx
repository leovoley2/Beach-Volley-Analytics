import React, { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TacticalBoard from './TacticalBoard';

// three.js pesa bastante: la pizarra 3D se descarga solo cuando alguien la abre.
const Board3D = lazy(() => import('./Board3D'));

const MODE_KEY = 'bva:pizarra:modo';

// Invitación a PRO para quien abre la cancha 3D con plan Free (la 2D es para todos).
function ProGate() {
    const navigate = useNavigate();
    return (
        <div className="pro-gate">
            <h3>Cancha 3D <span className="pro-badge">PRO</span></h3>
            <p>Explica jugadas y arma ejercicios en una cancha de vóley playa en 3D, y compártelos en video con tu equipo.</p>
            <ul>
                <li>Jugadores con 16 poses: recepción, ataque, bloqueo, defensa, saque…</li>
                <li>Secuencias por pasos con desplazamientos y trayectorias del balón</li>
                <li>Mis ejercicios guardados en tu cuenta, en todos tus dispositivos</li>
                <li>Exporta la jugada en video para WhatsApp o redes</li>
            </ul>
            <button className="btn-primary" onClick={() => navigate('/pricing')}>Pasar a PRO</button>
            <p className="wb-footnote">La pizarra 2D sigue disponible gratis.</p>
        </div>
    );
}

// Pizarra con selector 2D / 3D. `scope` separa lo guardado (un partido o "entreno").
export default function BoardWorkspace({ scope, ownTeamName, opponentTeamName, ownPlayers = [], opponentPlayers = [] }) {
    const { isPaid, subscription } = useAuth();
    const [mode, setMode] = useState(() => {
        try { return localStorage.getItem(MODE_KEY) === '3d' ? '3d' : '2d'; } catch { return '2d'; }
    });
    const choose = (m) => {
        setMode(m);
        try { localStorage.setItem(MODE_KEY, m); } catch { /* sin almacenamiento */ }
    };
    const fileName = `pizarra-${ownTeamName || 'equipo'}${opponentTeamName ? `-vs-${opponentTeamName}` : ''}`;
    const loading3d = <div className="board-ws-loading">Cargando cancha 3D…</div>;

    let content;
    if (mode === '2d') {
        content = (
            <TacticalBoard
                key={`2d-${scope}`}
                matchId={scope}
                ownTeamName={ownTeamName}
                opponentTeamName={opponentTeamName}
                ownPlayers={ownPlayers}
                opponentPlayers={opponentPlayers}
            />
        );
    } else if (!subscription) {
        content = loading3d; // la suscripción aún se está cargando
    } else if (!isPaid) {
        content = <ProGate />;
    } else {
        content = (
            <Suspense fallback={loading3d}>
                <Board3D
                    key={`3d-${scope}`}
                    storageScope={scope}
                    ownPlayers={ownPlayers}
                    opponentPlayers={opponentPlayers}
                    fileName={fileName}
                />
            </Suspense>
        );
    }

    return (
        <div className="board-ws">
            <div className="board-ws-switch" role="tablist" aria-label="Tipo de pizarra">
                <button role="tab" aria-selected={mode === '2d'} className={mode === '2d' ? 'active' : ''} onClick={() => choose('2d')}>Pizarra 2D</button>
                <button role="tab" aria-selected={mode === '3d'} className={mode === '3d' ? 'active' : ''} onClick={() => choose('3d')}>
                    Cancha 3D{!isPaid && <span className="pro-badge">PRO</span>}
                </button>
            </div>
            {content}
        </div>
    );
}
