import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MatchProvider } from './context/MatchContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login          from './pages/Login';
import Signup         from './pages/Signup';
import Dashboard      from './pages/Dashboard';
import NewMatch       from './pages/NewMatch';
import Pricing        from './pages/Pricing';
import PaymentSuccess from './pages/PaymentSuccess';
import MatchApp       from './MatchApp';

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    {/* Rutas públicas */}
                    <Route path="/login"  element={<Login />} />
                    <Route path="/signup" element={<Signup />} />

                    {/* Rutas protegidas */}
                    <Route path="/dashboard"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/match/new"      element={<ProtectedRoute><NewMatch /></ProtectedRoute>} />
                    <Route path="/pricing"        element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
                    <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />

                    {/* Tracker + Informe por partido (usa MatchContext y los componentes existentes) */}
                    <Route path="/match/:matchId/*" element={
                        <ProtectedRoute>
                            <MatchProvider>
                                <MatchApp />
                            </MatchProvider>
                        </ProtectedRoute>
                    } />

                    {/* Redirect raíz */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
