import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMatches } from '../context/MatchContext';
import { SKILLS, OUTCOMES, ATTACK_TYPES, buildMatchState, computeSetScores, complexFor } from '../lib/scoutingModel';
import { baseSkillOf } from '../lib/scoutingDetails';
import ClipExportDialog from './ClipExportDialog';
import { clipBounds, filterClips, matchesFilters, hasVideoTime, totalDuration, fmtTime } from '../lib/videoClips';

// Scouting en video (PRO): el entrenador abre el video del partido desde su computadora,
// registra las acciones mientras lo mira y después filtra por atleta / fundamento / resultado
// para ver solo esos clips. El video NO se sube: se reproduce localmente y solo se guardan las
// acciones (con su `videoTime`) dentro del partido, igual que las del tracker en vivo.

const SKILL_KEYS = { s: 'Saque', r: 'Recepción', e: 'Armado', a: 'Ataque', b: 'Bloqueo', d: 'Defensa' };
const SKILL_KEY_OF = Object.fromEntries(Object.entries(SKILL_KEYS).map(([k, v]) => [v, k.toUpperCase()]));
const OUTCOME_CLASS = {
    'Doble Positivo': 'dp', 'Positivo': 'p', 'Overpass': 'ovp', 'Negativo': 'n', 'Doble Negativo': 'dn',
};
const SYMBOL_TO_OUTCOME = Object.fromEntries(OUTCOMES.map(o => [o.symbol, o.key]));
const outcomeInfo = (key) => OUTCOMES.find(o => o.key === key);
const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
const FRAME = 1 / 30;
const EMPTY_SEL = { playerId: null, skill: null, attackType: null, time: null, outcome: null, start: null, resumeAfter: false };
// Mini cancha para la trayectoria del ataque: mismas medidas y coordenadas normalizadas (0–1)
// que el tracker en vivo, así el "Mapa de ataques" de Tendencias la dibuja igual.
const SVG_W = 500, SVG_H = 300, PAD_X = 50, PAD_Y = 50;
const PAUSE_KEY = 'bva:video:pausarCancha';
const readPausePref = () => { try { return localStorage.getItem(PAUSE_KEY) !== '0'; } catch { return true; } };
const videoNameKey = (matchId) => `bva:video:${matchId}`;

// Video abierto por partido durante la sesión: así se puede ir a Tendencias y volver (o abrir
// clips desde ahí) sin elegir el archivo otra vez. El blob apunta al archivo local, no lo copia.
const videoCache = new Map(); // matchId → { url, name }

// play() devuelve una promesa que se rechaza si el navegador bloquea la reproducción.
const safePlay = (el) => { el?.play()?.catch(() => {}); };

// MediaError.code → explicación para el entrenador.
const VIDEO_ERROR_TEXT = {
    0: 'El navegador no pudo seguir reproduciendo el archivo.',
    1: 'La reproducción se interrumpió.',
    2: 'El navegador dejó de poder leer el archivo. Suele pasar si el video está en iCloud / Google Drive sin descargar, en un disco externo que se desconectó, o si se movió o modificó mientras estaba abierto.',
    3: 'El navegador no pudo decodificar una parte del video. Es común con videos HEVC/H.265, 4K o HDR grabados con celular, o con archivos dañados.',
    4: 'Este navegador no puede reproducir este formato de video (por ejemplo HEVC/H.265 o MKV).',
};

