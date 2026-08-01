import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
    { icon: '🎯', title: 'Tracker en vivo', text: 'Registra saque, recepción, ataque y defensa acción por acción, sin perder el ritmo del partido.' },
    { icon: '🗺️', title: 'Mapa de cancha', text: 'Visualiza trayectorias y zonas de ataque y defensa con marcadores por resultado.' },
    { icon: '📊', title: 'Estadísticas por jugador', text: 'Eficacia, complejos y tendencias calculadas automáticamente, sin planillas.' },
    { icon: '📄', title: 'Informes en PDF', text: 'Exporta reportes profesionales para compartir con tu equipo (plan Pro).' },
];

const STEPS = [
    { n: '1', title: 'Crea el partido', text: 'Define tu equipo, el rival y la alineación en segundos.' },
    { n: '2', title: 'Registra en vivo', text: 'Marca cada acción desde el móvil mientras juega tu equipo.' },
    { n: '3', title: 'Analiza y exporta', text: 'Revisa estadísticas, mapas y descarga el informe en PDF.' },
];

const PLANS = [
    { name: 'Free', price: '$0', period: '', desc: 'Para probar la plataforma.', items: ['2 partidos por mes', 'Tracker completo', 'Mapa de cancha'], featured: false },
    { name: 'Pro', price: '$10', period: '/ mes', desc: 'Para entrenadores activos.', items: ['Partidos ilimitados', 'Exportar PDF', 'Historial ilimitado'], featured: true },
    { name: 'Pro Anual', price: '$100', period: '/ año', desc: 'El mejor precio, un pago al año.', items: ['Todo lo de Pro', 'Equivale a ~2 meses gratis', 'Historial ilimitado'], featured: false },
];

