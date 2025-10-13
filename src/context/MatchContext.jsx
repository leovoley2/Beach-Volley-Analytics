import React, { createContext, useState, useEffect, useContext } from 'react';

const MatchContext = createContext();

export const useMatches = () => {
    return useContext(MatchContext);
};

export const MatchProvider = ({ children }) => {
    const [matches, setMatches] = useState(() => {
        try {
            const savedMatches = localStorage.getItem('beachVolleyMatches');
            return savedMatches ? JSON.parse(savedMatches) : [];
        } catch (error) {
            console.error("Error loading matches from localStorage", error);
            return [];
        }
    });

    const [currentMatch, setCurrentMatch] = useState(null);

    useEffect(() => {
        try {
            localStorage.setItem('beachVolleyMatches', JSON.stringify(matches));
        } catch (error) {
            console.error("Error saving matches to localStorage", error);
        }
    }, [matches]);

    const addMatch = (matchData) => {
        const newMatch = { ...matchData, id: `match_${Date.now()}` };
        setMatches(prevMatches => [...prevMatches, newMatch]);
        setCurrentMatch(newMatch);
        return newMatch;
    };

    const updateMatch = (updatedMatch) => {
        setMatches(prevMatches =>
            prevMatches.map(match => (match.id === updatedMatch.id ? updatedMatch : match))
        );
        setCurrentMatch(updatedMatch);
    };
    
    const endCurrentMatch = () => {
        setCurrentMatch(null);
    };

    const value = {
        matches,
        currentMatch,
        addMatch,
        updateMatch,
        setCurrentMatch,
        endCurrentMatch
    };

    return (
        <MatchContext.Provider value={value}>
            {children}
        </MatchContext.Provider>
    );
};