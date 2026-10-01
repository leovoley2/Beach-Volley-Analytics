import React, { useState, useRef, useEffect } from 'react';

// Pizarra táctica: dibujo vectorial sobre una cancha de vóley playa.
// No se guarda en Supabase: vive en el navegador (localStorage por partido) para no
// perder el trabajo al cambiar de pestaña. Se puede exportar como PNG.

const VB_W = 1000, VB_H = 560;
const COURT = { x: 100, y: 80, w: 800, h: 400 }; // 16 x 8 m → 50 px/m
const NET_X = COURT.x + COURT.w / 2;

const OWN_COLOR = '#2563eb';
const OPP_COLOR = '#dc2626';

const COLORS = [
    { v: '#111827', label: 'Negro' },
    { v: '#ffffff', label: 'Blanco' },
    { v: '#dc2626', label: 'Rojo' },
    { v: '#2563eb', label: 'Azul' },
    { v: '#16a34a', label: 'Verde' },
    { v: '#f97316', label: 'Naranja' },
];
const WIDTHS = [
    { v: 3, label: 'Fino', textSize: 20 },
    { v: 6, label: 'Medio', textSize: 28 },
    { v: 10, label: 'Grueso', textSize: 40 },
];
const SHAPE_TOOLS = ['line', 'arrow', 'curve', 'rect', 'ellipse', 'triangle'];
const CURVE_BEND = 0.3; // curvatura inicial: 30 % del largo, hacia un costado

// --- Iconos (trazos de 24x24) ---
const ICONS = {
    move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 7l3 3',
    line: 'M5 19L19 5',
    arrow: 'M5 19L19 5M19 5h-8M19 5v8',
    curve: 'M4 19C6 9 12 5 19 6M19 6l-5-3M19 6l-3 5',
    rect: 'M4 6h16v12H4z',
    ellipse: 'M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0',
    triangle: 'M12 4l9 16H3z',
    text: 'M5 7V5h14v2M12 5v14M9 19h6',
    eraser: 'M15 4l5 5-9 9H7l-3-3L15 4zM9 18h11',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
    expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
};

const TOOLS = [
    { key: 'move', label: 'Mover' },
    { key: 'pen', label: 'Lápiz' },
    { key: 'line', label: 'Línea' },
    { key: 'arrow', label: 'Flecha' },
    { key: 'curve', label: 'Curva (tiro / coloque)' },
    { key: 'rect', label: 'Rectángulo' },
    { key: 'ellipse', label: 'Círculo' },
    { key: 'triangle', label: 'Triángulo' },
    { key: 'text', label: 'Texto' },
    { key: 'eraser', label: 'Borrador' },
];

function Icon({ name }) {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ICONS[name]} />
        </svg>
    );
}

let idSeq = 0;
const newId = () => `${Date.now().toString(36)}${(idSeq++).toString(36)}`;
const r1 = (v) => Math.round(v * 10) / 10;

const emptyBoard = (n) => ({ id: newId(), name: `Situación ${n}`, items: [], notes: '' });
const storageKey = (matchId) => `bva:pizarra:${matchId}`;

function loadBoards(matchId) {
    try {
        const data = JSON.parse(localStorage.getItem(storageKey(matchId)) || 'null');
        if (Array.isArray(data) && data.length > 0) return data;
    } catch { /* sin almacenamiento disponible: se empieza en blanco */ }
    return [emptyBoard(1)];
}

// "Leo" → "Leo", "Carlos Pérez" → "CP"
function shortName(name, fallback) {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return fallback;
    if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0].slice(0, 3);
}

function moveItem(it, dx, dy) {
    if (it.type === 'path') return { ...it, points: it.points.map(([x, y]) => [r1(x + dx), r1(y + dy)]) };
    if (it.type === 'curve') {
        return { ...it, x1: r1(it.x1 + dx), y1: r1(it.y1 + dy), x2: r1(it.x2 + dx), y2: r1(it.y2 + dy), cx: r1(it.cx + dx), cy: r1(it.cy + dy) };
    }
    if ('x1' in it) return { ...it, x1: r1(it.x1 + dx), y1: r1(it.y1 + dy), x2: r1(it.x2 + dx), y2: r1(it.y2 + dy) };
    return { ...it, x: r1(it.x + dx), y: r1(it.y + dy) };
}

