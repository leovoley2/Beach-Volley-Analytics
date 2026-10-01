import React, { useState, useRef, useEffect } from 'react';
import { BoardEngine, VIEWS, BALL_GROUND } from '../lib/board3d/engine';
import { POSES, POSE_KEYS } from '../lib/board3d/poses';
import { DRILLS, DRILL_CATEGORIES } from '../lib/board3d/drills';
import { TEAM_COLORS } from '../lib/board3d/figures';
import {
    newId, endState, instantiate, drillSteps, downloadDrills, parseDrillsFile,
} from '../lib/board3d/library';
import { fetchDrills, createDrills, updateDrill, deleteDrill as removeDrill, migrateLocalDrills } from '../lib/board3d/drillsApi';
import { videoSupport, recordPlayback } from '../lib/board3d/recorder';

// Pizarra 3D: cancha de vóley playa en 3D para mover jugadores, elegir su pose, marcar
// desplazamientos y trayectorias del balón y reproducirlos. Sirve tanto para explicar
// situaciones de un partido como para armar ejercicios de entrenamiento.
// Cada escena es una secuencia de pasos (saque → recepción → colocación → ataque…).
// Las escenas de trabajo viven en localStorage; "Mis ejercicios" se guardan en Supabase.

const TEAMS = [
    { key: 'A', label: 'Equipo A' },
    { key: 'B', label: 'Equipo B' },
    { key: 'C', label: 'Entrenador' },
];
const TABS = [
    { key: 'add', label: 'Añadir' },
    { key: 'selected', label: 'Seleccionado' },
    { key: 'library', label: 'Ejercicios' },
    { key: 'settings', label: 'Ajustes' },
];
// Posición inicial al añadir un jugador según equipo y slot.
const SPOTS = {
    A: [[-5, -2], [-5, 2], [-3, 0], [-6.5, 0]],
    B: [[5, -2], [5, 2], [3, 0], [6.5, 0]],
    C: [[-1.5, -5.2], [1.5, -5.2]],
};

const emptyScene = (n) => ({ id: newId(), name: `Escena ${n}`, notes: '', steps: [{ id: newId(), items: [] }] });
// Escenas guardadas antes de existir los pasos tenían `items` directamente.
const migrateScene = (sc) => (sc.steps ? sc : { ...sc, steps: [{ id: newId(), items: sc.items || [] }] });
const storageKey = (scope) => `bva:pizarra3d:${scope}`;
const SETTINGS_KEY = 'bva:pizarra3d:settings';

function load(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key) || 'null');
        return v ?? fallback;
    } catch { return fallback; }
}

function shortName(name, fallback) {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return fallback;
    if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
    return words[0].slice(0, 3);
}

const facingNet = (x) => (x < 0 ? 90 : -90);

