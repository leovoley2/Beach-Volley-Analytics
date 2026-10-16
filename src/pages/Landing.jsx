import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LEGAL } from '../lib/legalConfig';

// Iconos de trazo (24×24, estilo lineal) — más sobrios que emojis.
const ICONS = {
    live: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></>,
    stats: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
    pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    arrow: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
};

function Icon({ name, size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

const FEATURES = [
    { icon: 'live', title: 'Tracker en vivo', text: 'Registra saque, recepción, ataque y defensa acción por acción, sin perder el ritmo del partido.' },
    { icon: 'map', title: 'Mapa de cancha', text: 'Visualiza trayectorias y zonas de ataque y defensa con marcadores por resultado.' },
    { icon: 'stats', title: 'Estadísticas por jugador', text: 'Eficacia, complejos y tendencias calculadas automáticamente, sin planillas.' },
    { icon: 'pdf', title: 'Informes en PDF', text: 'Exporta reportes profesionales para compartir con tu equipo (plan Pro).' },
];

const STEPS = [
    { n: '01', title: 'Crea el partido', text: 'Define tu equipo, el rival y la alineación en segundos.' },
    { n: '02', title: 'Registra en vivo', text: 'Marca cada acción desde el móvil mientras juega tu equipo.' },
    { n: '03', title: 'Analiza y exporta', text: 'Revisa estadísticas, mapas y descarga el informe en PDF.' },
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

    const supportHref = `mailto:${LEGAL.supportEmail}?subject=${encodeURIComponent('Soporte — Beach Volley Analytics')}`;

    return (
        <div className="lp">
            {/* NAV */}
            <nav className="lp-nav">
                <div className="lp-nav-inner">
                    <Link to="/" className="lp-logo" aria-label="Beach Volley Analytics — inicio">
                        <img src="/logo 1 oficial.png" alt="Beach Volley Analytics" />
                    </Link>
                    <div className="lp-nav-links">
                        <a href="#funciones">Funciones</a>
                        <a href="#como-funciona">Cómo funciona</a>
                        <a href="#planes">Planes</a>
                    </div>
                    <div className="lp-nav-actions">
                        <Link to="/login" className="lp-nav-login">Iniciar sesión</Link>
                        <Link to="/signup" className="lp-btn lp-btn-primary lp-btn-sm">Empezar gratis</Link>
                    </div>
                </div>
            </nav>

            {/* HERO */}
            <header className="lp-hero">
                <div className="lp-hero-grid" aria-hidden="true" />
                <div className="lp-hero-inner">
                    <div className="lp-eyebrow lp-rise" style={{ '--i': 0 }}>
                        <span className="lp-eyebrow-dot" />Análisis de vóley playa
                    </div>
                    <h1 className="lp-rise" style={{ '--i': 1 }}>
                        Gana más partidos con datos,<br />
                        <span className="lp-h1-muted">no con corazonadas.</span>
                    </h1>
                    <p className="lp-lead lp-rise" style={{ '--i': 2 }}>
                        Registra cada acción en vivo, visualiza trayectorias en la cancha y genera informes
                        profesionales de tu equipo de vóley playa. Todo desde el móvil.
                    </p>
                    <div className="lp-cta-row lp-rise" style={{ '--i': 3 }}>
                        <Link to="/signup" className="lp-btn lp-btn-primary lp-btn-lg">
                            Empezar gratis <Icon name="arrow" size={16} />
                        </Link>
                        <a href="#planes" className="lp-btn lp-btn-ghost lp-btn-lg">Ver planes</a>
                    </div>
                    <p className="lp-fineprint lp-rise" style={{ '--i': 4 }}>Gratis para empezar · Sin tarjeta de crédito</p>
                </div>

                {/* Preview del informe PDF, enmarcado como ventana de la app */}
                <figure className="lp-preview lp-rise" style={{ '--i': 5 }}>
                    <div className="lp-window">
                        <div className="lp-window-bar" aria-hidden="true">
                            <span /><span /><span />
                            <div className="lp-window-title">informe-peru-vs-brasil.pdf</div>
                        </div>
                        <div className="lp-window-body"><ReportPreview /></div>
                    </div>
                    <figcaption>Ejemplo de informe exportable en PDF con tus tendencias</figcaption>
                </figure>
            </header>

            {/* FEATURES */}
            <section id="funciones" className="lp-section">
                <div className="lp-section-head">
                    <div className="lp-kicker">Funciones</div>
                    <h2>Todo lo que necesitas para leer el partido</h2>
                    <p>Diseñado para registrar rápido en la arena y analizar con calma después.</p>
                </div>
                <div className="lp-features">
                    {FEATURES.map(f => (
                        <div key={f.title} className="lp-feature">
                            <div className="lp-feature-icon"><Icon name={f.icon} /></div>
                            <h3>{f.title}</h3>
                            <p>{f.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CÓMO FUNCIONA */}
            <section id="como-funciona" className="lp-band">
                <div className="lp-section">
                    <div className="lp-section-head">
                        <div className="lp-kicker">Cómo funciona</div>
                        <h2>De la cancha al informe en tres pasos</h2>
                    </div>
                    <ol className="lp-steps">
                        {STEPS.map(s => (
                            <li key={s.n} className="lp-step">
                                <span className="lp-step-num">{s.n}</span>
                                <h3>{s.title}</h3>
                                <p>{s.text}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* PLANES */}
            <section id="planes" className="lp-section lp-section-narrow">
                <div className="lp-section-head">
                    <div className="lp-kicker">Planes</div>
                    <h2>Precios simples</h2>
                    <p>Empieza gratis. Mejora cuando lo necesites.</p>
                </div>
                <div className="lp-plans">
                    {PLANS.map(p => (
                        <div key={p.name} className={`lp-plan${p.featured ? ' is-featured' : ''}`}>
                            <div className="lp-plan-top">
                                <span className="lp-plan-name">{p.name}</span>
                                {p.featured && <span className="lp-plan-badge">Más popular</span>}
                            </div>
                            <div className="lp-plan-price">
                                {p.price}<span>{p.period}</span>
                            </div>
                            <p className="lp-plan-desc">{p.desc}</p>
                            <Link to="/signup" className={`lp-btn lp-btn-block ${p.featured ? 'lp-btn-primary' : 'lp-btn-ghost'}`}>
                                {p.name === 'Free' ? 'Empezar gratis' : 'Elegir plan'}
                            </Link>
                            <ul className="lp-plan-items">
                                {p.items.map(it => (
                                    <li key={it}><Icon name="check" size={15} />{it}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="lp-section">
                <div className="lp-final">
                    <div className="lp-hero-grid" aria-hidden="true" />
                    <h2>Lleva a tu equipo al siguiente nivel</h2>
                    <p>Crea tu cuenta gratis y registra tu primer partido hoy mismo.</p>
                    <Link to="/signup" className="lp-btn lp-btn-primary lp-btn-lg">
                        Crear cuenta gratis <Icon name="arrow" size={16} />
                    </Link>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="lp-footer">
                <div className="lp-footer-inner">
                    <div>© {new Date().getFullYear()} Beach Volley Analytics</div>
                    <div className="lp-footer-links">
                        <Link to="/terms">Términos</Link>
                        <Link to="/privacy">Privacidad</Link>
                        <a href={supportHref}>Soporte</a>
                        <Link to="/login">Iniciar sesión</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
