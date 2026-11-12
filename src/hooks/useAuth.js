import { createContext, useContext } from 'react';

// El contexto y su hook viven aparte del <AuthProvider> para que el recargado en caliente
// de Vite (Fast Refresh) funcione: un archivo .jsx debe exportar solo componentes.
export const AuthContext = createContext(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
    return ctx;
}
