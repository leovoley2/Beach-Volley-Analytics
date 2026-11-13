import React, { useState, useMemo, useRef } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PlayerReport from './PlayerReport';
import { SKILL_DETAILS, baseSkillOf } from '../lib/scoutingDetails';
import { formatDay } from '../lib/matchGrouping';
import { IconEdit, IconDownload, IconLock, IconFilter } from './Icons';

const SKILLS = ['Saque', 'Recepción', 'Armado', 'Ataque Contundente', 'Ataque Coloque', 'Ataque 2 Toques', 'Bloqueo', 'Defensa'];
const SVG_WIDTH = 500, SVG_HEIGHT = 300, COURT_X_PADDING = 50, COURT_Y_PADDING = 50;
const COURT_WIDTH = SVG_WIDTH - 2 * COURT_X_PADDING, COURT_HEIGHT = SVG_HEIGHT - 2 * COURT_Y_PADDING;

// PDF: el informe se captura siempre a este ancho CSS (layout de escritorio)
// y se reparte en hojas A4 con este margen (pt).
const PDF_CAPTURE_WIDTH = 1000;
const PDF_MARGIN = 24;

/**
 * Devuelve dónde terminar la página que empieza en `startY` (px del canvas).
 * Busca, subiendo desde el límite de la hoja, una fila completamente blanca
 * (hueco entre secciones) para no cortar una gráfica o una tabla por la mitad.
 * Si no hay ninguna en el último 30% de la hoja, corta en el límite.
 */
function findPageBreak(canvas, startY, pageHeightPx) {
    const limit = startY + pageHeightPx;
    if (limit >= canvas.height) return canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const minY = startY + Math.floor(pageHeightPx * 0.7);
    for (let y = limit; y > minY; y--) {
        const row = ctx.getImageData(0, y, canvas.width, 1).data;
        let blank = true;
        for (let i = 0; i < row.length; i += 4) {
            if (row[i] < 250 || row[i + 1] < 250 || row[i + 2] < 250) { blank = false; break; }
        }
        if (blank) return y;
    }
    return limit;
}

// Palette of distinct player colors (start marker)
const PLAYER_COLORS = [
    '#f97316', // orange
    '#3b82f6', // blue
    '#a855f7', // purple
    '#10b981', // emerald
    '#f43f5e', // rose
    '#06b6d4', // cyan
    '#eab308', // yellow
    '#ec4899', // pink
];