function uid() {
    return (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
}

function readSavedName(matchId) {
    try { return localStorage.getItem(videoNameKey(matchId)) || ''; } catch { return ''; }
}

// Invitación a PRO para quien abre el video con plan Free.
function VideoProGate() {
    const navigate = useNavigate();
    return (
        <div className="pro-gate">
            <h3>Scouting en video <span className="pro-badge">PRO</span></h3>
            <p>Abre el video del partido, registra cada acción mientras lo miras y revisa en segundos todo lo que hizo cada atleta.</p>
            <ul>
                <li>Registro rápido con teclado: jugador → fundamento → resultado</li>
                <li>Filtra por atleta, fundamento, resultado y set</li>
                <li>Reproduce solo esos clips, uno tras otro</li>
                <li>Las acciones alimentan las Tendencias y el PDF del partido</li>
            </ul>
            <button className="btn-primary" onClick={() => navigate('/pricing')}>Pasar a PRO</button>
            <p className="wb-footnote">El video no se sube: se reproduce desde tu computadora.</p>
        </div>
    );
}

export default function VideoScout({ matchId }) {
    const { isPaid, subscription } = useAuth();
    if (!subscription) return <div className="board-ws-loading">Cargando…</div>;
    if (!isPaid) return <VideoProGate />;
    return <VideoScoutWorkspace matchId={matchId} />;
}

function VideoScoutWorkspace({ matchId }) {
    const { currentMatch, updateMatch } = useMatches();
    const location = useLocation();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const fileInputRef = useRef(null);
    const courtRef = useRef(null);

    const [videoUrl, setVideoUrl] = useState(() => videoCache.get(matchId)?.url || null);
    const [videoName, setVideoName] = useState(() => videoCache.get(matchId)?.name || '');
    const [savedName, setSavedName] = useState(() => readSavedName(matchId));
    const [dragOver, setDragOver] = useState(false);
    const [speed, setSpeed] = useState(1);
    // Error del reproductor (archivo ilegible o códec que el navegador no decodifica): { code, at }.
    const [videoError, setVideoError] = useState(null);
    const [buffering, setBuffering] = useState(false);

    // Clips elegidos desde Tendencias (clic en un número): { ids: Set, label }.
    const [preset, setPreset] = useState(() => {
        const st = location.state;
        return st?.clipIds?.length ? { ids: new Set(st.clipIds), label: st.label || '' } : null;
    });
    const autoplayRef = useRef(!!preset);
    const [tab, setTab] = useState(preset ? 'clips' : 'registrar');
    const [sel, setSel] = useState(EMPTY_SEL);
    const [setIdx, setSetIdx] = useState(() => Math.max(0, (currentMatch?.sets?.length || 1) - 1));
    const [filters, setFilters] = useState({ players: new Set(), skills: new Set(), outcomes: new Set(), sets: new Set() });
    const [nowPlaying, setNowPlaying] = useState(null); // { items, idx }
    const [flash, setFlash] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [pauseOnCourt, setPauseOnCourt] = useState(readPausePref);
    const togglePauseOnCourt = (on) => {
        setPauseOnCourt(on);
        try { localStorage.setItem(PAUSE_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ }
    };

    // Al cargar el partido, registrar por defecto en su último set.
    const loadedId = currentMatch?.id;
    useEffect(() => {
        if (loadedId) setSetIdx(Math.max(0, (currentMatch.sets?.length || 1) - 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadedId]);


    const allPlayers = useMemo(() => currentMatch ? [
        ...currentMatch.ownPlayers.map(p => ({ ...p, side: 'own' })),
        ...(currentMatch.opponentPlayers || []).map(p => ({ ...p, side: 'opp' })),
    ] : [], [currentMatch]);
    const playerById = useMemo(() => Object.fromEntries(allPlayers.map(p => [p.id, p])), [allPlayers]);
    const actions = useMemo(() => currentMatch?.actions || [], [currentMatch]);
    const videoActions = useMemo(
        () => actions.filter(hasVideoTime).sort((a, b) => b.videoTime - a.videoTime),
        [actions]
    );
    const liveOnlyCount = actions.filter(a => a.skill && !hasVideoTime(a)).length;
    const clips = useMemo(() => (preset
        ? actions.filter(a => hasVideoTime(a) && preset.ids.has(a.id)).sort((a, b) => a.videoTime - b.videoTime)
        : filterClips(actions, filters)
    ), [actions, filters, preset]);

    const maxSets = (currentMatch?.setsToWin || 2) * 2 - 1;
    const numSetsFor = (idx) => Math.max(currentMatch.sets.length, idx + 1);
    const derivedSets = currentMatch
        ? computeSetScores(actions, numSetsFor(setIdx), currentMatch.ownPlayers.map(p => p.id))
        : [];
    const setScore = derivedSets[setIdx] || { own: 0, opponent: 0 };

    // ---------------------------------------------------------------- video
    const loadFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
            showFlash('Ese archivo no parece un video (MP4, MOV o WebM).');
            return;
        }
        const prev = videoCache.get(matchId);
        if (prev) URL.revokeObjectURL(prev.url);
        const url = URL.createObjectURL(file);
        videoCache.set(matchId, { url, name: file.name });
        setVideoUrl(url);
        setVideoError(null);
        setVideoName(file.name);
        setSavedName(file.name);
        try { localStorage.setItem(videoNameKey(matchId), file.name); } catch { /* sin almacenamiento */ }
        setNowPlaying(null);
    };

    const flashTimer = useRef(null);
    const showFlash = (msg) => {
        setFlash(msg);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 1800);
    };
    useEffect(() => () => clearTimeout(flashTimer.current), []);

    const v = () => videoRef.current;
    const seek = (t) => { const el = v(); if (el) el.currentTime = Math.max(0, Math.min(t, el.duration || t)); };
    const nudge = (dt) => { const el = v(); if (el) seek(el.currentTime + dt); };
    const togglePlay = () => { const el = v(); if (!el) return; if (el.paused) safePlay(el); else el.pause(); };
    const changeSpeed = (s) => { setSpeed(s); if (v()) v().playbackRate = s; };
    const stepSpeed = (dir) => {
        const i = SPEEDS.indexOf(speed);
        changeSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 2 : i) + dir))]);
    };

    // Cuando el navegador falla al decodificar o leer el archivo, el <video> queda detenido y ya
    // no responde (ni volviendo al inicio). Recargarlo y seguir un poco más adelante suele
    // saltar el fragmento dañado.
    const onVideoError = (e) => {
        const el = e.currentTarget;
        setBuffering(false);
        setVideoError({ code: el.error?.code || 0, at: el.currentTime || 0 });
    };
    const recoverVideo = (skip = 0.5) => {
        const el = v();
        if (!el || !videoError) return;
        const at = videoError.at + skip;
        setVideoError(null);
        el.addEventListener('loadedmetadata', () => {
            el.playbackRate = speed;
            el.currentTime = Math.min(at, el.duration || at);
            safePlay(el);
        }, { once: true });
        el.load();
    };

    // -------------------------------------------------------------- clips
    const playClip = (items, idx) => {
        const el = v();
        if (!el || !items[idx]) return;
        el.currentTime = clipBounds(items[idx]).start;
        safePlay(el);
        setNowPlaying({ items, idx });
    };

    // Al llegar desde Tendencias con el video ya abierto, reproducir esos clips de inmediato.
    useEffect(() => {
        const el = videoRef.current;
        if (!autoplayRef.current || !el || !clips.length) return;
        autoplayRef.current = false;
        const start = () => playClip(clips, 0);
        if (el.readyState >= 1) start();
        else el.addEventListener('loadedmetadata', start, { once: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoUrl, clips]);

    // Volver a los filtros normales (y limpiar el estado de navegación para que no reaparezca).
    const clearPreset = () => {
        setPreset(null);
        setNowPlaying(null);
        navigate(location.pathname, { replace: true, state: null });
    };
    const stopClips = () => { setNowPlaying(null); v()?.pause(); };

    // Mientras hay una lista de clips en curso, al llegar al final de uno salta al siguiente.
    useEffect(() => {
        if (!nowPlaying) return;
        const { items, idx } = nowPlaying;
        const { end } = clipBounds(items[idx]);
        let raf;
        const tick = () => {
            const el = videoRef.current;
            if (el && (el.currentTime >= end || el.ended)) {
                if (idx + 1 < items.length) {
                    el.currentTime = clipBounds(items[idx + 1]).start;
                    setNowPlaying({ items, idx: idx + 1 });
                } else { el.pause(); setNowPlaying(null); }
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [nowPlaying]);

    const toggleFilter = (key, value) => {
        if (preset) clearPreset();
        setFilters(prev => {
            const next = new Set(prev[key]);
            if (next.has(value)) next.delete(value); else next.add(value);
            return { ...prev, [key]: next };
        });
        setNowPlaying(null);
    };
    const clearFilter = (key) => { setFilters(prev => ({ ...prev, [key]: new Set() })); setNowPlaying(null); };

    // Cuántos clips habría con cada opción, respetando los demás filtros.
    const countWith = (key, value) => actions.filter(a =>
        hasVideoTime(a) && matchesFilters(a, filters, key) && (
            key === 'players' ? a.playerId === value
                : key === 'skills' ? baseSkillOf(a.skill) === value
                    : key === 'outcomes' ? a.outcome === value
                        : (a.setIndex ?? 0) === value
        )).length;

    // ----------------------------------------------------------- registro
    const stage = !sel.playerId ? 'player' : !sel.skill ? 'skill'
        : sel.skill === 'Ataque' && !sel.attackType ? 'attackType'
            : !sel.outcome ? 'outcome' : 'court';

    const selectPlayer = (playerId) => {
        // El momento de la acción se toma al elegir al jugador (el video puede seguir corriendo).
        const time = sel.playerId && sel.time != null ? sel.time : (v()?.currentTime ?? 0);
        setSel({ ...EMPTY_SEL, playerId, time });
        setTab('registrar');
    };
    const selectSkill = (skill) => setSel(s => ({ ...s, skill, attackType: null }));
    const selectAttackType = (attackType) => setSel(s => ({ ...s, attackType }));
    const resumeIfPaused = () => { if (sel.resumeAfter) safePlay(v()); };
    const cancelEntry = () => { resumeIfPaused(); setSel(EMPTY_SEL); };
    const stepBack = () => {
        if (sel.start) setSel(s => ({ ...s, start: null }));
        else if (sel.outcome) { resumeIfPaused(); setSel(s => ({ ...s, outcome: null, resumeAfter: false })); }
        else if (sel.attackType) setSel(s => ({ ...s, attackType: null }));
        else if (sel.skill) setSel(s => ({ ...s, skill: null }));
        else setSel(EMPTY_SEL);
    };

    // Resultado elegido. En un ataque se pasa a la cancha (inicio → final, u Omitir);
    // en el resto de fundamentos se guarda directamente.
    const chooseOutcome = (outcome) => {
        if (stage !== 'outcome') return;
        if (sel.skill !== 'Ataque') { saveAction(outcome); return; }
        const el = v();
        const wasPlaying = !!el && !el.paused;
        if (pauseOnCourt && wasPlaying) el.pause();
        setSel(s => ({ ...s, outcome, start: null, resumeAfter: pauseOnCourt && wasPlaying }));
    };

    const handleCourtClick = (e) => {
        if (stage !== 'court') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pt = {
            x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
        };
        if (!sel.start) setSel(s => ({ ...s, start: pt }));
        else saveAction(sel.outcome, sel.start, pt);
    };

    const saveAction = (outcome, start = null, end = null) => {
        if (!sel.playerId || !sel.skill || (sel.skill === 'Ataque' && !sel.attackType)) return;
        const finalSkill = sel.skill === 'Ataque' ? `Ataque ${sel.attackType}` : sel.skill;
        const videoTime = Math.round((sel.time ?? 0) * 100) / 100;
        // Armado y ataque heredan el complejo de la acción anterior de la misma jugada (≤ 8 s antes).
        const prev = actions
            .filter(a => hasVideoTime(a) && (a.setIndex ?? 0) === setIdx && a.videoTime <= videoTime && videoTime - a.videoTime <= 8)
            .sort((a, b) => b.videoTime - a.videoTime)[0];
        const action = {
            id: uid(),
            playerId: sel.playerId,
            skill: finalSkill,
            outcome,
            setIndex: setIdx,
            complex: complexFor(sel.skill, prev?.complex ?? null),
            timestamp: new Date().toISOString(),
            videoTime,
            source: 'video',
            ...(start && end && { startX: start.x, startY: start.y, x: end.x, y: end.y }),
        };
        updateMatch(buildMatchState(currentMatch, [...actions, action], numSetsFor(setIdx)));
        const p = playerById[sel.playerId];
        showFlash(`✓ ${p?.name || ''} · ${finalSkill} ${outcomeInfo(outcome)?.symbol || ''}${end ? ' · con trayectoria' : ''}`);
        resumeIfPaused();
        setSel(EMPTY_SEL);
    };

    const deleteAction = (target) => {
        updateMatch(buildMatchState(currentMatch, actions.filter(a => a !== target), currentMatch.sets.length));
    };

    const jumpTo = (a) => { setNowPlaying(null); seek(clipBounds(a).start); safePlay(v()); };

    // ------------------------------------------------------------ teclado
    // El manejador se reasigna en cada render (lee el estado actual); el listener es uno solo.
    const keyHandler = useRef(null);
    keyHandler.current = (e) => {
        if (exporting) return; // el diálogo de descarga tiene el foco
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key;
        const lk = k.toLowerCase();
        let handled = true;

        if (k === ' ') togglePlay();
        else if (k === 'ArrowLeft') nudge(e.shiftKey ? -5 : -2);
        else if (k === 'ArrowRight') nudge(e.shiftKey ? 5 : 2);
        else if (k === ',') { v()?.pause(); nudge(-FRAME); }
        else if (k === '.') { v()?.pause(); nudge(FRAME); }
        else if (k === '[') stepSpeed(-1);
        else if (k === ']') stepSpeed(1);
        else if (k === 'Escape') { if (nowPlaying) stopClips(); else cancelEntry(); }
        else if (k === 'Backspace') stepBack();
        else if (stage === 'player' && /^[1-4]$/.test(k) && allPlayers[Number(k) - 1]) selectPlayer(allPlayers[Number(k) - 1].id);
        else if (stage === 'skill' && SKILL_KEYS[lk]) selectSkill(SKILL_KEYS[lk]);
        else if (stage === 'attackType' && /^[1-3]$/.test(k)) selectAttackType(ATTACK_TYPES[Number(k) - 1].key);
        else if (stage === 'outcome' && /^[1-5]$/.test(k)) chooseOutcome(OUTCOMES[Number(k) - 1].key);
        else if (stage === 'outcome' && SYMBOL_TO_OUTCOME[k]) chooseOutcome(SYMBOL_TO_OUTCOME[k]);
        else if (stage === 'court' && k === 'Enter') saveAction(sel.outcome);
        else handled = false;

        if (handled) { e.preventDefault(); e.stopPropagation(); }
    };
    useEffect(() => {
        const onKey = (e) => keyHandler.current?.(e);
        // Fase de captura: así el reproductor nativo no procesa también Espacio / flechas.
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    if (!currentMatch) return null;

    const selPlayer = playerById[sel.playerId];
    const playingAction = nowPlaying ? nowPlaying.items[nowPlaying.idx] : null;
    const playingPlayer = playingAction ? playerById[playingAction.playerId] : null;

    const stageHint = {
        player: 'Elige al jugador (1–4) — el tiempo se toma en ese momento',
        skill: 'Fundamento (S R E A B D)',
        attackType: 'Tipo de ataque (1–3)',
        outcome: 'Resultado (1–5 o # + / - =)',
        court: sel.start ? 'Marca el FINAL del ataque' : 'Marca el INICIO del ataque — o Enter para omitir',
    }[stage];

    // Título por defecto del video descargado: lo que se está filtrando.
    const exportTitle = () => {
        if (preset) return preset.label || 'Clips del partido';
        const join = (arr) => arr.join(' y ');
        const parts = [
            join([...filters.players].map(id => playerById[id]?.name).filter(Boolean)),
            join([...filters.skills]),
            join([...filters.outcomes]),
            join([...filters.sets].sort().map(i => `Set ${i + 1}`)),
        ].filter(Boolean);
        return parts.join(' · ') || 'Clips del partido';
    };
    const exportSubtitle = [
        `${currentMatch.ownTeamName} vs ${currentMatch.opponentTeamName}`,
        currentMatch.date,
        currentMatch.tournament,
    ].filter(Boolean).join(' · ');
    const exportLabel = (a) => {
        const p = playerById[a.playerId];
        const info = outcomeInfo(a.outcome);
        return {
            main: `${p?.name || ''} · ${a.skill} · ${info?.symbol || ''} ${a.outcome}`,
            color: p?.side === 'opp' ? '#3b82f6' : '#f97316',
        };
    };
    const openExport = () => { stopClips(); setExporting(true); };

    // ----------------------------------------------------------- render
    return (
        <div className="vs">
            <div className="vs-main">
                {/* Reproductor */}
                <div
                    className={`vs-stage ${videoUrl ? 'has-video' : ''} ${dragOver ? 'is-drag' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files?.[0]); }}
                >
                    {videoUrl ? (
                        <>
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                controls
                                playsInline
                                onLoadedMetadata={e => { e.currentTarget.playbackRate = speed; }}
                                onError={onVideoError}
                                onWaiting={() => setBuffering(true)}
                                onPlaying={() => setBuffering(false)}
                                onSeeked={() => setBuffering(false)}
                            />
                            {buffering && !videoError && <div className="vs-buffering">Cargando…</div>}
                            {stage === 'court' && sel.resumeAfter && !videoError && (
                                // En pantallas angostas (iPad) la cancha queda abajo: sin este aviso
                                // parece que el video se trabó.
                                <div className="vs-court-banner" role="status">
                                    <span>⏸ Ataque en pausa: marca {sel.start ? 'el final' : 'el inicio'} en la cancha</span>
                                    <button className="vs-link" onClick={() => courtRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Ir a la cancha</button>
                                    <button className="btn-primary" onClick={() => saveAction(sel.outcome)}>Omitir y seguir</button>
                                </div>
                            )}
                            {videoError && (
                                <div className="vs-error" role="alert">
                                    <strong>El video se detuvo en {fmtTime(videoError.at, false)}</strong>
                                    <p className="vs-error-tip">{videoName}{videoError.code ? ` · error ${videoError.code}` : ''}</p>
                                    <p>{VIDEO_ERROR_TEXT[videoError.code] || VIDEO_ERROR_TEXT[0]}</p>
                                    <div className="vs-error-actions">
                                        <button className="btn-primary" onClick={() => recoverVideo(0.5)}>Reintentar desde aquí</button>
                                        <button className="btn-cancel" onClick={() => recoverVideo(5)}>Saltar 5 s</button>
                                        <button className="btn-cancel" onClick={() => fileInputRef.current?.click()}>Elegir otro archivo</button>
                                    </div>
                                    <p className="vs-error-tip">Si se repite: convierte el video a <strong>MP4 (H.264)</strong> —por ejemplo con HandBrake, preset «Fast 1080p30»— y asegúrate de que el archivo esté descargado en tu equipo (no solo en iCloud o Google Drive).</p>
                                </div>
                            )}
                            {playingAction && (
                                <div className="vs-overlay">
                                    <span className="vs-overlay-count">Clip {nowPlaying.idx + 1}/{nowPlaying.items.length}</span>
                                    <span className={`vs-overlay-name vs-side-${playingPlayer?.side}`}>{playingPlayer?.name}</span>
                                    <span>{playingAction.skill}</span>
                                    <span className={`vs-sym vs-sym--${OUTCOME_CLASS[playingAction.outcome]}`}>{outcomeInfo(playingAction.outcome)?.symbol}</span>
                                </div>
                            )}
                            {flash && <div className="vs-flash">{flash}</div>}
                        </>
                    ) : (
                        <div className="vs-drop">
                            <div className="vs-drop-icon">🎬</div>
                            <h3>Abre el video del partido</h3>
                            <p>Arrástralo aquí o elígelo de tu computadora (MP4, MOV o WebM).</p>
                            <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>Elegir video</button>
                            {savedName && <p className="vs-drop-note">Último video usado en este partido: <strong>{savedName}</strong></p>}
                            <p className="vs-drop-note">El video no se sube a internet: se reproduce desde tu equipo y solo se guardan las acciones.</p>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*,.mov,.mkv"
                        hidden
                        onChange={e => { loadFile(e.target.files?.[0]); e.target.value = ''; }}
                    />
                </div>

                {videoUrl && (
                    <div className="vs-toolbar">
                        <div className="vs-tool-group">
                            <button onClick={() => nudge(-5)} title="−5 s (⇧←)">−5s</button>
                            <button onClick={() => nudge(-2)} title="−2 s (←)">−2s</button>
                            <button onClick={togglePlay} title="Reproducir / pausa (Espacio)">⏯</button>
                            <button onClick={() => nudge(2)} title="+2 s (→)">+2s</button>
                            <button onClick={() => nudge(5)} title="+5 s (⇧→)">+5s</button>
                        </div>
                        <div className="vs-tool-group" role="group" aria-label="Velocidad">
                            {SPEEDS.map(s => (
                                <button key={s} className={speed === s ? 'active' : ''} onClick={() => changeSpeed(s)}>{s}×</button>
                            ))}
                        </div>
                        <button className="vs-change" onClick={() => fileInputRef.current?.click()} title={videoName}>Cambiar video</button>
                    </div>
                )}
            </div>

            {/* Panel lateral */}
            <aside className="vs-panel">
                <div className="vs-tabs" role="tablist">
                    <button role="tab" aria-selected={tab === 'registrar'} className={tab === 'registrar' ? 'active' : ''} onClick={() => setTab('registrar')}>Registrar</button>
                    <button role="tab" aria-selected={tab === 'clips'} className={tab === 'clips' ? 'active' : ''} onClick={() => setTab('clips')}>
                        Clips <span className="vs-tab-count">{videoActions.length}</span>
                    </button>
                </div>

                {tab === 'registrar' ? (
                    <div className="vs-section">
                        <div className="vs-setbar">
                            <div className="vs-sets" role="group" aria-label="Set">
                                {Array.from({ length: maxSets }, (_, i) => (
                                    <button key={i} className={setIdx === i ? 'active' : ''} onClick={() => setSetIdx(i)}>Set {i + 1}</button>
                                ))}
                            </div>
                            <span className="vs-score" title="Marcador del set, calculado con las acciones">
                                {setScore.own} – {setScore.opponent}
                            </span>
                        </div>

                        <div className={`vs-step ${stage === 'player' ? 'is-on' : ''}`}>
                            <h5>Jugador</h5>
                            <div className="vs-grid vs-grid--2">
                                {allPlayers.map((p, i) => (
                                    <button key={p.id} className={`vs-btn vs-side-${p.side} ${sel.playerId === p.id ? 'active' : ''}`} onClick={() => selectPlayer(p.id)}>
                                        <kbd>{i + 1}</kbd>{p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={`vs-step ${stage === 'skill' ? 'is-on' : ''} ${!sel.playerId ? 'is-off' : ''}`}>
                            <h5>Fundamento</h5>
                            <div className="vs-grid vs-grid--3">
                                {SKILLS.map(s => (
                                    <button key={s} className={`vs-btn ${sel.skill === s ? 'active' : ''}`} disabled={!sel.playerId} onClick={() => selectSkill(s)}>
                                        <kbd>{SKILL_KEY_OF[s]}</kbd>{s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {sel.skill === 'Ataque' && (
                            <div className={`vs-step ${stage === 'attackType' ? 'is-on' : ''}`}>
                                <h5>Tipo de ataque</h5>
                                <div className="vs-grid vs-grid--3">
                                    {ATTACK_TYPES.map((t, i) => (
                                        <button key={t.key} className={`vs-btn ${sel.attackType === t.key ? 'active' : ''}`} onClick={() => selectAttackType(t.key)}>
                                            <kbd>{i + 1}</kbd>{t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={`vs-step ${stage === 'outcome' ? 'is-on' : ''} ${stage !== 'outcome' ? 'is-off' : ''}`}>
                            <h5>Resultado</h5>
                            <div className="vs-grid vs-grid--5">
                                {OUTCOMES.map((o, i) => (
                                    <button key={o.key} className={`vs-out vs-out--${OUTCOME_CLASS[o.key]} ${sel.outcome === o.key ? 'is-picked' : ''}`} disabled={stage !== 'outcome'} onClick={() => chooseOutcome(o.key)} title={`${o.key} (${i + 1})`}>
                                        <span className="vs-out-sym">{o.symbol}</span>
                                        <span className="vs-out-name">{o.key}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {stage === 'court' && (
                            <div className="vs-step is-on vs-court-step" ref={courtRef}>
                                <div className="vs-court-head">
                                    <h5>Cancha</h5>
                                    <div className="vs-court-phase">
                                        <span className={!sel.start ? 'is-active' : 'is-done'}>① Inicio</span>
                                        <span className={sel.start ? 'is-active' : ''}>② Final</span>
                                    </div>
                                </div>
                                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="vs-court" onClick={handleCourtClick} role="img" aria-label="Cancha: marca inicio y final del ataque">
                                    <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#fdf6e3" />
                                    <rect x={PAD_X} y={PAD_Y} width={SVG_W - 2 * PAD_X} height={SVG_H - 2 * PAD_Y} fill="#ffe8a1" stroke="#6d6d72" strokeWidth="1" />
                                    <line x1={SVG_W / 2} y1={PAD_Y} x2={SVG_W / 2} y2={SVG_H - PAD_Y} stroke="#6d6d72" strokeWidth="2" strokeDasharray="4" />
                                    {sel.start && (
                                        <g transform={`translate(${sel.start.x * SVG_W}, ${sel.start.y * SVG_H})`}>
                                            <circle r="12" fill="#007aff" stroke="white" strokeWidth="2" opacity="0.9" />
                                            <text textAnchor="middle" dy=".35em" style={{ fontSize: '10px', fill: 'white', fontWeight: 'bold' }}>S</text>
                                        </g>
                                    )}
                                </svg>
                                <div className="vs-court-actions">
                                    <label className="vs-court-pause">
                                        <input type="checkbox" checked={pauseOnCourt} onChange={e => togglePauseOnCourt(e.target.checked)} />
                                        Pausar el video mientras marco
                                    </label>
                                    {sel.start && <button className="vs-link" onClick={() => setSel(s => ({ ...s, start: null }))}>Volver a marcar inicio</button>}
                                    <button className="vs-court-skip" onClick={() => saveAction(sel.outcome)}>Omitir <kbd>Enter</kbd></button>
                                </div>
                            </div>
                        )}

                        <div className="vs-pending">
                            {sel.playerId ? (
                                <>
                                    <span className="vs-time">⏱ {fmtTime(sel.time)}</span>
                                    <span>{selPlayer?.name}{sel.skill ? ` › ${sel.skill}` : ''}{sel.attackType ? ` ${sel.attackType}` : ''}{sel.outcome ? ` › ${outcomeInfo(sel.outcome)?.symbol}` : ''}</span>
                                    <button className="vs-link" onClick={cancelEntry}>Cancelar (Esc)</button>
                                </>
                            ) : <span className="vs-muted">{videoUrl ? stageHint : 'Abre el video para empezar a registrar.'}</span>}
                        </div>

                        <div className="vs-list-head">
                            <h5>Acciones en video ({videoActions.length})</h5>
                        </div>
                        {videoActions.length === 0 ? (
                            <p className="vs-muted vs-empty">Aún no registraste acciones en este video.</p>
                        ) : (
                            <ul className="vs-list">
                                {videoActions.map(a => (
                                    <ActionRow key={a.id || `${a.timestamp}-${a.videoTime}`} action={a} player={playerById[a.playerId]} onClick={() => jumpTo(a)} onDelete={() => deleteAction(a)} />
                                ))}
                            </ul>
                        )}
                        <p className="vs-keys">Espacio ⏯ · ← → ±2 s · ⇧ ±5 s · , . cuadro · [ ] velocidad · ⌫ paso atrás</p>
                    </div>
                ) : (
                    <div className="vs-section">
                        {preset && (
                            <div className="vs-preset">
                                <div>
                                    <span className="vs-preset-kicker">Desde Tendencias</span>
                                    <strong>{preset.label}</strong>
                                </div>
                                <button className="vs-link" onClick={clearPreset}>Ver todos</button>
                            </div>
                        )}
                        <FilterGroup label="Atleta" onClear={() => clearFilter('players')} active={filters.players.size > 0}>
                            {allPlayers.map(p => (
                                <Chip key={p.id} on={filters.players.has(p.id)} side={p.side} count={countWith('players', p.id)} onClick={() => toggleFilter('players', p.id)}>{p.name}</Chip>
                            ))}
                        </FilterGroup>
                        <FilterGroup label="Fundamento" onClear={() => clearFilter('skills')} active={filters.skills.size > 0}>
                            {SKILLS.map(s => (
                                <Chip key={s} on={filters.skills.has(s)} count={countWith('skills', s)} onClick={() => toggleFilter('skills', s)}>{s}</Chip>
                            ))}
                        </FilterGroup>
                        <FilterGroup label="Resultado" onClear={() => clearFilter('outcomes')} active={filters.outcomes.size > 0}>
                            {OUTCOMES.map(o => (
                                <Chip key={o.key} on={filters.outcomes.has(o.key)} count={countWith('outcomes', o.key)} tone={OUTCOME_CLASS[o.key]} onClick={() => toggleFilter('outcomes', o.key)} title={o.key}>{o.symbol}</Chip>
                            ))}
                        </FilterGroup>
                        <FilterGroup label="Set" onClear={() => clearFilter('sets')} active={filters.sets.size > 0}>
                            {Array.from({ length: maxSets }, (_, i) => (
                                <Chip key={i} on={filters.sets.has(i)} count={countWith('sets', i)} onClick={() => toggleFilter('sets', i)}>Set {i + 1}</Chip>
                            ))}
                        </FilterGroup>

                        <div className="vs-play-row">
                            <span className="vs-muted">{clips.length} clips · {fmtTime(totalDuration(clips), false)}</span>
                            {nowPlaying ? (
                                <div className="vs-tool-group">
                                    <button onClick={() => playClip(nowPlaying.items, Math.max(0, nowPlaying.idx - 1))} disabled={nowPlaying.idx === 0} aria-label="Clip anterior">⏮</button>
                                    <button onClick={stopClips}>■ Detener</button>
                                    <button onClick={() => playClip(nowPlaying.items, nowPlaying.idx + 1)} disabled={nowPlaying.idx + 1 >= nowPlaying.items.length} aria-label="Clip siguiente">⏭</button>
                                </div>
                            ) : (
                                <div className="vs-tool-group">
                                    <button className="vs-download" disabled={!clips.length || !videoUrl} onClick={openExport} title="Une estos clips en un video para mandar a los atletas">⬇ Descargar</button>
                                    <button className="btn-primary" disabled={!clips.length || !videoUrl} onClick={() => playClip(clips, 0)}>▶ Reproducir clips</button>
                                </div>
                            )}
                        </div>
                        {!videoUrl && clips.length > 0 && <p className="vs-muted">Abre el video del partido para ver los clips.</p>}

                        {clips.length === 0 ? (
                            <p className="vs-muted vs-empty">
                                {videoActions.length ? 'Ningún clip con estos filtros.' : 'Registra acciones en la pestaña Registrar para verlas aquí como clips.'}
                            </p>
                        ) : (
                            <ul className="vs-list">
                                {clips.map((a, i) => (
                                    <ActionRow
                                        key={a.id || `${a.timestamp}-${a.videoTime}`}
                                        action={a}
                                        player={playerById[a.playerId]}
                                        playing={playingAction === a}
                                        onClick={() => videoUrl && playClip(clips, i)}
                                    />
                                ))}
                            </ul>
                        )}
                        {liveOnlyCount > 0 && (
                            <p className="vs-muted vs-footnote">{liveOnlyCount} acciones registradas en vivo no tienen tiempo de video y no aparecen como clips.</p>
                        )}
                    </div>
                )}
            </aside>

            {exporting && (
                <ClipExportDialog
                    clips={clips}
                    src={videoUrl}
                    defaultTitle={exportTitle()}
                    subtitle={exportSubtitle}
                    labelFor={exportLabel}
                    onClose={() => setExporting(false)}
                />
            )}
        </div>
    );
}

function ActionRow({ action, player, playing, onClick, onDelete }) {
    const info = outcomeInfo(action.outcome);
    return (
        <li className={`vs-row ${playing ? 'is-playing' : ''}`}>
            <button className="vs-row-main" onClick={onClick}>
                <span className="vs-time">{fmtTime(action.videoTime)}</span>
                <span className={`vs-row-name vs-side-${player?.side}`}>{player?.name || '—'}</span>
                <span className="vs-row-skill">{action.skill}{action.x != null && <span className="vs-row-court" title="Con trayectoria en la cancha"> ↗</span>}</span>
                <span className={`vs-sym vs-sym--${OUTCOME_CLASS[action.outcome]}`} title={action.outcome}>{info?.symbol}</span>
                <span className="vs-row-set">S{(action.setIndex ?? 0) + 1}</span>
            </button>
            {onDelete && <button className="vs-row-del" onClick={onDelete} aria-label="Eliminar acción" title="Eliminar">×</button>}
        </li>
    );
}

function FilterGroup({ label, active, onClear, children }) {
    return (
        <div className="vs-filter">
            <div className="vs-filter-head">
                <h5>{label}</h5>
                {active && <button className="vs-link" onClick={onClear}>Todos</button>}
            </div>
            <div className="vs-chips">{children}</div>
        </div>
    );
}

function Chip({ on, count, side, tone, onClick, title, children }) {
    return (
        <button
            className={`vs-chip ${on ? 'is-on' : ''} ${side ? `vs-side-${side}` : ''} ${tone ? `vs-chip--${tone}` : ''}`}
            onClick={onClick}
            disabled={!count && !on}
            title={title}
            aria-pressed={on}
        >
            {children}<span className="vs-chip-count">{count}</span>
        </button>
    );
}
