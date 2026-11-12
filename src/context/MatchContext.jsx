import React, { useState } from 'react';
import { MatchContext } from '../hooks/useMatches';

// MatchContext ahora es solo memoria en sesión (no localStorage)
// Los partidos se persisten en Supabase via useMatchesDB
export const MatchProvider = ({ children }) => {
    const [currentMatch, setCurrentMatch] = useState(null);

    // updateMatch: actualiza el partido actual en memoria
    const updateMatch = (updatedMatch) => {
        setCurrentMatch(updatedMatch);
    };

    const endCurrentMatch = () => {
        setCurrentMatch(null);
    };

    const value = {
        currentMatch,
        setCurrentMatch,
        updateMatch,
        endCurrentMatch,
        // matches array vacío — compatibilidad con ReportViewer
        matches: currentMatch ? [currentMatch] : [],
        addMatch: (m) => setCurrentMatch(m),
    };

    return (
        <MatchContext.Provider value={value}>
            {children}
        </MatchContext.Provider>
    );
};
