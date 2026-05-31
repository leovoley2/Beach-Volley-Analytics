import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Error Boundary global para atrapar errores silenciosos
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('Error global:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100vh', background: '#0b0f1a', flexDirection: 'column', gap: '1rem',
                    fontFamily: 'Inter, sans-serif', padding: '2rem', textAlign: 'center',
                }}>
                    <div style={{ fontSize: '3rem' }}>⚠️</div>
                    <h2 style={{ color: '#e8edf5', fontSize: '1.1rem', fontWeight: 700 }}>Algo salió mal</h2>
                    <p style={{ color: '#7a8899', fontSize: '0.85rem', maxWidth: 400 }}>
                        {this.state.error?.message || 'Error desconocido'}
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{ padding: '0.65rem 1.5rem', background: '#f97316', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}
                    >
                        Recargar app
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
);
