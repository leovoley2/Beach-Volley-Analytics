import React, { useState } from 'react';
import { MatchProvider, useMatches } from './context/MatchContext';
import MatchSetupForm from './components/MatchSetupForm';
import GameTracker from './components/GameTracker';
import ReportViewer from './components/ReportViewer';
import './index.css';

function AppContent() {
    const { currentMatch } = useMatches();
    const [view, setView] = useState('setup'); // Vistas: 'setup', 'tracker', 'reports'

    // Componente a renderizar basado en el estado 'view'
    const renderCurrentView = () => {
        switch (view) {
            case 'tracker':
                // Solo muestra el tracker si hay un partido activo
                return currentMatch ? <GameTracker /> : <MatchSetupForm onMatchStart={() => setView('tracker')} />;
            case 'reports':
                return <ReportViewer />;
            case 'setup':
            default:
                return <MatchSetupForm onMatchStart={() => setView('tracker')} />;
        }
    };

    return (
        <div className="container">
            <header>
                <h1 className='text-white'>🏐 Beach Volley Analytics 🏐 </h1>
                <nav>
                    <button onClick={() => setView('setup')}>Nuevo Partido</button>
                    <button onClick={() => setView('tracker')} disabled={!currentMatch}>Partido Actual</button>
                    <button onClick={() => setView('reports')}>Ver Informes</button>
                </nav>
            </header>
            <main>
                {renderCurrentView()}
            </main>
        </div>
    );
}

function App() {
    return (
        <MatchProvider>
            <AppContent />
        </MatchProvider>
    );
}

export default App;
