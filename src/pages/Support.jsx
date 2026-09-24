import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccountMenu from '../components/AccountMenu';
import { LEGAL } from '../lib/legalConfig';

// Respuestas alineadas con los Términos (sección 5) y la Política de Privacidad:
// si cambian esos textos, revisar también estas.
const FAQ = [
    {
        q: '¿Cómo cancelo mi suscripción?',
        a: <>Desde <Link to="/subscription">Suscripción y pagos</Link>. No se te vuelve a cobrar y conservas el acceso Pro hasta el final del periodo ya pagado; después tu cuenta pasa al plan Free sin perder tus partidos.</>,
    },
    {
        q: '¿Quién procesa mis pagos?',
        a: <>PayPal. No almacenamos los datos de tu tarjeta en nuestros servidores. Salvo que la ley exija lo contrario, los pagos ya realizados no son reembolsables.</>,
    },
    {
        q: '¿De quién son mis datos?',
        a: <>Tuyos. Solo los usamos para prestarte el servicio. Puedes eliminar tu cuenta y todos tus partidos cuando quieras desde <Link to="/account">Mi cuenta</Link>.</>,
    },
    {
        q: '¿Cómo ejerzo mis derechos sobre mis datos personales?',
        a: <>Puedes solicitar el acceso, rectificación, cancelación u oposición (derechos ARCO, Ley N.º 29733 de Protección de Datos Personales del Perú) escribiendo a <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</>,
    },
];

/** Soporte: contacto, información de la app y enlaces legales. */
export default function Support() {
    const { user, subscription } = useAuth();
    const navigate = useNavigate();

    const supportMailto = `mailto:${LEGAL.supportEmail}`
        + `?subject=${encodeURIComponent('Soporte — Beach Volley Analytics')}`
        + `&body=${encodeURIComponent(`Cuéntanos qué ocurre:\n\n\n---\nUsuario: ${user?.email || ''}\nPlan: ${subscription?.plan || 'free'}`)}`;

    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="topbar">
                <div className="topbar-brand">🏐 Beach Volley <span className="accent">Analytics</span></div>
                <div className="topbar-nav">
                    <button onClick={() => navigate('/dashboard')}>Mis partidos</button>
                </div>
                <div className="topbar-right">
                    <AccountMenu />
                </div>
            </div>

            <div className="page-wrap account-page">
                <div className="page-header">
                    <h2>Soporte</h2>
                    <p>¿Tienes una duda o un problema? Estamos para ayudarte.</p>
                </div>

                <section className="account-section">
                    <h3>Contáctanos</h3>
                    <p className="account-text">
                        Escríbenos a <a href={supportMailto}>{LEGAL.supportEmail}</a>. Para ayudarte más rápido, cuéntanos
                        qué estabas haciendo cuando ocurrió el problema y, si puedes, adjunta una captura de pantalla.
                    </p>
                    <a className="btn-upgrade" href={supportMailto} style={{ display: 'inline-block', textDecoration: 'none' }}>
                        ✉️ Escribir a soporte
                    </a>
                </section>

                <section className="account-section">
                    <h3>Preguntas frecuentes</h3>
                    <div className="faq-list">
                        {FAQ.map(item => (
                            <details key={item.q} className="faq-item">
                                <summary>{item.q}</summary>
                                <p className="account-text">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="account-section">
                    <h3>Sobre la app</h3>
                    <p className="account-text">
                        <strong>{LEGAL.companyName}</strong> es una herramienta de scouting y análisis estadístico para voleibol de playa:
                        registra las acciones de cada partido, visualiza trayectorias en la cancha y genera informes por jugador.
                    </p>
                    <p className="account-text">
                        Responsable: {LEGAL.companyName}{LEGAL.companyId ? ` (${LEGAL.companyId})` : ''} · {LEGAL.address}.
                        Al usar la app aceptas nuestros <Link to="/terms">Términos y Condiciones</Link> y
                        nuestra <Link to="/privacy">Política de Privacidad</Link>.
                    </p>
                    <div className="account-actions">
                        <Link className="btn-secondary" to="/terms">Términos y Condiciones</Link>
                        <Link className="btn-secondary" to="/privacy">Política de Privacidad</Link>
                    </div>
                </section>

                <p className="account-hint" style={{ textAlign: 'center' }}>
                    © {new Date().getFullYear()} {LEGAL.companyName} · Documentos legales actualizados el {LEGAL.lastUpdated}
                </p>
            </div>
        </div>
    );
}