// Mockup del informe PDF (SVG nítido y autocontenido) — muestra KPIs, tendencia
// por set y distribución de acciones, con la paleta real de la app.
function ReportPreview() {
    const F = 'Inter, sans-serif';
    // donut: r=54 → C≈339.29 · Positivo 58% / Negativo 22% / Overpass 20%
    const C = 339.29;
    return (
        <svg viewBox="0 0 680 460" width="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }} role="img" aria-label="Ejemplo de informe PDF con tendencias">
            <rect x="1" y="1" width="678" height="458" rx="16" fill="#ffffff" stroke="#e2e8f0" />

            {/* Header */}
            <text x="28" y="42" fontFamily={F} fontSize="21" fontWeight="800" fill="#0f172a">Informe de Rendimiento</text>
            <text x="28" y="64" fontFamily={F} fontSize="12.5" fill="#64748b">Perú vs Brasil · Torneo Nacional · 3 sets</text>
            <rect x="590" y="26" width="62" height="26" rx="13" fill="#fff7ed" stroke="#f97316" />
            <text x="621" y="44" fontFamily={F} fontSize="12" fontWeight="700" fill="#f97316" textAnchor="middle">PDF</text>

            {/* KPI tiles */}
            {[
                { x: 28, label: 'Eficacia de ataque', value: '68%', delta: '▲ 12%' },
                { x: 242, label: 'Recepción positiva', value: '74%', delta: '▲ 6%' },
                { x: 456, label: 'Puntos de saque', value: '18', delta: '▲ 4' },
            ].map((t, i) => (
                <g key={i}>
                    <rect x={t.x} y="82" width="196" height="72" rx="10" fill="#f8fafc" stroke="#eef2f7" />
                    <text x={t.x + 16} y="107" fontFamily={F} fontSize="11.5" fill="#64748b">{t.label}</text>
                    <text x={t.x + 16} y="138" fontFamily={F} fontSize="26" fontWeight="800" fill="#0f172a">{t.value}</text>
                    <text x={t.x + 180} y="107" fontFamily={F} fontSize="11.5" fontWeight="700" fill="#16a34a" textAnchor="end">{t.delta}</text>
                </g>
            ))}

            {/* Gráfico de tendencia por set */}
            <text x="28" y="188" fontFamily={F} fontSize="13" fontWeight="700" fill="#0f172a">Tendencia de ataque por set</text>
            {/* gridlines */}
            {[220, 280, 340, 402].map((y, i) => (
                <line key={i} x1="40" y1={y} x2="316" y2={y} stroke={y === 402 ? '#e2e8f0' : '#f1f5f9'} strokeWidth="1" />
            ))}
            {/* barras: 52 / 61 / 70 % (factor 2.5, baseline 402) */}
            {[
                { x: 52, v: 52, top: 272 },
                { x: 148, v: 61, top: 249 },
                { x: 244, v: 70, top: 227 },
            ].map((b, i) => (
                <g key={i}>
                    <rect x={b.x} y={b.top} width="56" height={402 - b.top} rx="5" fill="#f97316" opacity={0.55 + i * 0.22} />
                    <text x={b.x + 28} y={b.top - 8} fontFamily={F} fontSize="12" fontWeight="700" fill="#0f172a" textAnchor="middle">{b.v}%</text>
                    <text x={b.x + 28} y="420" fontFamily={F} fontSize="11" fill="#64748b" textAnchor="middle">{`Set ${i + 1}`}</text>
                </g>
            ))}
            {/* línea de tendencia */}
            <polyline points="80,272 176,249 272,227" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="4 4" />
            {[[80, 272], [176, 249], [272, 227]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="#ffffff" stroke="#f97316" strokeWidth="2" />
            ))}

            {/* Donut de distribución */}
            <text x="372" y="188" fontFamily={F} fontSize="13" fontWeight="700" fill="#0f172a">Distribución de acciones</text>
            <g transform="rotate(-90 430 300)">
                <circle cx="430" cy="300" r="54" fill="none" stroke="#eef2f7" strokeWidth="20" />
                <circle cx="430" cy="300" r="54" fill="none" stroke="#22c55e" strokeWidth="20" strokeDasharray={`${0.58 * C} ${C}`} strokeDashoffset="0" />
                <circle cx="430" cy="300" r="54" fill="none" stroke="#dc2626" strokeWidth="20" strokeDasharray={`${0.22 * C} ${C}`} strokeDashoffset={`${-0.58 * C}`} />
                <circle cx="430" cy="300" r="54" fill="none" stroke="#ca8a04" strokeWidth="20" strokeDasharray={`${0.20 * C} ${C}`} strokeDashoffset={`${-0.80 * C}`} />
            </g>
            <text x="430" y="296" fontFamily={F} fontSize="22" fontWeight="800" fill="#0f172a" textAnchor="middle">58%</text>
            <text x="430" y="316" fontFamily={F} fontSize="11" fill="#64748b" textAnchor="middle">Positivo</text>
            {/* leyenda */}
            {[
                { c: '#22c55e', l: 'Positivo', p: '58%', y: 268 },
                { c: '#dc2626', l: 'Negativo', p: '22%', y: 298 },
                { c: '#ca8a04', l: 'Overpass', p: '20%', y: 328 },
            ].map((row, i) => (
                <g key={i}>
                    <rect x="516" y={row.y} width="12" height="12" rx="3" fill={row.c} />
                    <text x="536" y={row.y + 11} fontFamily={F} fontSize="12" fill="#334155">{row.l}</text>
                    <text x="644" y={row.y + 11} fontFamily={F} fontSize="12" fontWeight="700" fill="#0f172a" textAnchor="end">{row.p}</text>
                </g>
            ))}
        </svg>
    );
}