export default function Board3D({ storageScope, ownPlayers = [], opponentPlayers = [], fileName = 'pizarra-3d' }) {
    const [scenes, setScenes] = useState(() => {
        const s = load(storageKey(storageScope), null);
        return Array.isArray(s) && s.length > 0 ? s.map(migrateScene) : [emptyScene(1)];
    });
    const [activeId, setActiveId] = useState(() => scenes[0].id);
    const [past, setPast] = useState([]);
    const [future, setFuture] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [tab, setTab] = useState('add');
    const [addTeam, setAddTeam] = useState('A');
    const [settings, setSettings] = useState(() => ({ category: 'men', showPaths: true, showLabels: true, ...load(SETTINGS_KEY, {}) }));
    const [view, setView] = useState('coach');
    const [expanded, setExpanded] = useState(false);
    const [webglError, setWebglError] = useState(false);
    const [stepIdx, setStepIdx] = useState(0);
    const [playingStep, setPlayingStep] = useState(null);
    const [userDrills, setUserDrills] = useState([]);
    const [drillsStatus, setDrillsStatus] = useState('loading'); // loading | ready | error | saving
    const [recording, setRecording] = useState(false);
    const [video, setVideo] = useState(null); // { url, file } del último video grabado
    const [saveForm, setSaveForm] = useState(null); // { name, category } mientras se guarda un ejercicio
    const importRef = useRef(null);

    const stageRef = useRef(null);
    const engineRef = useRef(null);

    const active = scenes.find(s => s.id === activeId) || scenes[0];
    const steps = active.steps;
    const idx = Math.min(stepIdx, steps.length - 1);
    const items = steps[idx].items;
    const selected = items.find(it => it.id === selectedId) || null;

    const labelFor = (team, slot) => {
        if (team === 'C') return slot === 0 ? 'E' : `E${slot + 1}`;
        const roster = team === 'A' ? ownPlayers : opponentPlayers;
        return shortName(roster[slot]?.name, `${team}${slot + 1}`);
    };

    // --- Persistencia local ---
    useEffect(() => {
        const t = setTimeout(() => {
            try { localStorage.setItem(storageKey(storageScope), JSON.stringify(scenes)); }
            catch { /* almacenamiento lleno o bloqueado: la pizarra sigue en memoria */ }
        }, 400);
        return () => clearTimeout(t);
    }, [scenes, storageScope]);
    useEffect(() => {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* sin almacenamiento */ }
    }, [settings]);

    // --- Historial ---
    const updateActive = (patch) => {
        setScenes(ss => ss.map(s => (s.id === activeId ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)));
    };
    // El historial guarda la secuencia completa de pasos de la escena.
    const withItems = (next) => steps.map((st, i) => (i === idx ? { ...st, items: next } : st));
    const commitSteps = (next) => {
        setPast(p => [...p.slice(-99), steps]);
        setFuture([]);
        updateActive({ steps: next });
    };
    const commit = (next) => commitSteps(withItems(next));
    const patchItem = (id, patch) => commit(items.map(it => (it.id === id ? { ...it, ...patch } : it)));
    // Cambio en vivo (deslizadores, texto): se aplica sin historial y se registra una sola vez al soltar.
    const liveBefore = useRef(null);
    const patchLive = (id, patch) => {
        if (!liveBefore.current) liveBefore.current = steps;
        updateActive({ steps: withItems(items.map(it => (it.id === id ? { ...it, ...patch } : it))) });
    };
    const endLive = () => {
        const before = liveBefore.current;
        liveBefore.current = null;
        if (!before) return;
        setPast(p => [...p.slice(-99), before]);
        setFuture([]);
    };
    const liveEnd = { onPointerUp: endLive, onKeyUp: endLive, onBlur: endLive };
    const undo = () => {
        if (past.length === 0) return;
        setFuture(f => [steps, ...f]);
        updateActive({ steps: past[past.length - 1] });
        setPast(p => p.slice(0, -1));
    };
    const redo = () => {
        if (future.length === 0) return;
        setPast(p => [...p, steps]);
        updateActive({ steps: future[0] });
        setFuture(f => f.slice(1));
    };

    // --- Motor 3D ---
    // Los callbacks del motor leen siempre la versión más reciente por ref.
    const handlers = useRef({});
    handlers.current = {
        onSelect: (id) => {
            setSelectedId(id);
            if (id) setTab('selected');
        },
        onChange: (id, patch) => patchItem(id, patch),
        onPlayStep: (k) => setPlayingStep(k),
    };

    useEffect(() => {
        let engine;
        try {
            engine = new BoardEngine(stageRef.current, {
                onSelect: (id) => handlers.current.onSelect(id),
                onChange: (id, patch) => handlers.current.onChange(id, patch),
                onPlayStep: (k) => handlers.current.onPlayStep(k),
            });
        } catch {
            setWebglError(true);
            return undefined;
        }
        engineRef.current = engine;
        return () => { engine.dispose(); engineRef.current = null; };
    }, []);

    useEffect(() => { engineRef.current?.setItems(items); }, [items]);
    useEffect(() => { engineRef.current?.setSelected(selectedId); }, [selectedId, items]);
    useEffect(() => { engineRef.current?.setCategory(settings.category); }, [settings.category]);
    useEffect(() => {
        engineRef.current?.setOptions({ showPaths: settings.showPaths, showLabels: settings.showLabels });
    }, [settings.showPaths, settings.showLabels]);

    // Atajos de teclado
    const keyRef = useRef(null);
    keyRef.current = (e) => {
        if (e.key === 'Escape') { setExpanded(false); return; }
        const tag = e.target?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
            e.preventDefault();
            removeSelected();
        }
    };
    useEffect(() => {
        const onKey = (e) => keyRef.current(e);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // --- Escenas ---
    const switchScene = (id) => {
        setActiveId(id);
        setStepIdx(0);
        setPast([]);
        setFuture([]);
        setSelectedId(null);
    };
    const addScene = (scene = emptyScene(scenes.length + 1)) => {
        setScenes(ss => [...ss, scene]);
        switchScene(scene.id);
    };
    const renameScene = () => {
        const name = window.prompt('Nombre de la escena', active.name);
        if (name && name.trim()) updateActive({ name: name.trim().slice(0, 40) });
    };
    const deleteScene = () => {
        if (scenes.length <= 1) return;
        if (!window.confirm(`¿Eliminar "${active.name}"?`)) return;
        const rest = scenes.filter(s => s.id !== active.id);
        setScenes(rest);
        switchScene(rest[0].id);
    };

    // --- Añadir ---
    // Lo que se añade o elimina en un paso se aplica también a los pasos siguientes.
    const add = (item) => {
        commitSteps(steps.map((st, i) => (i >= idx ? { ...st, items: [...st.items, item] } : st)));
        setSelectedId(item.id);
    };
    const addPlayer = (pose) => {
        const used = new Set(items.filter(it => it.kind === 'player' && it.team === addTeam).map(it => it.slot));
        let slot = 0;
        while (used.has(slot)) slot++;
        const spots = SPOTS[addTeam];
        const [x, z] = spots[slot] || [spots[0][0] + 0.8 * slot, spots[0][1] + 0.8];
        add({ id: newId(), kind: 'player', team: addTeam, slot, label: labelFor(addTeam, slot), x, z, rot: facingNet(x), pose });
    };
    const addBall = () => add({ id: newId(), kind: 'ball', x: -5, z: 0, y: 1 });
    const addCone = () => add({ id: newId(), kind: 'cone', x: -4 + (items.length % 4) * 0.6, z: 3 });

    const loadDrill = (drill) => {
        addScene({ id: newId(), name: drill.name.slice(0, 40), notes: drill.notes || '', steps: instantiate(drill, labelFor) });
        setTab('add');
    };

    // --- Pasos ---
    const goStep = (i) => {
        setStepIdx(i);
        setSelectedId(null);
    };
    // El paso nuevo arranca donde termina el actual: jugadores en su destino, balón donde cayó.
    const addStep = () => {
        const next = { id: newId(), items: items.map(endState) };
        commitSteps([...steps.slice(0, idx + 1), next, ...steps.slice(idx + 1)]);
        goStep(idx + 1);
    };
    const deleteStep = () => {
        if (steps.length <= 1 || !window.confirm(`¿Eliminar el paso ${idx + 1}?`)) return;
        commitSteps(steps.filter((_, i) => i !== idx));
        goStep(Math.max(0, idx - 1));
    };

    // --- Mis ejercicios (Supabase) ---
    const loadDrills = async () => {
        setDrillsStatus('loading');
        try {
            await migrateLocalDrills().catch(() => {}); // si falla, se reintenta la próxima vez
            setUserDrills(await fetchDrills());
            setDrillsStatus('ready');
        } catch {
            setDrillsStatus('error');
        }
    };
    useEffect(() => { loadDrills(); }, []);

    // Ejecuta una operación contra la nube mostrando el estado y avisando si falla.
    const cloud = async (fn) => {
        setDrillsStatus('saving');
        try {
            await fn();
            return true;
        } catch (err) {
            window.alert(err.message);
            return false;
        } finally {
            setDrillsStatus('ready');
        }
    };
    const sortDrills = (list) => [...list].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const userCategories = [...new Set(userDrills.map(d => d.category))];
    const saveDrill = async () => {
        const name = saveForm.name.trim().slice(0, 60);
        if (!name) return;
        const category = saveForm.category.trim().slice(0, 40) || 'Mis ejercicios';
        const existing = userDrills.find(d => d.name.toLowerCase() === name.toLowerCase());
        if (existing && !window.confirm(`Ya existe "${existing.name}". ¿Reemplazarlo?`)) return;
        const drill = { name, category, notes: active.notes, steps: steps.map(st => ({ items: st.items })) };
        const ok = await cloud(async () => {
            if (existing) {
                const saved = await updateDrill(existing.key, drill);
                setUserDrills(list => sortDrills(list.map(d => (d.key === existing.key ? saved : d))));
            } else {
                const [saved] = await createDrills([drill]);
                setUserDrills(list => sortDrills([...list, saved]));
            }
        });
        if (ok) setSaveForm(null);
    };
    const deleteDrill = (d) => {
        if (!window.confirm(`¿Eliminar el ejercicio "${d.name}"?`)) return;
        cloud(async () => {
            await removeDrill(d.key);
            setUserDrills(list => list.filter(x => x.key !== d.key));
        });
    };
    const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    const importDrills = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        let drills;
        try {
            if (file.size > 2_000_000) throw new Error('El archivo es demasiado grande.');
            drills = parseDrillsFile(await file.text());
        } catch (err) {
            window.alert(err.message || 'No se pudo importar el archivo.');
            return;
        }
        const ok = await cloud(async () => {
            const saved = await createDrills(drills);
            setUserDrills(list => sortDrills([...list, ...saved]));
        });
        if (ok) window.alert(`Se importaron ${drills.length} ejercicio(s).`);
    };

    // --- Video para compartir ---
    const canRecord = !!videoSupport();
    const recordVideo = async () => {
        const engine = engineRef.current;
        if (!engine || recording) return;
        setRecording(true);
        setSelectedId(null);
        try {
            const { blob, ext } = await recordPlayback(engine, steps.map(st => st.items), { title: active.name });
            if (video) URL.revokeObjectURL(video.url);
            const file = new File([blob], `${slug(`${active.name}`) || 'jugada'}.${ext}`, { type: blob.type });
            setVideo({ url: URL.createObjectURL(blob), file });
        } catch (err) {
            window.alert(err.message);
        } finally {
            setRecording(false);
        }
    };
    useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
    const canShareVideo = !!video && typeof navigator.canShare === 'function' && navigator.canShare({ files: [video.file] });
    const shareVideo = async () => {
        try { await navigator.share({ files: [video.file], title: active.name }); }
        catch { /* el usuario canceló */ }
    };
    const downloadVideo = () => {
        const a = document.createElement('a');
        a.href = video.url;
        a.download = video.file.name;
        a.click();
    };

    // --- Seleccionado ---
    const removeSelected = () => {
        if (!selected) return;
        commitSteps(steps.map((st, i) => (i >= idx ? { ...st, items: st.items.filter(it => it.id !== selected.id) } : st)));
        setSelectedId(null);
    };
    const rotate = (deg) => patchItem(selected.id, { rot: ((selected.rot ?? 90) + deg + 540) % 360 - 180 });
    const toggleMove = () => {
        if (selected.to) { patchItem(selected.id, { to: undefined }); return; }
        if (selected.kind === 'player') {
            const dir = selected.x < 0 ? 1 : -1;
            patchItem(selected.id, { to: { x: selected.x + 2.5 * dir, z: selected.z } });
        } else {
            patchItem(selected.id, { to: { x: -selected.x || 5, y: BALL_GROUND, z: selected.z, peak: 3 } });
        }
    };
    const changeTeam = (team) => {
        const used = new Set(items.filter(it => it.kind === 'player' && it.team === team && it.id !== selected.id).map(it => it.slot));
        let slot = 0;
        while (used.has(slot)) slot++;
        patchItem(selected.id, { team, slot, label: labelFor(team, slot) });
    };

    const clearScene = () => {
        if (items.length === 0) return;
        if (window.confirm('¿Borrar todos los elementos de esta escena?')) { commit([]); setSelectedId(null); }
    };

    const changeView = (key) => {
        setView(key);
        engineRef.current?.setView(key);
    };

    const playStep = () => {
        if (!engineRef.current?.play([items], idx)) {
            window.alert('Añade un desplazamiento a un jugador o una trayectoria al balón (pestaña Seleccionado) para reproducirlo.');
        }
    };
    const playAll = () => engineRef.current?.play(steps.map(st => st.items), 0);

    const downloadPng = async () => {
        const blob = await engineRef.current?.snapshot();
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${slug(`${fileName}-${active.name}-paso-${idx + 1}`)}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const setSetting = (patch) => setSettings(s => ({ ...s, ...patch }));
    const hasMoves = items.some(it => it.to);
    const stepsWithMoves = steps.filter(st => st.items.some(it => it.to)).length;

    return (
        <div className={`b3d ${expanded ? 'b3d--expanded' : ''}`}>
            <div className="wb-tabs">
                {scenes.map(s => (
                    <button key={s.id} className={`wb-tab ${s.id === active.id ? 'active' : ''}`}
                        onClick={() => switchScene(s.id)} onDoubleClick={renameScene}>
                        {s.name}
                    </button>
                ))}
                <button className="wb-tab wb-tab-add" onClick={() => addScene()} title="Nueva escena">+ Nueva</button>
                <span className="wb-tabs-spacer" />
                <button className="wb-tab-action" onClick={undo} disabled={past.length === 0} title="Deshacer (Ctrl+Z)">↶</button>
                <button className="wb-tab-action" onClick={redo} disabled={future.length === 0} title="Rehacer (Ctrl+Shift+Z)">↷</button>
                <button className="wb-tab-action" onClick={renameScene} title="Renombrar escena">✎</button>
                {scenes.length > 1 && <button className="wb-tab-action" onClick={deleteScene} title="Eliminar escena">✕</button>}
                <button className="wb-tab-action" onClick={() => setExpanded(x => !x)} title={expanded ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}>
                    {expanded ? '⤡' : '⤢'}
                </button>
            </div>

            {/* Pasos de la secuencia */}
            <div className="b3d-steps">
                <span className="b3d-steps-label">Pasos</span>
                {steps.map((st, i) => (
                    <button key={st.id} className={`b3d-step ${i === idx ? 'active' : ''} ${playingStep === i ? 'playing' : ''}`}
                        onClick={() => goStep(i)} title={`Paso ${i + 1}`}>
                        {i + 1}
                    </button>
                ))}
                <button className="b3d-step-add" onClick={addStep} title="Nuevo paso que continúa desde el final de este">+ Paso</button>
                {steps.length > 1 && <button className="b3d-step-del" onClick={deleteStep} title={`Eliminar paso ${idx + 1}`}>✕</button>}
                <span className="wb-tabs-spacer" />
                <button className={`b3d-playbtn ${hasMoves ? '' : 'muted'}`} onClick={playStep} title="Reproducir este paso">▶ Paso</button>
                {steps.length > 1 && (
                    <button className={`b3d-playbtn ${stepsWithMoves ? '' : 'muted'}`} onClick={playAll} title="Reproducir la secuencia completa">▶ Todo</button>
                )}
                {canRecord && (
                    <button className="b3d-videobtn" onClick={recordVideo} disabled={recording || stepsWithMoves === 0}
                        title="Grabar la jugada como video para compartir">
                        {recording ? '● Grabando…' : '🎬 Video'}
                    </button>
                )}
            </div>

            <div className="b3d-main">
                <div className="b3d-stage">
                    <div className="b3d-canvas" ref={stageRef} />
                    {webglError && (
                        <div className="b3d-error">
                            Este navegador o dispositivo no soporta gráficos 3D (WebGL). Usa la pizarra 2D.
                        </div>
                    )}
                    <div className="b3d-views">
                        {Object.entries(VIEWS).map(([key, v]) => (
                            <button key={key} className={view === key ? 'active' : ''} onClick={() => changeView(key)}>{v.label}</button>
                        ))}
                    </div>
                    {playingStep !== null && (
                        <div className={`b3d-empty ${recording ? 'b3d-rec' : ''}`}>
                            {recording && '● REC · '}Paso {playingStep + 1} de {steps.length}
                        </div>
                    )}
                    {video && !recording && (
                        <div className="b3d-video">
                            <video src={video.url} controls playsInline muted />
                            <div className="b3d-video-actions">
                                {canShareVideo && <button className="active" onClick={shareVideo}>Compartir</button>}
                                <button onClick={downloadVideo}>⬇ Descargar</button>
                                <button onClick={() => setVideo(null)}>Cerrar</button>
                            </div>
                        </div>
                    )}
                    {playingStep === null && items.length === 0 && !webglError && (
                        <div className="b3d-empty">Añade jugadores o carga un ejercicio · arrastra para moverlos · gira la cámara con el dedo</div>
                    )}
                </div>

                <aside className="b3d-panel">
                    <div className="b3d-panel-tabs">
                        {TABS.map(t => (
                            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="b3d-panel-body">
                        {tab === 'add' && (
                            <>
                                <h4>Jugadores</h4>
                                <div className="b3d-seg">
                                    {TEAMS.map(t => (
                                        <button key={t.key} className={addTeam === t.key ? 'active' : ''} onClick={() => setAddTeam(t.key)}>
                                            <span className="b3d-dot" style={{ background: TEAM_COLORS[t.key] }} />{t.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="b3d-help">Elige la pose para añadir un jugador:</p>
                                <div className="b3d-grid">
                                    {POSE_KEYS.map(k => (
                                        <button key={k} onClick={() => addPlayer(k)}>{POSES[k].label}</button>
                                    ))}
                                </div>
                                <h4>Material</h4>
                                <div className="b3d-grid">
                                    <button onClick={addBall}>🏐 Balón</button>
                                    <button onClick={addCone}>🔺 Cono</button>
                                </div>
                            </>
                        )}

                        {tab === 'selected' && !selected && (
                            <p className="b3d-help">Toca un jugador, el balón o un cono en la cancha para editarlo.</p>
                        )}

                        {tab === 'selected' && selected?.kind === 'player' && (
                            <>
                                <h4>Jugador</h4>
                                <label className="b3d-field">
                                    Etiqueta
                                    <input value={selected.label} maxLength={4} onBlur={endLive}
                                        onChange={e => patchLive(selected.id, { label: e.target.value })} />
                                </label>
                                <div className="b3d-seg">
                                    {TEAMS.map(t => (
                                        <button key={t.key} className={selected.team === t.key ? 'active' : ''} onClick={() => changeTeam(t.key)}>
                                            <span className="b3d-dot" style={{ background: TEAM_COLORS[t.key] }} />{t.label}
                                        </button>
                                    ))}
                                </div>
                                <h4>Pose</h4>
                                <div className="b3d-grid">
                                    {POSE_KEYS.map(k => (
                                        <button key={k} className={selected.pose === k ? 'active' : ''} onClick={() => patchItem(selected.id, { pose: k })}>
                                            {POSES[k].label}
                                        </button>
                                    ))}
                                </div>
                                <h4>Orientación</h4>
                                <div className="b3d-grid b3d-grid--3">
                                    <button onClick={() => rotate(45)}>⟲ 45°</button>
                                    <button onClick={() => patchItem(selected.id, { rot: facingNet(selected.x) })}>Mirar red</button>
                                    <button onClick={() => rotate(-45)}>45° ⟳</button>
                                </div>
                                <h4>Movimiento</h4>
                                <button className="b3d-wide" onClick={toggleMove}>{selected.to ? 'Quitar desplazamiento' : '+ Añadir desplazamiento'}</button>
                                {selected.to && <p className="b3d-help">Arrastra el círculo de destino en la arena y pulsa ▶ Reproducir.</p>}
                                <button className="b3d-wide b3d-danger" onClick={removeSelected}>Eliminar jugador</button>
                            </>
                        )}

                        {tab === 'selected' && selected?.kind === 'ball' && (
                            <>
                                <h4>Balón</h4>
                                <label className="b3d-field">
                                    Altura: {selected.y.toFixed(1)} m
                                    <input type="range" min={BALL_GROUND} max="4" step="0.05" value={selected.y}
                                        onChange={e => patchLive(selected.id, { y: Number(e.target.value) })} {...liveEnd} />
                                </label>
                                <h4>Trayectoria</h4>
                                <button className="b3d-wide" onClick={toggleMove}>{selected.to ? 'Quitar trayectoria' : '+ Añadir trayectoria'}</button>
                                {selected.to && (
                                    <>
                                        <label className="b3d-field">
                                            Altura de la parábola: {selected.to.peak.toFixed(1)} m
                                            <input type="range" min="0" max="7" step="0.1" value={selected.to.peak}
                                                onChange={e => patchLive(selected.id, { to: { ...selected.to, peak: Number(e.target.value) } })} {...liveEnd} />
                                        </label>
                                        <label className="b3d-field">
                                            Altura en el destino: {selected.to.y.toFixed(1)} m
                                            <input type="range" min={BALL_GROUND} max="3.5" step="0.05" value={selected.to.y}
                                                onChange={e => patchLive(selected.id, { to: { ...selected.to, y: Number(e.target.value) } })} {...liveEnd} />
                                        </label>
                                        <p className="b3d-help">Arrastra el balón amarillo transparente para cambiar el destino.</p>
                                    </>
                                )}
                                <button className="b3d-wide b3d-danger" onClick={removeSelected}>Eliminar balón</button>
                            </>
                        )}

                        {tab === 'selected' && selected?.kind === 'cone' && (
                            <>
                                <h4>Cono</h4>
                                <p className="b3d-help">Arrástralo para marcar zonas, objetivos o recorridos.</p>
                                <button className="b3d-wide b3d-danger" onClick={removeSelected}>Eliminar cono</button>
                            </>
                        )}

                        {tab === 'library' && (
                            <>
                                <h4>Mis ejercicios <span className="b3d-cloud">☁ en tu cuenta</span></h4>
                                {drillsStatus === 'loading' && <p className="b3d-help">Cargando tus ejercicios…</p>}
                                {drillsStatus === 'error' && (
                                    <p className="b3d-help">
                                        No se pudieron cargar tus ejercicios. <button className="b3d-link" onClick={loadDrills}>Reintentar</button>
                                    </p>
                                )}
                                {saveForm ? (
                                    <form className="b3d-save" onSubmit={e => { e.preventDefault(); saveDrill(); }}>
                                        <label className="b3d-field">
                                            Nombre
                                            <input value={saveForm.name} maxLength={60} autoFocus
                                                onChange={e => setSaveForm(f => ({ ...f, name: e.target.value }))} />
                                        </label>
                                        <label className="b3d-field">
                                            Categoría
                                            <input value={saveForm.category} maxLength={40} list="b3d-categories" placeholder="Mis ejercicios"
                                                onChange={e => setSaveForm(f => ({ ...f, category: e.target.value }))} />
                                            <datalist id="b3d-categories">
                                                {[...new Set([...userCategories, ...DRILL_CATEGORIES])].map(c => <option key={c} value={c} />)}
                                            </datalist>
                                        </label>
                                        <p className="b3d-help">Se guardan los {steps.length} paso(s) y las notas de la escena.</p>
                                        <div className="b3d-grid">
                                            <button type="button" onClick={() => setSaveForm(null)}>Cancelar</button>
                                            <button type="submit" className="active" disabled={!saveForm.name.trim() || drillsStatus === 'saving'}>
                                                {drillsStatus === 'saving' ? 'Guardando…' : 'Guardar'}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <button className="b3d-wide" onClick={() => setSaveForm({ name: active.name, category: userCategories[0] || 'Mis ejercicios' })}
                                        disabled={steps.every(st => st.items.length === 0) || drillsStatus === 'loading'}>
                                        💾 Guardar escena como ejercicio
                                    </button>
                                )}
                                {drillsStatus === 'ready' && userDrills.length === 0 && !saveForm && (
                                    <p className="b3d-help">Arma tu ejercicio con varios pasos y guárdalo aquí para reutilizarlo en cualquier partido o entrenamiento.</p>
                                )}
                                {userCategories.map(cat => (
                                    <div key={cat} className="b3d-list">
                                        <span className="b3d-cat">{cat}</span>
                                        {userDrills.filter(d => d.category === cat).map(d => (
                                            <div key={d.key} className="b3d-drill">
                                                <button className="b3d-drill-load" onClick={() => loadDrill(d)} title={d.notes || d.name}>
                                                    {d.name}
                                                    <small>{d.steps.length} paso{d.steps.length === 1 ? '' : 's'}</small>
                                                </button>
                                                <button className="b3d-drill-act" onClick={() => downloadDrills([d], `ejercicio-${slug(d.name)}`)} title="Exportar (.json) para compartir" aria-label={`Exportar ${d.name}`}>⬇</button>
                                                <button className="b3d-drill-act b3d-danger" onClick={() => deleteDrill(d)} title="Eliminar" aria-label={`Eliminar ${d.name}`}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <div className="b3d-grid">
                                    <button onClick={() => importRef.current?.click()} disabled={drillsStatus !== 'ready'}>⬆ Importar</button>
                                    <button onClick={() => downloadDrills(userDrills, 'mis-ejercicios-pizarra')} disabled={userDrills.length === 0}>⬇ Exportar todos</button>
                                </div>
                                <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importDrills} />

                                <h4>Ejercicios incluidos</h4>
                                <p className="b3d-help">Cada ejercicio se abre en una escena nueva; luego puedes modificarlo y guardarlo como tuyo.</p>
                                {DRILL_CATEGORIES.map(cat => (
                                    <div key={cat} className="b3d-list">
                                        <span className="b3d-cat">{cat}</span>
                                        {DRILLS.filter(d => d.category === cat).map(d => {
                                            const n = drillSteps(d).length;
                                            return (
                                                <button key={d.key} onClick={() => loadDrill(d)} title={d.notes}>
                                                    {d.name}{n > 1 && <small> · {n} pasos</small>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </>
                        )}

                        {tab === 'settings' && (
                            <>
                                <h4>Categoría · altura de red</h4>
                                <div className="b3d-seg">
                                    <button className={settings.category === 'men' ? 'active' : ''} onClick={() => setSetting({ category: 'men' })}>Masculino · 2,43 m</button>
                                    <button className={settings.category === 'women' ? 'active' : ''} onClick={() => setSetting({ category: 'women' })}>Femenino · 2,24 m</button>
                                </div>
                                <h4>Mostrar</h4>
                                <label className="b3d-check">
                                    <input type="checkbox" checked={settings.showPaths} onChange={e => setSetting({ showPaths: e.target.checked })} />
                                    Desplazamientos y trayectorias
                                </label>
                                <label className="b3d-check">
                                    <input type="checkbox" checked={settings.showLabels} onChange={e => setSetting({ showLabels: e.target.checked })} />
                                    Etiquetas de los jugadores
                                </label>
                                <h4>Escena</h4>
                                <div className="b3d-grid">
                                    <button onClick={downloadPng}>⬇ Imagen PNG</button>
                                    <button className="b3d-danger" onClick={clearScene} disabled={items.length === 0}>Vaciar escena</button>
                                </div>
                            </>
                        )}
                    </div>
                </aside>
            </div>

            {!expanded && (
                <div className="wb-notes">
                    <label htmlFor="b3d-notes-text">Notas de la escena</label>
                    <textarea
                        id="b3d-notes-text"
                        value={active.notes}
                        onChange={e => updateActive({ notes: e.target.value })}
                        placeholder="Explica el ejercicio o la situación: objetivo, consignas, repeticiones…"
                        rows={4}
                    />
                    <p className="wb-footnote">Las escenas se guardan solo en este dispositivo.</p>
                </div>
            )}
        </div>
    );
}