function CourtSVG({ actions, playerColors, playerIdentifiers }) {
    const getOutcomeClass = (o) =>
        o === 'Doble Positivo' ? 'marker-positivo' : o === 'Doble Negativo' ? 'marker-negativo' : 'marker-neutro';

    const attackActions = actions.filter(a => a.x != null);

    return (
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="volleyball-court" style={{ cursor: 'default' }}>
            {/* Background */}
            <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="#fdf6e3" />
            {/* Court surface */}
            <rect x={COURT_X_PADDING} y={COURT_Y_PADDING} width={COURT_WIDTH} height={COURT_HEIGHT} fill="#ffe8a1" stroke="#6d6d72" strokeWidth="1" />
            {/* Net */}
            <line x1={SVG_WIDTH / 2} y1={COURT_Y_PADDING} x2={SVG_WIDTH / 2} y2={COURT_Y_PADDING + COURT_HEIGHT} stroke="#6d6d72" strokeWidth="2" strokeDasharray="4" />

            {attackActions.map((action, i) => {
                const x2 = action.x * SVG_WIDTH;
                const y2 = action.y * SVG_HEIGHT;
                const playerColor = playerColors[action.playerId] || '#888';

                if (action.startX == null) {
                    // Single-point shot (no start marker)
                    return (
                        <g key={i} transform={`translate(${x2}, ${y2})`}>
                            <circle r="8" className={`court-marker ${getOutcomeClass(action.outcome)}`} />
                            <text textAnchor="middle" dy=".3em" style={{ fontSize: '8px', fill: 'white', fontWeight: 'bold' }}>
                                {playerIdentifiers[action.playerId]}
                            </text>
                        </g>
                    );
                }

                const x1 = action.startX * SVG_WIDTH;
                const y1 = action.startY * SVG_HEIGHT;
                const isColoque = action.skill === 'Ataque Coloque';
                const isContundente = action.skill === 'Ataque Contundente';
                const is2Toques = action.skill === 'Ataque 2 Toques';
                const cx = (x1 + x2) / 2;
                const cy = (y1 + y2) / 2 - 55;

                return (
                    <g key={i}>
                        {/* Start marker - player color */}
                        <circle cx={x1} cy={y1} r="7" fill={playerColor} stroke="white" strokeWidth="1.5" opacity="0.95" />
                        <text x={x1} y={y1} textAnchor="middle" dy=".35em" style={{ fontSize: '7px', fill: 'white', fontWeight: 'bold' }}>
                            {playerIdentifiers[action.playerId]}
                        </text>

                        {/* Trajectory line */}
                        {isColoque ? (
                            <path
                                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                                fill="none" stroke="#9b59b6" strokeWidth="1.8"
                                strokeDasharray="4 3" strokeLinecap="round" opacity="0.75"
                            />
                        ) : isContundente ? (
                            <line x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke="#e74c3c" strokeWidth="2.8" strokeLinecap="round" opacity="0.8" />
                        ) : is2Toques ? (
                            <path
                                d={`M ${x1} ${y1} Q ${cx} ${cy + 30} ${x2} ${y2}`}
                                fill="none" stroke="#14b8a6" strokeWidth="2"
                                strokeDasharray="6 3" strokeLinecap="round" opacity="0.85"
                            />
                        ) : (
                            <line x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeDasharray="5 3" />
                        )}

                        {/* End marker — outcome color */}
                        <g transform={`translate(${x2}, ${y2})`}>
                            <circle r="8" className={`court-marker ${getOutcomeClass(action.outcome)}`} />
                            <text textAnchor="middle" dy=".3em" style={{ fontSize: '8px', fill: 'white', fontWeight: 'bold' }}>
                                {playerIdentifiers[action.playerId]}
                            </text>
                        </g>
                    </g>
                );
            })}
        </svg>
    );
}

// Compute player stats from a filtered action list
function computeStats(selectedMatch, filteredActions) {
    const playerStats = {};
    const allPlayers = [
        ...(selectedMatch.ownPlayers || []),
        ...(selectedMatch.opponentPlayers || []),
    ];
    allPlayers.forEach(player => {
        playerStats[player.id] = { name: player.name, skills: {} };
        SKILLS.forEach(skill => {
            playerStats[player.id].skills[skill] = {
                total: 0, 'Doble Positivo': 0, 'Positivo': 0, 'Overpass': 0, 'Negativo': 0, 'Doble Negativo': 0,
            };
        });
    });
    filteredActions.forEach(action => {
        if (action && playerStats[action.playerId] && playerStats[action.playerId].skills[action.skill]) {
            const s = playerStats[action.playerId].skills[action.skill];
            s.total++;
            if (s[action.outcome] !== undefined) s[action.outcome]++;
        }
    });
    return playerStats;
}

function FilterRow({ label, children }) {
    return (
        <div className="rf-row">
            <span className="rf-label">{label}</span>
            <div className="rf-opts">{children}</div>
        </div>
    );
}