export default function Landing() {
    const { user, loading } = useAuth();

    // Si ya inició sesión, no mostramos la landing: directo al dashboard.
    if (!loading && user) return <Navigate to="/dashboard" replace />;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
            {/* NAV */}
            <nav style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                maxWidth: 1120, margin: '0 auto', padding: '1.1rem 1.5rem',
            }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                    🏐 Beach Volley <span style={{ color: 'var(--accent)' }}>Analytics</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}>
                        Iniciar sesión
                    </Link>
                    <Link to="/signup" className="landing-btn-primary">Empezar gratis</Link>
                </div>
            </nav>

            {/* HERO */}
            <header style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
                    width: 900, height: 600, background: 'radial-gradient(circle, rgba(249,115,22,0.18), transparent 60%)',
                    pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', maxWidth: 820, margin: '0 auto', padding: '5rem 1.5rem 4rem', textAlign: 'center' }}>
                    <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 50, padding: '0.3rem 0.85rem', marginBottom: '1.5rem' }}>
                        Análisis de vóley playa
                    </div>
                    <h1 style={{ fontSize: 'clamp(2.1rem, 6vw, 3.6rem)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.035em', marginBottom: '1.25rem' }}>
                        Gana más partidos con <span style={{ color: 'var(--accent)' }}>datos</span>, no con corazonadas.
                    </h1>
                    <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 620, margin: '0 auto 2rem' }}>
                        Registra cada acción en vivo, visualiza trayectorias en la cancha y genera informes
                        profesionales de tu equipo de vóley playa. Todo desde el móvil.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/signup" className="landing-btn-primary landing-btn-lg">Empezar gratis</Link>
                        <a href="#planes" className="landing-btn-ghost landing-btn-lg">Ver planes</a>
                    </div>
                    <p style={{ marginTop: '1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Gratis para empezar · Sin tarjeta de crédito
                    </p>

                    {/* Preview del informe PDF */}
                    <div style={{ maxWidth: 640, margin: '3rem auto 0' }}>
                        <div style={{
                            borderRadius: 16, overflow: 'hidden', background: '#fff',
                            boxShadow: '0 24px 70px rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            <ReportPreview />
                        </div>
                        <p style={{ marginTop: '0.85rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Ejemplo de informe exportable en PDF con tus tendencias
                        </p>
                    </div>
                </div>
            </header>

            {/* FEATURES */}
            <section style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.1rem' }}>
                    {FEATURES.map(f => (
                        <div key={f.title} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.6rem' }}>
                            <div style={{ fontSize: '1.9rem', marginBottom: '0.75rem' }}>{f.icon}</div>
                            <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '0.4rem' }}>{f.title}</h3>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{f.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CÓMO FUNCIONA */}
            <section style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '4rem 1.5rem' }}>
                    <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.6rem' }}>Cómo funciona</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>De la cancha al informe en tres pasos.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                        {STEPS.map(s => (
                            <div key={s.n} style={{ textAlign: 'center' }}>
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>{s.n}</div>
                                <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '0.4rem' }}>{s.title}</h3>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 280, margin: '0 auto' }}>{s.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PLANES */}
            <section id="planes" style={{ maxWidth: 1040, margin: '0 auto', padding: '4.5rem 1.5rem' }}>
                <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.6rem' }}>Planes simples</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>Empieza gratis. Mejora cuando lo necesites.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                    {PLANS.map(p => (
                        <div key={p.name} style={{
                            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '2rem',
                            border: `1px solid ${p.featured ? 'var(--accent)' : 'var(--border)'}`,
                            boxShadow: p.featured ? '0 0 0 1px var(--accent), 0 8px 32px rgba(249,115,22,0.15)' : 'none',
                            position: 'relative',
                        }}>
                            {p.featured && (
                                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.75rem', borderRadius: 50, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Más popular</div>
                            )}
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>{p.name}</div>
                            <div style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.25rem' }}>
                                {p.price} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{p.period}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.4rem' }}>{p.desc}</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.6rem' }}>
                                {p.items.map(it => (
                                    <li key={it} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.86rem', color: 'var(--text-secondary)', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ color: 'var(--c-pos)', fontWeight: 700 }}>✓</span>{it}
                                    </li>
                                ))}
                            </ul>
                            <Link to="/signup" className={p.featured ? 'landing-btn-primary landing-btn-block' : 'landing-btn-ghost landing-btn-block'}>
                                {p.name === 'Free' ? 'Empezar gratis' : 'Elegir plan'}
                            </Link>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA FINAL */}
            <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 1.5rem 5rem' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.14), rgba(59,130,246,0.10))', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '3rem 1.5rem', textAlign: 'center' }}>
                    <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>Lleva a tu equipo al siguiente nivel</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', maxWidth: 520, margin: '0 auto 1.75rem' }}>Crea tu cuenta gratis y registra tu primer partido hoy mismo.</p>
                    <Link to="/signup" className="landing-btn-primary landing-btn-lg">Crear cuenta gratis</Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ borderTop: '1px solid var(--border)' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1.75rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>© {new Date().getFullYear()} Beach Volley Analytics</div>
                    <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.82rem' }}>
                        <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Términos</Link>
                        <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacidad</Link>
                        <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Iniciar sesión</Link>
                    </div>
                </div>
            </footer>

            <style>{`
                .landing-btn-primary {
                    display: inline-block; background: var(--accent); color: #fff; font-weight: 700;
                    font-size: 0.9rem; padding: 0.6rem 1.1rem; border-radius: var(--radius);
                    text-decoration: none; border: none; transition: var(--trans);
                    box-shadow: 0 2px 12px rgba(249,115,22,0.3);
                }
                .landing-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
                .landing-btn-ghost {
                    display: inline-block; background: transparent; color: var(--text-primary); font-weight: 700;
                    font-size: 0.9rem; padding: 0.6rem 1.1rem; border-radius: var(--radius);
                    text-decoration: none; border: 1.5px solid var(--border); transition: var(--trans);
                }
                .landing-btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
                .landing-btn-lg { padding: 0.85rem 1.75rem; font-size: 1rem; }
                .landing-btn-block { display: block; width: 100%; text-align: center; box-sizing: border-box; }
            `}</style>
        </div>
    );
}
