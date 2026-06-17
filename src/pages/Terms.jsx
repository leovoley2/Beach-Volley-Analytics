import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL } from '../lib/legalConfig';

/**
 * Términos y Condiciones de uso.
 *
 * PLANTILLA BASE — revisa con un abogado antes de producción y completa
 * los datos en src/lib/legalConfig.js.
 */
export default function Terms() {
    return (
        <div style={legalWrapStyle}>
            <div style={legalCardStyle}>
                <Link to="/login" style={backLinkStyle}>← Volver</Link>
                <h1 style={h1Style}>Términos y Condiciones</h1>
                <p style={mutedStyle}>Última actualización: {LEGAL.lastUpdated}</p>

                <Section title="1. Aceptación">
                    <p>Al crear una cuenta o usar {LEGAL.companyName} (el “Servicio”) aceptas estos Términos y nuestra{' '}
                    <Link to="/privacy" style={linkStyle}>Política de Privacidad</Link>. Si no estás de acuerdo, no uses el Servicio.</p>
                </Section>

                <Section title="2. Descripción del servicio">
                    <p>El Servicio permite registrar, analizar y visualizar estadísticas de partidos de vóley playa. Ofrecemos un plan
                    gratuito con límites de uso y planes de pago (Pro y Team) con funciones adicionales.</p>
                </Section>

                <Section title="3. Cuenta y seguridad">
                    <ul>
                        <li>Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad en tu cuenta.</li>
                        <li>Debes proporcionar información veraz y mantenerla actualizada.</li>
                        <li>Notifícanos de inmediato cualquier uso no autorizado de tu cuenta.</li>
                    </ul>
                </Section>

                <Section title="4. Uso aceptable">
                    <p>Te comprometes a no:</p>
                    <ul>
                        <li>Intentar acceder a datos de otros usuarios o a sistemas sin autorización.</li>
                        <li>Realizar ataques de fuerza bruta, scraping masivo o sobrecargar el Servicio con peticiones automatizadas.</li>
                        <li>Usar el Servicio para fines ilegales o que infrinjan derechos de terceros.</li>
                        <li>Revender o redistribuir el Servicio sin nuestro consentimiento.</li>
                    </ul>
                    <p>Podemos limitar la frecuencia de peticiones, suspender o cerrar cuentas que incumplan estas reglas.</p>
                </Section>

                <Section title="5. Planes, pagos y renovación">
                    <ul>
                        <li>Las suscripciones de pago se cobran de forma recurrente (mensual) a través de Mercado Pago.</li>
                        <li>Los precios pueden cambiar; te avisaremos con antelación razonable.</li>
                        <li>Puedes cancelar en cualquier momento; el acceso de pago continúa hasta el final del periodo ya pagado.</li>
                        <li>Salvo que la ley exija lo contrario, los pagos ya realizados no son reembolsables.</li>
                    </ul>
                </Section>

                <Section title="6. Propiedad de los datos y contenido">
                    <p>Los datos que registras son tuyos. Nos concedes una licencia limitada para almacenarlos y procesarlos con el único fin
                    de prestarte el Servicio. El software, la marca y el diseño de {LEGAL.companyName} son de su titular y están protegidos.</p>
                </Section>

                <Section title="7. Disponibilidad y cambios">
                    <p>Procuramos un servicio continuo, pero puede haber interrupciones por mantenimiento o causas ajenas. Podemos modificar o
                    descontinuar funciones; los cambios relevantes se comunicarán cuando corresponda.</p>
                </Section>

                <Section title="8. Limitación de responsabilidad">
                    <p>El Servicio se presta “tal cual”. En la máxima medida permitida por la ley, no respondemos por daños indirectos, pérdida
                    de datos o lucro cesante. Nuestra responsabilidad total se limita al importe que hayas pagado en los últimos 12 meses.</p>
                </Section>

                <Section title="9. Terminación">
                    <p>Puedes cerrar tu cuenta cuando quieras. Podemos suspender o cerrar cuentas que incumplan estos Términos o la ley.</p>
                </Section>

                <Section title="10. Ley aplicable y jurisdicción">
                    <p>Estos Términos se rigen por las leyes de {LEGAL.governingLaw}. Cualquier controversia se someterá a {LEGAL.jurisdiction},
                    sin perjuicio de los derechos que la ley reconozca a los consumidores.</p>
                </Section>

                <p style={mutedStyle}>Contacto: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={h2Style}>{title}</h2>
            <div style={bodyStyle}>{children}</div>
        </section>
    );
}

const legalWrapStyle = { minHeight: '100vh', background: '#0b0f1a', padding: '2.5rem 1rem', display: 'flex', justifyContent: 'center' };
const legalCardStyle = { maxWidth: 760, width: '100%', background: '#121826', border: '1px solid #1f2937', borderRadius: 16, padding: '2.5rem', color: '#cbd5e1', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.7 };
const backLinkStyle  = { color: '#f97316', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' };
const linkStyle  = { color: '#f97316', textDecoration: 'none' };
const h1Style    = { color: '#f8fafc', fontSize: '1.8rem', fontWeight: 800, margin: '1rem 0 0.25rem' };
const h2Style    = { color: '#f8fafc', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' };
const bodyStyle  = { fontSize: '0.92rem' };
const mutedStyle = { color: '#7a8899', fontSize: '0.85rem' };
