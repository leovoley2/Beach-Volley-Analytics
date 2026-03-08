import React, { useState } from 'react';
import { MatchProvider, useMatches } from './context/MatchContext';
import MatchSetupForm from './components/MatchSetupForm';
import GameTracker from './components/GameTracker';
import ReportViewer from './components/ReportViewer';
import './index.css';

function AppContent() {
    const { currentMatch } = useMatches();
    const [view, setView] = useState('setup');

    const renderCurrentView = () => {
        switch (view) {
            case 'tracker':
                return currentMatch ? <GameTracker /> : <MatchSetupForm onMatchStart={() => setView('tracker')} />;
            case 'reports':
                return <ReportViewer onGoToTracker={() => setView('tracker')} />;
            case 'setup':
            default:
                return <MatchSetupForm onMatchStart={() => setView('tracker')} />;
        }
    };

    return (
        <div className="container">
            <header>
                <div className="brand">
                    <h1>
                        <span>🏐</span>
                        Beach Volley <span className="accent">Analytics</span>
                    </h1>
                    <p>Performance Tracking · Match Analysis</p>
                </div>
                <nav>
                    <button
                        onClick={() => setView('setup')}
                        className={view === 'setup' ? 'nav-active' : ''}
                    >
                        Nuevo Partido
                    </button>
                    <button
                        onClick={() => setView('tracker')}
                        disabled={!currentMatch}
                        className={view === 'tracker' ? 'nav-active' : ''}
                    >
                        Partido Actual
                    </button>
                    <button
                        onClick={() => setView('reports')}
                        className={view === 'reports' ? 'nav-active' : ''}
                    >
                        Informes
                    </button>
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
