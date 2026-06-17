import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL } from '../lib/legalConfig';

/**
 * Política de Privacidad.
 *
 * PLANTILLA BASE — revisa con un abogado antes de producción y completa
 * los datos del responsable en src/lib/legalConfig.js. Está alineada con
 * la Ley N.º 29733 (Perú) y principios del RGPD (UE).
 */
export default function Privacy() {
    return (
        <div className="legal-wrap" style={legalWrapStyle}>
            <div style={legalCardStyle}>
                <Link to="/login" style={backLinkStyle}>← Volver</Link>
                <h1 style={h1Style}>Política de Privacidad</h1>
                <p style={mutedStyle}>Última actualización: {LEGAL.lastUpdated}</p>

                <Section title="1. Responsable del tratamiento">
                    <p>El responsable del tratamiento de tus datos personales es <strong>{LEGAL.companyName}</strong>
                    {LEGAL.companyId ? <> (identificación: {LEGAL.companyId})</> : null}, con domicilio en {LEGAL.address}.
                    Para cualquier consulta sobre privacidad puedes escribir a <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>
                </Section>

                <Section title="2. Qué datos recopilamos">
                    <ul>
                        <li><strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña (almacenada cifrada por nuestro proveedor de autenticación, Supabase).</li>
                        <li><strong>Datos de uso de la app:</strong> partidos, jugadores, estadísticas y análisis que tú registras.</li>
                        <li><strong>Datos de pago:</strong> gestionados por la pasarela de pago (Mercado Pago). No almacenamos los datos de tu tarjeta en nuestros servidores.</li>
                        <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador y registros de acceso, usados para seguridad y prevención de abuso.</li>
                    </ul>
                </Section>

                <Section title="3. Con qué finalidad y base legal">
                    <ul>
                        <li>Prestarte el servicio y mantener tu cuenta (ejecución del contrato).</li>
                        <li>Procesar pagos de suscripción (ejecución del contrato).</li>
                        <li>Garantizar la seguridad y prevenir fraude o abuso (interés legítimo).</li>
                        <li>Enviarte comunicaciones sobre el servicio (ejecución del contrato) y, si lo autorizas, novedades (consentimiento).</li>
                    </ul>
                </Section>

                <Section title="4. Con quién compartimos tus datos">
                    <p>Solo compartimos datos con proveedores que nos ayudan a operar el servicio, bajo acuerdos de confidencialidad:</p>
                    <ul>
                        <li><strong>Supabase</strong> — base de datos y autenticación.</li>
                        <li><strong>Mercado Pago</strong> — procesamiento de pagos.</li>
                        <li><strong>Vercel</strong> — alojamiento de la aplicación.</li>
                    </ul>
                    <p>No vendemos tus datos personales a terceros. Algunos proveedores pueden procesar datos fuera de tu país; en esos casos se aplican garantías adecuadas.</p>
                </Section>

                <Section title="5. Aislamiento y seguridad de los datos">
                    <p>Aplicamos seguridad a nivel de fila (Row Level Security): cada usuario solo puede acceder a sus propios datos.
                    Usamos cifrado en tránsito (HTTPS), contraseñas cifradas, límites de intentos de inicio de sesión y límites de
                    frecuencia de peticiones para proteger tu cuenta frente a accesos no autorizados y abuso automatizado.</p>
                </Section>

                <Section title="6. Cuánto tiempo conservamos tus datos">
                    <p>Conservamos tus datos mientras tu cuenta esté activa. Si cierras tu cuenta, los eliminamos o anonimizamos en un plazo
                    razonable, salvo que debamos conservarlos por obligaciones legales (por ejemplo, contables o fiscales).</p>
                </Section>

                <Section title="7. Tus derechos">
                    <p>Puedes ejercer tus derechos de acceso, rectificación, cancelación/supresión, oposición y portabilidad escribiendo a {' '}
                    <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. En Perú, también puedes presentar un reclamo ante la
                    Autoridad Nacional de Protección de Datos Personales (ANPD). En la UE, ante tu autoridad de control local.</p>
                </Section>

                <Section title="8. Menores de edad">
                    <p>El servicio no está dirigido a menores de {LEGAL.minAge} años. Si eres menor, debes contar con autorización de tu
                    padre, madre o tutor para usar la aplicación.</p>
                </Section>

                <Section title="9. Cookies y almacenamiento local">
                    <p>Usamos almacenamiento local del navegador para mantener tu sesión iniciada y proteger el formulario de acceso frente a
                    intentos abusivos. No usamos cookies de publicidad de terceros.</p>
                </Section>

                <Section title="10. Cambios en esta política">
                    <p>Podemos actualizar esta política. Publicaremos la versión vigente en esta página con su fecha de actualización.</p>
                </Section>

                <p style={mutedStyle}>¿Dudas? Escríbenos a <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>
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
const h1Style    = { color: '#f8fafc', fontSize: '1.8rem', fontWeight: 800, margin: '1rem 0 0.25rem' };
const h2Style    = { color: '#f8fafc', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' };
const bodyStyle  = { fontSize: '0.92rem' };
const mutedStyle = { color: '#7a8899', fontSize: '0.85rem' };
