import { createContext, useContext } from 'react';

// Contexto del partido en curso. Separado de <MatchProvider> por la misma razón que useAuth.js.
export const MatchContext = createContext();

export const useMatches = () => useContext(MatchContext);