function ReportViewer({ onGoToTracker, isPaid = false, matchId = null }) {
    const { matches, setCurrentMatch, currentMatch } = useMatches();
    // Si se pasa matchId, pre-seleccionar ese partido automáticamente
    const [selectedMatchId, setSelectedMatchId] = useState(matchId || '');
    const [selectedSet, setSelectedSet] = useState(null);
    const [complexFilter, setComplexFilter] = useState(null);
    const [playerFilter, setPlayerFilter] = useState(null);
    const [attackFilter, setAttackFilter] = useState(null);
    // Filtros por detalle de scouting: { [dimKey]: opción } (p. ej. { tipoSaque: 'Flotante' })
    const [detailFilters, setDetailFilters] = useState({});
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const reportContentRef = useRef(null);

    // Cuando matchId cambia (navegación), actualizar selección
    React.useEffect(() => {
        if (matchId) setSelectedMatchId(matchId);
    }, [matchId]);

    const selectedMatch = useMemo(() => {
        if (matchId && currentMatch?.id === matchId) return currentMatch;
        return matches.find(m => m.id === selectedMatchId) || null;
    }, [selectedMatchId, matches, matchId, currentMatch]);

    // Clic en un número de la tabla → pestaña Video con exactamente esas acciones (solo PRO).
    const navigate = useNavigate();
    const openClips = isPaid && matchId
        ? (clipActions, label) => navigate(`/match/${matchId}/video`, {
            state: { clipIds: clipActions.map(a => a.id).filter(Boolean), label },
        })
        : null;

    const handleMatchChange = (e) => {
        setSelectedMatchId(e.target.value);
        setSelectedSet(null);
        setComplexFilter(null);
        setPlayerFilter(null);
        setAttackFilter(null);
        setDetailFilters({});
    };

    // Alterna un filtro de detalle (volver a pulsar la misma opción lo quita).
    const toggleDetailFilter = (key, value) => {
        setDetailFilters(prev => {
            const next = { ...prev };
            if (next[key] === value) delete next[key];
            else next[key] = value;
            return next;
        });
    };
    const clearDetailFilter = (key) => {
        setDetailFilters(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const allPlayers = useMemo(() => {
        if (!selectedMatch) return [];
        return [
            ...(selectedMatch.ownPlayers || []),
            ...(selectedMatch.opponentPlayers || []),
        ];
    }, [selectedMatch]);

    // Assign a unique color per player
    const playerColors = useMemo(() => {
        if (!selectedMatch) return {};
        const colors = {};
        const allPlayers = [
            ...(selectedMatch.ownPlayers || []),
            ...(selectedMatch.opponentPlayers || []),
        ];
        allPlayers.forEach((p, i) => {
            colors[p.id] = PLAYER_COLORS[i % PLAYER_COLORS.length];
        });
        return colors;
    }, [selectedMatch]);

    const playerIdentifiers = useMemo(() => {
        if (!selectedMatch) return {};
        const identifiers = {};
        (selectedMatch.ownPlayers || []).forEach((p, i) => { identifiers[p.id] = `J${i + 1}`; });
        (selectedMatch.opponentPlayers || []).forEach((p, i) => { identifiers[p.id] = `R${i + 1}`; });
        return identifiers;
    }, [selectedMatch]);

    // Dimensiones de detalle que realmente tienen datos en este partido (para mostrar filtros).
    const availableDetailDims = useMemo(() => {
        if (!selectedMatch) return [];
        const acts = (selectedMatch.actions || []).filter(a => a.skill && a.detail);
        const out = [];
        Object.entries(SKILL_DETAILS).forEach(([base, dims]) => {
            dims.forEach(dim => {
                const options = dim.options.filter(opt =>
                    acts.some(a => baseSkillOf(a.skill) === base && a.detail?.[dim.key] === opt)
                );
                if (options.length > 0) out.push({ base, dim, options });
            });
        });
        return out;
    }, [selectedMatch]);

    // Actions filtered by set + complex + player + attack + detalles (stats, charts, court map)
    const filteredActions = useMemo(() => {
        if (!selectedMatch) return [];
        // Excluir acciones de ajuste manual del marcador (no son acciones de juego).
        let all = (selectedMatch.actions || []).filter(a => a.skill);
        if (selectedSet !== null) all = all.filter(a => a.setIndex === selectedSet);
        if (complexFilter !== null) all = all.filter(a => a.complex === complexFilter);
        if (playerFilter !== null) all = all.filter(a => a.playerId === playerFilter);
        if (attackFilter !== null) all = all.filter(a => a.skill === attackFilter);
        Object.entries(detailFilters).forEach(([key, value]) => {
            all = all.filter(a => a.detail?.[key] === value);
        });
        return all;
    }, [selectedMatch, selectedSet, complexFilter, playerFilter, attackFilter, detailFilters]);

    // Stats derived from filtered actions
    const stats = useMemo(() => {
        if (!selectedMatch) return null;
        try { return computeStats(selectedMatch, filteredActions); }
        catch (err) { console.error(err); return null; }
    }, [selectedMatch, filteredActions]);

    const generatePdf = async () => {
        // Gate de plan: el PDF es sólo para pago. Guard defensivo por si se
        // intenta invocar sin pasar por el botón (el botón ya lo oculta al Free).
        if (!isPaid) { window.location.href = '/pricing'; return; }
        const reportElement = reportContentRef.current;
        if (!reportElement) return;
        setIsGeneratingPdf(true);
        try {
            // Captura a un ancho fijo "de escritorio", sea cual sea el dispositivo: el clon
            // se renderiza en un iframe de PDF_CAPTURE_WIDTH px, así las media queries
            // móviles no se aplican y el PDF sale igual desde un teléfono o un PC.
            const canvas = await html2canvas(reportElement, {
                scale: 2,
                backgroundColor: '#ffffff',
                windowWidth: PDF_CAPTURE_WIDTH,
                onclone: (_doc, el) => {
                    el.style.width = `${PDF_CAPTURE_WIDTH}px`;
                    el.style.maxWidth = 'none';
                    el.style.margin = '0';
                    el.style.border = 'none';
                    el.style.borderRadius = '0';
                },
            });

            const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const contentWidth = pdfWidth - PDF_MARGIN * 2;
            const pxPerPt = canvas.width / contentWidth;              // el informe ocupa todo el ancho útil
            const pageHeightPx = Math.floor((pdfHeight - PDF_MARGIN * 2) * pxPerPt);

            // Reparte el informe en varias hojas A4, cortando en filas en blanco
            // (espacio entre secciones) para no partir gráficas ni tablas.
            let y = 0;
            let first = true;
            while (y < canvas.height) {
                const end = findPageBreak(canvas, y, pageHeightPx);
                const slice = document.createElement('canvas');
                slice.width = canvas.width;
                slice.height = end - y;
                slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
                if (!first) pdf.addPage();
                pdf.addImage(slice, 'PNG', PDF_MARGIN, PDF_MARGIN, contentWidth, slice.height / pxPerPt);
                first = false;
                y = end;
            }

            let filenameParts = ['informe', selectedMatch.ownTeamName.replace(/\s+/g, '_')];
            if (selectedSet !== null) filenameParts.push(`Set${selectedSet + 1}`);
            if (complexFilter !== null) filenameParts.push(complexFilter);
            if (attackFilter !== null) filenameParts.push(
                attackFilter === 'Ataque Contundente' ? 'Contundente' :
                attackFilter === 'Ataque Coloque' ? 'Coloque' : '2Toques'
            );
            if (playerFilter !== null) {
                const p = allPlayers.find(p => p.id === playerFilter);
                if (p) filenameParts.push(p.name.replace(/\s+/g, '_'));
            }
            Object.values(detailFilters).forEach(v => filenameParts.push(String(v).replace(/\s+/g, '_')));
            pdf.save(`${filenameParts.join('_')}.pdf`);
        } catch (err) {
            console.error('Error generando el PDF:', err);
            alert('No se pudo generar el PDF. Inténtalo de nuevo.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleGoToMatch = () => {
        if (!selectedMatch) return;
        setCurrentMatch(selectedMatch);
        onGoToTracker();
    };

    const clearFilters = () => {
        setSelectedSet(null); setComplexFilter(null); setPlayerFilter(null); setAttackFilter(null); setDetailFilters({});
    };
    const activeFilters = [selectedSet !== null, complexFilter, playerFilter, attackFilter].filter(Boolean).length
        + Object.keys(detailFilters).length;
    const reportPlayers = stats
        ? Object.keys(stats).filter(id => Object.values(stats[id].skills).some(sk => sk.total > 0))
        : [];
    const jumpTo = (id) => document.getElementById(`jugador-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const ATTACKS = [
        { key: 'Ataque Contundente', label: 'Contundente', color: '#e74c3c' },
        { key: 'Ataque Coloque', label: 'Coloque', color: '#a855f7' },
        { key: 'Ataque 2 Toques', label: '2 Toques', color: '#14b8a6' },
    ];

    return (
        <div className="report-shell">
            {!matchId && (
                <div className="form-group">
                    <label>Selecciona un partido para analizar:</label>
                    <select onChange={handleMatchChange} value={selectedMatchId}>
                        <option value="">-- Elige un partido --</option>
                        {matches.map(match => (
                            <option key={match.id} value={match.id}>
                                {`${match.date} - ${match.ownTeamName} vs ${match.opponentTeamName}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {selectedMatch && stats && (
                <div className="report-content">
                    {/* Resumen del partido */}
                    <section className="rhero">
                        <div className="rhero-main">
                            <div className="rhero-kicker">
                                Tendencias · {selectedMatch.matchType === 'scouting' ? 'Scouting' : 'Análisis K1/K2'}
                            </div>
                            <div className="mboard mboard--lg" style={{ '--sets': selectedMatch.sets.length }}>
                                {[['own', selectedMatch.ownTeamName], ['opponent', selectedMatch.opponentTeamName]].map(([side, name]) => {
                                    const other = side === 'own' ? 'opponent' : 'own';
                                    const won = selectedMatch.score[side], lost = selectedMatch.score[other];
                                    const decided = selectedMatch.status === 'completed' && won !== lost;
                                    return (
                                        <div key={side} className={`mboard-line${decided ? (won > lost ? ' win' : ' lose') : ''}`}>
                                            <span className="mboard-name">{name}</span>
                                            <span className="mboard-sets num">{won}</span>
                                            {selectedMatch.sets.map((st, i) => (
                                                <span key={i} className={`mboard-pt num${st[side] > st[other] ? ' hi' : ''}`}>{st[side]}</span>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="rhero-meta">
                                {[selectedMatch.tournament, selectedMatch.date && formatDay(selectedMatch.date), selectedMatch.location,
                                    `${(selectedMatch.actions || []).filter(a => a.skill).length} acciones`].filter(Boolean).join(' · ')}
                            </div>
                        </div>
                        <div className="rhero-actions">
                            <button onClick={handleGoToMatch} className="btn-ghost" title="Volver al partido para corregir acciones">
                                <IconEdit size={14} /> Corregir acciones
                            </button>
                            {isPaid ? (
                                <button onClick={generatePdf} className="btn-new" disabled={isGeneratingPdf}>
                                    <IconDownload size={15} /> {isGeneratingPdf ? 'Generando PDF…' : 'Descargar PDF'}
                                </button>
                            ) : (
                                <button className="btn-new" onClick={() => window.location.href = '/pricing'} title="Actualiza a Pro para exportar PDF">
                                    <IconLock size={14} /> PDF · Plan Pro
                                </button>
                            )}
                        </div>
                    </section>

                    {/* Filtros */}
                    <section className="rfilters">
                        <div className="rfilters-head">
                            <span><IconFilter size={14} /> Filtros{activeFilters > 0 && <b>{activeFilters}</b>}</span>
                            <span className="rfilters-count">{filteredActions.length} acciones en el informe</span>
                            {activeFilters > 0 && <button className="rf-clear" onClick={clearFilters}>Limpiar</button>}
                        </div>

                        <FilterRow label="Set">
                            <button className={`rf-chip${selectedSet === null ? ' on' : ''}`} onClick={() => setSelectedSet(null)}>Todos</button>
                            {selectedMatch.sets.map((st, i) => (
                                <button key={i} className={`rf-chip${selectedSet === i ? ' on' : ''}`} onClick={() => setSelectedSet(selectedSet === i ? null : i)}>
                                    Set {i + 1} <small>{st.own}–{st.opponent}</small>
                                </button>
                            ))}
                        </FilterRow>

                        <FilterRow label="Jugador">
                            <button className={`rf-chip${playerFilter === null ? ' on' : ''}`} onClick={() => setPlayerFilter(null)}>Todos</button>
                            {allPlayers.map(pl => (
                                <button key={pl.id} className={`rf-chip${playerFilter === pl.id ? ' on' : ''}`} style={{ '--chip': playerColors[pl.id] }}
                                    onClick={() => setPlayerFilter(playerFilter === pl.id ? null : pl.id)}>
                                    <i className="rf-dot" /> {pl.name}
                                </button>
                            ))}
                        </FilterRow>

                        {selectedMatch.matchType !== 'scouting' && (
                            <FilterRow label="Complejo">
                                <button className={`rf-chip${complexFilter === null ? ' on' : ''}`} onClick={() => setComplexFilter(null)}>Todos</button>
                                <button className={`rf-chip${complexFilter === 'K1' ? ' on' : ''}`} style={{ '--chip': '#3b82f6' }}
                                    onClick={() => setComplexFilter(complexFilter === 'K1' ? null : 'K1')} title="K1: Recepción → Armado → Ataque">
                                    K1 · Recepción
                                </button>
                                <button className={`rf-chip${complexFilter === 'K2' ? ' on' : ''}`} style={{ '--chip': '#a855f7' }}
                                    onClick={() => setComplexFilter(complexFilter === 'K2' ? null : 'K2')} title="K2: Saque → Defensa → Armado → Ataque">
                                    K2 · Transición
                                </button>
                            </FilterRow>
                        )}

                        <FilterRow label="Tipo de ataque">
                            <button className={`rf-chip${attackFilter === null ? ' on' : ''}`} onClick={() => setAttackFilter(null)}>Todos</button>
                            {ATTACKS.map(at => (
                                <button key={at.key} className={`rf-chip${attackFilter === at.key ? ' on' : ''}`} style={{ '--chip': at.color }}
                                    onClick={() => setAttackFilter(attackFilter === at.key ? null : at.key)}>
                                    <i className="rf-dot" /> {at.label}
                                </button>
                            ))}
                        </FilterRow>

                        {/* Detalles de scouting — solo dimensiones con datos en el partido */}
                        {availableDetailDims.map(({ base, dim, options }) => (
                            <FilterRow key={`${base}-${dim.key}`} label={`${base} · ${dim.label}`}>
                                <button className={`rf-chip${!detailFilters[dim.key] ? ' on' : ''}`} onClick={() => clearDetailFilter(dim.key)}>Todos</button>
                                {options.map(opt => (
                                    <button key={opt} className={`rf-chip${detailFilters[dim.key] === opt ? ' on' : ''}`}
                                        onClick={() => toggleDetailFilter(dim.key, opt)} title={`Mostrar solo: ${base} — ${dim.label} = ${opt}`}>
                                        {opt}
                                    </button>
                                ))}
                            </FilterRow>
                        ))}
                    </section>

                    {/* Acceso rápido a cada jugador del informe */}
                    {reportPlayers.length > 1 && (
                        <nav className="rjump" aria-label="Ir a un jugador">
                            <span>Ir a</span>
                            {reportPlayers.map(id => (
                                <button key={id} className="rf-chip" style={{ '--chip': playerColors[id] }} onClick={() => jumpTo(id)}>
                                    <i className="rf-dot" /> {stats[id].name}
                                    <small>{Object.values(stats[id].skills).reduce((n, sk) => n + sk.total, 0)}</small>
                                </button>
                            ))}
                        </nav>
                    )}

                    <div ref={reportContentRef} className="pdf-container">
                        {/* Header */}
                        <div className="pdf-header">
                            <h1>Informe de Partido</h1>
                            <h2>{`${selectedMatch.ownTeamName} vs ${selectedMatch.opponentTeamName}`}</h2>
                            <p>
                                {`Resultado Final: ${selectedMatch.score.own}–${selectedMatch.score.opponent} sets | Fecha: ${selectedMatch.date}`}
                                {selectedSet !== null && <strong>{` | Mostrando: Set ${selectedSet + 1}`}</strong>}
                            </p>
                        </div>

                        {/* Sets summary table */}
                        <div className="sets-summary">
                            <h4>Resumen por Sets</h4>
                            <table className="compact-table">
                                <thead>
                                    <tr>
                                        <th>Set</th>
                                        <th>{selectedMatch.ownTeamName}</th>
                                        <th>{selectedMatch.opponentTeamName}</th>
                                        <th>Acciones (filtradas)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedMatch.sets.map((set, index) => {
                                        const setActions = (selectedMatch.actions || []).filter(a => a.skill && a.setIndex === index);
                                        const isActive = selectedSet === index;
                                        return (
                                            <tr
                                                key={index}
                                                style={{ cursor: 'pointer', background: isActive ? 'rgba(249,115,22,0.08)' : undefined }}
                                                onClick={() => setSelectedSet(isActive ? null : index)}
                                                title={`Clic para filtrar por Set ${index + 1}`}
                                            >
                                                <td><strong>Set {index + 1}</strong></td>
                                                <td style={{ color: set.own > set.opponent ? '#22c55e' : undefined }}>{set.own}</td>
                                                <td style={{ color: set.opponent > set.own ? '#22c55e' : undefined }}>{set.opponent}</td>
                                                <td style={{ color: '#8a919e' }}>{setActions.length}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Court maps — one per set OR all together */}
                        <div className="court-section">
                            <div className="court-section-header">
                                <h4>
                                    Mapa de Ataques
                                    {selectedSet !== null ? ` — Set ${selectedSet + 1}` : ' — Todos los Sets'}
                                    {complexFilter ? ` · ${complexFilter}` : ''}
                                    {attackFilter ? ` · ${
                                        attackFilter === 'Ataque Contundente' ? '⚡ Contundente' :
                                        attackFilter === 'Ataque Coloque' ? '🎯 Coloque' : '✌️ 2 Toques'
                                    }` : ''}
                                    {playerFilter ? ` · ${playerIdentifiers[playerFilter] || ''} ${allPlayers.find(p => p.id === playerFilter)?.name || ''}` : ''}
                                </h4>
                                {/* Player filter buttons */}
                                <div className="player-court-filter">
                                    <button
                                        className={playerFilter === null ? 'player-court-btn active' : 'player-court-btn'}
                                        onClick={() => setPlayerFilter(null)}
                                    >
                                        Todos
                                    </button>
                                    {allPlayers.map((p, i) => (
                                        <button
                                            key={p.id}
                                            className={playerFilter === p.id ? 'player-court-btn active' : 'player-court-btn'}
                                            onClick={() => setPlayerFilter(playerFilter === p.id ? null : p.id)}
                                            title={`Ver solo ataques de ${p.name}`}
                                            style={{
                                                borderColor: playerFilter === p.id ? PLAYER_COLORS[i % PLAYER_COLORS.length] : undefined,
                                                color: playerFilter === p.id ? PLAYER_COLORS[i % PLAYER_COLORS.length] : undefined,
                                                backgroundColor: playerFilter === p.id
                                                    ? `${PLAYER_COLORS[i % PLAYER_COLORS.length]}18`
                                                    : undefined,
                                            }}
                                        >
                                            <span
                                                className="player-btn-dot"
                                                style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                                            />
                                            {playerIdentifiers[p.id]} {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedSet !== null ? (
                                /* Single court for selected set */
                                <div className="court-container">
                                    <CourtSVG
                                        actions={filteredActions}
                                        playerColors={playerColors}
                                        playerIdentifiers={playerIdentifiers}
                                    />
                                </div>
                            ) : (
                                /* All sets side by side, each respecting player filter */
                                <div className="courts-grid">
                                    {selectedMatch.sets.map((_, i) => {
                                        let setActions = (selectedMatch.actions || []).filter(a => a.skill && a.setIndex === i);
                                        if (complexFilter !== null) setActions = setActions.filter(a => a.complex === complexFilter);
                                        if (playerFilter !== null) setActions = setActions.filter(a => a.playerId === playerFilter);
                                        if (attackFilter !== null) setActions = setActions.filter(a => a.skill === attackFilter);
                                        Object.entries(detailFilters).forEach(([key, value]) => {
                                            setActions = setActions.filter(a => a.detail?.[key] === value);
                                        });
                                        return (
                                            <div key={i} className="court-set-wrap">
                                                <p className="court-set-label">Set {i + 1} · {selectedMatch.sets[i].own}–{selectedMatch.sets[i].opponent}</p>
                                                <div className="court-container">
                                                    <CourtSVG
                                                        actions={setActions}
                                                        playerColors={playerColors}
                                                        playerIdentifiers={playerIdentifiers}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Legend: players + trajectory types */}
                            <div className="court-legend">
                                <h4>Leyenda de Jugadores</h4>
                                <div className="player-legend-list">
                                    {[...(selectedMatch.ownPlayers || []), ...(selectedMatch.opponentPlayers || [])].map((p, i) => (
                                        <span key={p.id} className="player-legend-item">
                                            <span
                                                className="player-legend-dot"
                                                style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                                            />
                                            {playerIdentifiers[p.id]} {p.name}
                                        </span>
                                    ))}
                                </div>
                                <div className="trajectory-legend">
                                    <span className="traj-item">
                                        <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" /></svg>
                                        Contundente
                                    </span>
                                    <span className="traj-item">
                                        <svg width="28" height="14"><path d="M 0 10 Q 14 0 28 10" fill="none" stroke="#9b59b6" strokeWidth="1.8" strokeDasharray="4 3" strokeLinecap="round" /></svg>
                                        Coloque
                                    </span>
                                    <span className="traj-item">
                                        <svg width="28" height="14"><path d="M 0 4 Q 14 14 28 4" fill="none" stroke="#14b8a6" strokeWidth="2" strokeDasharray="6 3" strokeLinecap="round" /></svg>
                                        2 Toques
                                    </span>
                                    <span className="traj-item">
                                        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#16a34a" /></svg>
                                        Fin: Doble Positivo
                                    </span>
                                    <span className="traj-item">
                                        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#ca8a04" /></svg>
                                        Fin: Neutro
                                    </span>
                                    <span className="traj-item">
                                        <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#dc2626" /></svg>
                                        Fin: Doble Negativo
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Player reports */}
                        {Object.keys(stats)
                            .filter(playerId => Object.values(stats[playerId].skills).some(s => s.total > 0))
                            .map(playerId => (
                                <div key={playerId} id={`jugador-${playerId}`} className="player-anchor">
                                <PlayerReport
                                    playerName={stats[playerId].name}
                                    playerStats={stats[playerId]}
                                    playerColor={playerColors[playerId]}
                                    matchType={selectedMatch.matchType}
                                    playerActions={filteredActions.filter(a => a.playerId === playerId)}
                                    allSetActions={filteredActions}
                                    onOpenClips={openClips}
                                />
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportViewer;