// Geometría de cada figura. `hit` = contorno invisible y ancho para poder tocarla con el dedo.
// Punto de control por defecto de una curva: perpendicular al centro del trazo.
function defaultControl(x1, y1, x2, y2) {
    return { cx: r1((x1 + x2) / 2 - (y2 - y1) * CURVE_BEND), cy: r1((y1 + y2) / 2 + (x2 - x1) * CURVE_BEND) };
}

// Punto medio real de la curva (t = 0.5): ahí va el tirador para ajustar la curvatura.
const curveApex = (it) => ({ x: 0.25 * it.x1 + 0.5 * it.cx + 0.25 * it.x2, y: 0.25 * it.y1 + 0.5 * it.cy + 0.25 * it.y2 });
// Inverso: dado dónde se suelta el tirador, el punto de control que hace pasar la curva por ahí.
const controlFromApex = (it, ax, ay) => ({ cx: r1(2 * ax - (it.x1 + it.x2) / 2), cy: r1(2 * ay - (it.y1 + it.y2) / 2) });

function arrowHead(tipX, tipY, ang, width) {
    const len = Math.max(16, width * 3.5);
    const bx = tipX - len * Math.cos(ang), by = tipY - len * Math.sin(ang);
    const sx = len * 0.6 * Math.sin(ang), sy = len * 0.6 * Math.cos(ang);
    return { bx, by, points: `${tipX},${tipY} ${bx + sx},${by - sy} ${bx - sx},${by + sy}` };
}

function renderShape(it, hit = false, vertical = false) {
    const stroke = hit ? 'transparent' : it.color;
    const strokeWidth = hit ? Math.max(24, it.width + 16) : it.width;
    const common = {
        stroke,
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeDasharray: !hit && it.dashed ? `${it.width * 2.5} ${it.width * 2}` : undefined,
        pointerEvents: hit ? 'stroke' : undefined,
    };
    const fillProps = !hit && it.fill ? { fill: it.color, fillOpacity: 0.25 } : { fill: 'none' };

    switch (it.type) {
        case 'path':
            return <polyline points={it.points.map(p => p.join(',')).join(' ')} fill="none" {...common} />;
        case 'line':
            return <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} {...common} />;
        case 'arrow': {
            if (hit) return <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} {...common} />;
            const head = arrowHead(it.x2, it.y2, Math.atan2(it.y2 - it.y1, it.x2 - it.x1), it.width);
            return (
                <>
                    <line x1={it.x1} y1={it.y1} x2={head.bx} y2={head.by} {...common} />
                    <polygon points={head.points} fill={it.color} />
                </>
            );
        }
        case 'curve': {
            if (hit) return <path d={`M${it.x1} ${it.y1} Q${it.cx} ${it.cy} ${it.x2} ${it.y2}`} fill="none" {...common} />;
            // La punta sigue la tangente final de la curva (del control hacia el destino).
            const head = arrowHead(it.x2, it.y2, Math.atan2(it.y2 - it.cy, it.x2 - it.cx), it.width);
            return (
                <>
                    <path d={`M${it.x1} ${it.y1} Q${it.cx} ${it.cy} ${head.bx} ${head.by}`} fill="none" {...common} />
                    <polygon points={head.points} fill={it.color} />
                </>
            );
        }
        case 'rect':
            return <rect x={Math.min(it.x1, it.x2)} y={Math.min(it.y1, it.y2)} width={Math.abs(it.x2 - it.x1)} height={Math.abs(it.y2 - it.y1)} {...fillProps} {...common} />;
        case 'ellipse':
            return <ellipse cx={(it.x1 + it.x2) / 2} cy={(it.y1 + it.y2) / 2} rx={Math.abs(it.x2 - it.x1) / 2} ry={Math.abs(it.y2 - it.y1) / 2} {...fillProps} {...common} />;
        case 'triangle': {
            const minX = Math.min(it.x1, it.x2), maxX = Math.max(it.x1, it.x2);
            const minY = Math.min(it.y1, it.y2), maxY = Math.max(it.y1, it.y2);
            return <polygon points={`${(minX + maxX) / 2},${minY} ${maxX},${maxY} ${minX},${maxY}`} {...fillProps} {...common} />;
        }
        case 'text':
            return (
                <text x={it.x} y={it.y} transform={vertical ? `rotate(-90 ${it.x} ${it.y})` : undefined} fill={it.color} fontSize={it.size} fontWeight="700"
                    fontFamily="Inter, Arial, sans-serif" stroke={it.color === '#ffffff' ? '#111827' : '#ffffff'}
                    strokeWidth="4" paintOrder="stroke" dominantBaseline="middle">
                    {it.text}
                </text>
            );
        case 'token':
            if (it.kind === 'ball') {
                return (
                    <g>
                        <circle cx={it.x} cy={it.y} r="14" fill="#fde047" stroke="#111827" strokeWidth="2.5" />
                        <path d={`M${it.x - 14} ${it.y} Q${it.x} ${it.y - 9} ${it.x + 14} ${it.y} M${it.x} ${it.y - 14} Q${it.x - 7} ${it.y} ${it.x} ${it.y + 14}`}
                            fill="none" stroke="#111827" strokeWidth="1.5" />
                    </g>
                );
            }
            return (
                <g>
                    <circle cx={it.x} cy={it.y} r="24" fill={it.color} stroke="#ffffff" strokeWidth="3" />
                    <text x={it.x} y={it.y} transform={vertical ? `rotate(-90 ${it.x} ${it.y})` : undefined} fill="#ffffff" fontSize="15" fontWeight="800" textAnchor="middle"
                        dominantBaseline="central" fontFamily="Inter, Arial, sans-serif">
                        {it.label}
                    </text>
                </g>
            );
        default:
            return null;
    }
}

function BoardItem({ it, vertical, showHandles }) {
    const hasHit = it.type !== 'text' && it.type !== 'token';
    const apex = it.type === 'curve' && showHandles ? curveApex(it) : null;
    return (
        <g data-id={it.id}>
            {renderShape(it, false, vertical)}
            {hasHit && renderShape(it, true)}
            {/* Tirador para ajustar la curvatura (solo con la herramienta Mover) */}
            {apex && (
                <circle data-handle={it.id} cx={apex.x} cy={apex.y} r="11"
                    fill="#f97316" fillOpacity="0.9" stroke="#ffffff" strokeWidth="3" style={{ cursor: 'move' }} />
            )}
        </g>
    );
}

function Court() {
    return (
        <g pointerEvents="none">
            <rect x="0" y="0" width={VB_W} height={VB_H} fill="#e6c48a" />
            <rect x={COURT.x} y={COURT.y} width={COURT.w} height={COURT.h} fill="#f3dba9" stroke="#ffffff" strokeWidth="6" />
            {/* Red y postes */}
            <line x1={NET_X} y1={COURT.y - 30} x2={NET_X} y2={COURT.y + COURT.h + 30} stroke="#374151" strokeWidth="5" />
            <circle cx={NET_X} cy={COURT.y - 30} r="7" fill="#374151" />
            <circle cx={NET_X} cy={COURT.y + COURT.h + 30} r="7" fill="#374151" />
        </g>
    );
}

export default function TacticalBoard({ matchId, ownTeamName, opponentTeamName, ownPlayers = [], opponentPlayers = [] }) {
    const [boards, setBoards] = useState(() => loadBoards(matchId));
    const [activeId, setActiveId] = useState(() => boards[0].id);
    const [past, setPast] = useState([]);
    const [future, setFuture] = useState([]);

    const [tool, setTool] = useState('pen');
    const [token, setToken] = useState(null); // ficha a colocar (jugador o balón)
    const [color, setColor] = useState('#111827');
    const [width, setWidth] = useState(6);
    const [dashed, setDashed] = useState(false);
    const [fill, setFill] = useState(false);
    const [expanded, setExpanded] = useState(false);
    // En móvil vertical la cancha se dibuja girada para aprovechar la pantalla.
    // Es solo visual: las coordenadas guardadas son siempre las de la cancha horizontal.
    const [vertical, setVertical] = useState(() => {
        try { return window.matchMedia('(max-width: 719px) and (orientation: portrait)').matches; }
        catch { return false; }
    });
    const [draft, setDraft] = useState(null);

    const svgRef = useRef(null);
    const layerRef = useRef(null); // grupo con la posible rotación: base de las coordenadas
    const gesture = useRef(null); // interacción en curso (dibujo, arrastre o borrado)

    const active = boards.find(b => b.id === activeId) || boards[0];
    const items = active.items;

    // Fichas disponibles: jugadores del partido + balón.
    const tokens = [
        ...ownPlayers.slice(0, 2).map((p, i) => ({ key: `own-${i}`, kind: 'own', color: OWN_COLOR, label: shortName(p.name, `A${i + 1}`), name: p.name })),
        ...opponentPlayers.slice(0, 2).map((p, i) => ({ key: `opp-${i}`, kind: 'opp', color: OPP_COLOR, label: shortName(p.name, `B${i + 1}`), name: p.name })),
        { key: 'ball', kind: 'ball', label: '', name: 'Balón' },
    ];
    if (ownPlayers.length === 0) tokens.unshift(
        { key: 'own-0', kind: 'own', color: OWN_COLOR, label: 'A1', name: 'A1' },
        { key: 'own-1', kind: 'own', color: OWN_COLOR, label: 'A2', name: 'A2' },
    );

    // Guardado local (no en la base de datos) para no perder la pizarra al cambiar de pestaña.
    useEffect(() => {
        const t = setTimeout(() => {
            try { localStorage.setItem(storageKey(matchId), JSON.stringify(boards)); }
            catch { /* almacenamiento lleno o bloqueado: la pizarra sigue funcionando en memoria */ }
        }, 400);
        return () => clearTimeout(t);
    }, [boards, matchId]);

    const updateActive = (patch) => {
        setBoards(bs => bs.map(b => (b.id === activeId ? { ...b, ...(typeof patch === 'function' ? patch(b) : patch) } : b)));
    };
    const setItems = (next) => updateActive(b => ({ items: typeof next === 'function' ? next(b.items) : next }));

    // Cambio con historial (deshacer/rehacer).
    const commit = (next, prev = items) => {
        setPast(p => [...p.slice(-99), prev]);
        setFuture([]);
        setItems(next);
    };

    const undo = () => {
        if (past.length === 0) return;
        setFuture(f => [items, ...f]);
        setItems(past[past.length - 1]);
        setPast(p => p.slice(0, -1));
    };
    const redo = () => {
        if (future.length === 0) return;
        setPast(p => [...p, items]);
        setItems(future[0]);
        setFuture(f => f.slice(1));
    };

    // Atajos: Ctrl/Cmd+Z deshacer, Ctrl/Cmd+Shift+Z rehacer, Esc sale de pantalla completa.
    const undoRef = useRef(undo);
    const redoRef = useRef(redo);
    undoRef.current = undo;
    redoRef.current = redo;
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') { setExpanded(false); return; }
            const tag = e.target?.tagName;
            if (tag === 'TEXTAREA' || tag === 'INPUT') return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) redoRef.current(); else undoRef.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const switchBoard = (id) => {
        setActiveId(id);
        setPast([]);
        setFuture([]);
    };

    const addBoard = () => {
        const b = emptyBoard(boards.length + 1);
        setBoards(bs => [...bs, b]);
        switchBoard(b.id);
    };

    const renameBoard = () => {
        const name = window.prompt('Nombre de la situación', active.name);
        if (name && name.trim()) updateActive({ name: name.trim().slice(0, 40) });
    };

    const deleteBoard = () => {
        if (boards.length <= 1) return;
        if (!window.confirm(`¿Eliminar "${active.name}"?`)) return;
        const rest = boards.filter(b => b.id !== active.id);
        setBoards(rest);
        switchBoard(rest[0].id);
    };

    // --- Interacción con la cancha (ratón, dedo o lápiz) ---
    const toBoard = (e) => {
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const p = pt.matrixTransform(layerRef.current.getScreenCTM().inverse());
        return { x: r1(p.x), y: r1(p.y) };
    };

    const itemIdAt = (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const g = el?.closest?.('[data-id]');
        return g && svgRef.current.contains(g) ? g.getAttribute('data-id') : null;
    };

    const placeToken = (pos) => {
        const tokenId = `token-${token.key}`;
        const exists = items.some(it => it.id === tokenId);
        const tok = { id: tokenId, type: 'token', kind: token.kind, color: token.color, label: token.label, x: pos.x, y: pos.y };
        // Cada jugador/balón es único: volver a colocarlo lo mueve.
        commit(exists ? items.map(it => (it.id === tokenId ? tok : it)) : [...items, tok]);
    };

    const eraseAt = (e) => {
        const id = itemIdAt(e);
        if (!id) return;
        setItems(its => its.filter(it => it.id !== id));
        gesture.current.changed = true;
    };

    const handlePointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const pos = toBoard(e);

        if (tool === 'text') {
            const text = window.prompt('Texto');
            if (text && text.trim()) {
                const size = WIDTHS.find(w => w.v === width)?.textSize || 28;
                commit([...items, { id: newId(), type: 'text', x: pos.x, y: pos.y, text: text.trim().slice(0, 120), color, size }]);
            }
            return;
        }
        if (tool === 'token') {
            if (token) placeToken(pos);
            return;
        }

        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
        const style = { color, width, dashed };

        if (tool === 'pen') {
            setDraft({ id: newId(), type: 'path', points: [[pos.x, pos.y]], ...style });
            gesture.current = { kind: 'draw' };
        } else if (SHAPE_TOOLS.includes(tool)) {
            const isStroke = tool === 'line' || tool === 'arrow' || tool === 'curve';
            setDraft({
                id: newId(), type: tool, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, ...style,
                ...(tool === 'curve' && { cx: pos.x, cy: pos.y }),
                fill: fill && !isStroke,
            });
            gesture.current = { kind: 'draw' };
        } else if (tool === 'eraser') {
            gesture.current = { kind: 'erase', before: items, changed: false };
            eraseAt(e);
        } else if (tool === 'move') {
            const handle = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-handle]');
            if (handle) {
                gesture.current = { kind: 'bend', id: handle.getAttribute('data-handle'), before: items, changed: false };
                return;
            }
            const id = itemIdAt(e);
            if (id) gesture.current = { kind: 'drag', id, last: pos, before: items, changed: false };
        }
    };

    const handlePointerMove = (e) => {
        const g = gesture.current;
        if (!g) return;
        const pos = toBoard(e);

        if (g.kind === 'draw') {
            setDraft(d => {
                if (!d) return d;
                if (d.type === 'path') {
                    const [lx, ly] = d.points[d.points.length - 1];
                    if (Math.hypot(pos.x - lx, pos.y - ly) < 2) return d; // descarta puntos casi iguales
                    return { ...d, points: [...d.points, [pos.x, pos.y]] };
                }
                if (d.type === 'curve') return { ...d, x2: pos.x, y2: pos.y, ...defaultControl(d.x1, d.y1, pos.x, pos.y) };
                return { ...d, x2: pos.x, y2: pos.y };
            });
        } else if (g.kind === 'erase') {
            eraseAt(e);
        } else if (g.kind === 'bend') {
            g.changed = true;
            setItems(its => its.map(it => (it.id === g.id ? { ...it, ...controlFromApex(it, pos.x, pos.y) } : it)));
        } else if (g.kind === 'drag') {
            const dx = pos.x - g.last.x, dy = pos.y - g.last.y;
            if (dx === 0 && dy === 0) return;
            g.last = pos;
            g.changed = true;
            setItems(its => its.map(it => (it.id === g.id ? moveItem(it, dx, dy) : it)));
        }
    };

    const handlePointerUp = () => {
        const g = gesture.current;
        gesture.current = null;
        if (!g) return;

        if (g.kind === 'draw' && draft) {
            const tooSmall = draft.type === 'path'
                ? draft.points.length < 2
                : Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 6;
            if (!tooSmall) commit([...items, draft]);
            setDraft(null);
        } else if ((g.kind === 'erase' || g.kind === 'drag' || g.kind === 'bend') && g.changed) {
            // Los cambios ya se aplicaron en vivo; solo se registra el estado previo en el historial.
            setPast(p => [...p.slice(-99), g.before]);
            setFuture([]);
        }
    };

    const clearBoard = () => {
        if (items.length === 0) return;
        if (window.confirm('¿Borrar todo el dibujo de esta situación?')) commit([]);
    };

    // Coloca a los 4 jugadores y el balón en una posición inicial de recepción.
    const placeFormation = () => {
        const spots = {
            'own-0': [300, 190], 'own-1': [300, 370],
            'opp-0': [700, 190], 'opp-1': [700, 370],
            ball: [945, 280],
        };
        const placed = tokens.filter(t => spots[t.key]).map(t => ({
            id: `token-${t.key}`, type: 'token', kind: t.kind, color: t.color, label: t.label,
            x: spots[t.key][0], y: spots[t.key][1],
        }));
        commit([...items.filter(it => it.type !== 'token'), ...placed]);
        setTool('move');
    };

    const downloadPng = () => {
        const clone = svgRef.current.cloneNode(true);
        clone.querySelectorAll('[data-handle]').forEach(n => n.remove()); // tiradores de edición fuera de la imagen
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const [w, h] = vertical ? [VB_H, VB_W] : [VB_W, VB_H];
        clone.setAttribute('width', w * 2);
        clone.setAttribute('height', h * 2);
        clone.removeAttribute('class');
        clone.removeAttribute('style');
        const xml = new XMLSerializer().serializeToString(clone);
        const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w * 2;
            canvas.height = h * 2;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                const slug = `${ownTeamName || 'equipo'}-vs-${opponentTeamName || 'rival'}-${active.name}`
                    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
                a.download = `pizarra-${slug}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }, 'image/png');
        };
        img.src = url;
    };

    const selectTool = (key) => { setTool(key); setToken(null); };
    const selectToken = (t) => { setTool('token'); setToken(t); };

    const usesStyle = tool !== 'move' && tool !== 'eraser' && tool !== 'token';
    const cursor = tool === 'move' ? 'grab' : tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';

    let hint = null;
    if (tool === 'token') hint = token ? `Toca la cancha para colocar: ${token.name}` : 'Elige una ficha';
    else if (tool === 'move') hint = items.some(it => it.type === 'curve')
        ? 'Arrastra para mover · el punto naranja ajusta la curva'
        : 'Arrastra cualquier ficha o dibujo para moverlo';
    else if (tool === 'curve') hint = 'Arrastra del inicio al destino · ajusta la curva con Mover';
    else if (tool === 'eraser') hint = 'Toca o arrastra sobre un dibujo para borrarlo';
    else if (tool === 'text') hint = 'Toca la cancha donde quieras escribir';

    return (
        <div className={`wb ${expanded ? 'wb--expanded' : ''}`}>
            {/* Situaciones (varias pizarras por partido) */}
            <div className="wb-tabs">
                {boards.map(b => (
                    <button key={b.id} className={`wb-tab ${b.id === active.id ? 'active' : ''}`}
                        onClick={() => switchBoard(b.id)} onDoubleClick={renameBoard}>
                        {b.name}
                    </button>
                ))}
                <button className="wb-tab wb-tab-add" onClick={addBoard} title="Nueva situación">+ Nueva</button>
                <span className="wb-tabs-spacer" />
                <button className="wb-tab-action" onClick={renameBoard} title="Renombrar situación">✎</button>
                {boards.length > 1 && (
                    <button className="wb-tab-action" onClick={deleteBoard} title="Eliminar situación">✕</button>
                )}
            </div>

            {/* Herramientas */}
            <div className="wb-toolbar">
                <div className="wb-group">
                    {TOOLS.map(t => (
                        <button key={t.key} className={`wb-btn ${tool === t.key ? 'active' : ''}`}
                            onClick={() => selectTool(t.key)} title={t.label} aria-label={t.label}>
                            <Icon name={t.key} />
                        </button>
                    ))}
                </div>
                <div className="wb-group">
                    <button className="wb-btn" onClick={undo} disabled={past.length === 0} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><Icon name="undo" /></button>
                    <button className="wb-btn" onClick={redo} disabled={future.length === 0} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer"><Icon name="redo" /></button>
                    <button className="wb-btn" onClick={clearBoard} disabled={items.length === 0} title="Borrar todo" aria-label="Borrar todo"><Icon name="trash" /></button>
                    <button className={`wb-btn ${vertical ? 'active' : ''}`} onClick={() => setVertical(v => !v)} title="Girar cancha" aria-label="Girar cancha"><Icon name="rotate" /></button>
                    <button className="wb-btn" onClick={downloadPng} title="Descargar imagen (PNG)" aria-label="Descargar imagen"><Icon name="download" /></button>
                    <button className="wb-btn" onClick={() => setExpanded(x => !x)} title={expanded ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'} aria-label="Pantalla completa">
                        <Icon name={expanded ? 'collapse' : 'expand'} />
                    </button>
                </div>
            </div>

            {/* Estilo + fichas */}
            <div className="wb-toolbar wb-toolbar--secondary">
                <div className={`wb-group ${usesStyle ? '' : 'wb-group--muted'}`}>
                    {COLORS.map(c => (
                        <button key={c.v} className={`wb-swatch ${color === c.v ? 'active' : ''}`}
                            style={{ background: c.v }} onClick={() => setColor(c.v)} title={c.label} aria-label={`Color ${c.label}`} />
                    ))}
                    <span className="wb-sep" />
                    {WIDTHS.map(w => (
                        <button key={w.v} className={`wb-btn wb-width ${width === w.v ? 'active' : ''}`}
                            onClick={() => setWidth(w.v)} title={w.label} aria-label={`Grosor ${w.label}`}>
                            <span style={{ height: Math.max(2, w.v / 1.5) }} />
                        </button>
                    ))}
                    <button className={`wb-btn wb-toggle ${dashed ? 'active' : ''}`} onClick={() => setDashed(x => !x)} title="Línea discontinua (desplazamiento)">- -</button>
                    <button className={`wb-btn wb-toggle ${fill ? 'active' : ''}`} onClick={() => setFill(x => !x)} title="Rellenar figuras (zonas)">▨</button>
                </div>
                <div className="wb-group">
                    {tokens.map(t => (
                        <button key={t.key}
                            className={`wb-token ${t.kind === 'ball' ? 'wb-token--ball' : ''} ${tool === 'token' && token?.key === t.key ? 'active' : ''}`}
                            style={t.kind === 'ball' ? undefined : { background: t.color }}
                            onClick={() => selectToken(t)} title={`Colocar ${t.name}`}>
                            {t.label}
                        </button>
                    ))}
                    <button className="wb-btn wb-formation" onClick={placeFormation} title="Colocar los 4 jugadores y el balón">Formación</button>
                </div>
            </div>

            <div className="wb-board">
                <svg
                    ref={svgRef}
                    viewBox={vertical ? `0 0 ${VB_H} ${VB_W}` : `0 0 ${VB_W} ${VB_H}`}
                    className="wb-svg"
                    style={{ cursor }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <g ref={layerRef} transform={vertical ? `translate(${VB_H} 0) rotate(90)` : undefined}>
                        <Court />
                        {items.map(it => <BoardItem key={it.id} it={it} vertical={vertical} showHandles={tool === 'move'} />)}
                        {draft && <g pointerEvents="none">{renderShape(draft, false, vertical)}</g>}
                    </g>
                </svg>
                {hint && <div className="wb-hint">{hint}</div>}
            </div>

            {!expanded && (
                <div className="wb-notes">
                    <label htmlFor="wb-notes-text">Notas de la situación</label>
                    <textarea
                        id="wb-notes-text"
                        value={active.notes}
                        onChange={e => updateActive({ notes: e.target.value })}
                        placeholder="Explica la situación de juego: qué pasó, qué corregir, qué repetir…"
                        rows={4}
                    />
                    <p className="wb-footnote">La pizarra y las notas se guardan solo en este dispositivo.</p>
                </div>
            )}
        </div>
    );
}
