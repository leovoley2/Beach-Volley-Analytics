import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildEnvironment, NET_HEIGHTS } from './environment';
import {
    TEAM_COLORS, createPlayer, createBall, createCone, createTarget,
    applyPose, setBallHeight, setSelected,
} from './figures';
import { BALL_GROUND, endState } from './library';

// Motor de la pizarra 3D. Es imperativo (three.js puro) y React solo le pasa el estado:
// los ítems de la escena en metros. El arrastre se hace aquí sin re-renderizar React y
// al soltar se avisa con onChange(id, patch) para que React guarde el cambio en su historial.

const LIMIT_X = 13, LIMIT_Z = 9;
const PLAY_MS = 2400, STILL_MS = 900, BLEND_MS = 600, HOLD_MS = 1200;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r2 = (v) => Math.round(v * 100) / 100;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

export { BALL_GROUND };

// Punto de la parábola del balón en t ∈ [0, 1]. `peak` = metros extra sobre la recta entre origen y destino.
export function arcPoint(ball, t) {
    const to = ball.to;
    return new THREE.Vector3(
        lerp(ball.x, to.x, t),
        lerp(ball.y ?? BALL_GROUND, to.y ?? BALL_GROUND, t) + 4 * (to.peak ?? 0) * t * (1 - t),
        lerp(ball.z, to.z, t),
    );
}

export const VIEWS = {
    coach: { label: 'Entrenador', pos: [-14, 6, 4.5], target: [0, 0.6, 0] },
    serve: { label: 'Saque', pos: [-10.5, 2, 2.5], target: [4, 1.4, 0] },
    top: { label: 'Arriba', pos: [0, 24, 0.01], target: [0, 0, 0] },
    block: { label: 'Bloqueo', pos: [4.5, 4.4, 0.6], target: [-5, 0.4, 0] },
    side: { label: 'TV', pos: [0, 8.5, 16], target: [0, 0.4, 0] },
    rival: { label: 'Rival', pos: [14, 6, -4.5], target: [0, 0.6, 0] },
};

const UP = new THREE.Vector3(0, 1, 0);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
const arcMat = new THREE.MeshBasicMaterial({ color: '#fde047' });

export class BoardEngine {
    constructor(container, { onSelect, onChange, onPlayStep }) {
        this.container = container;
        this.onSelect = onSelect;
        this.onChange = onChange;
        this.onPlayStep = onPlayStep;
        this.items = [];
        this.objects = new Map(); // id → { obj, sig }
        this.selectedId = null;
        this.showPaths = true;
        this.showLabels = true;
        this.dirty = true;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        container.appendChild(renderer.domElement);
        this.renderer = renderer;

        this.scene = new THREE.Scene();
        this.env = buildEnvironment(this.scene);
        this.env.setNetHeight(NET_HEIGHTS.men);
        this.paths = new THREE.Group();
        this.scene.add(this.paths);

        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
        this.controls = new OrbitControls(this.camera, renderer.domElement);
        Object.assign(this.controls, {
            enableDamping: true, dampingFactor: 0.12, minDistance: 3, maxDistance: 45,
            maxPolarAngle: Math.PI / 2 - 0.04,
        });
        this.controls.addEventListener('change', () => { this.dirty = true; });

        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(UP, 0);

        // En captura sobre el contenedor: decide antes que OrbitControls si el toque es un arrastre de ficha.
        this._down = this._onPointerDown.bind(this);
        this._move = this._onPointerMove.bind(this);
        this._up = this._onPointerUp.bind(this);
        container.addEventListener('pointerdown', this._down, true);

        this._resize = new ResizeObserver(() => this._fit());
        this._resize.observe(container);
        this._fit();
        this.setView('coach', false);

        const loop = () => {
            this._raf = requestAnimationFrame(loop);
            this._tick(performance.now());
        };
        loop();
    }

    // --- Estado que llega desde React ---
    setItems(items) {
        this.items = items;
        const alive = new Set(items.map(it => it.id));
        for (const it of items) this._ensure(it).visible = true;
        for (const id of [...this.objects.keys()]) if (!alive.has(id)) this._remove(id);
        this._stopAnim();
        this._placeAll();
        this._applySelection();
        this._applyLabels();
        this._drawPaths();
    }

    setSelected(id) {
        this.selectedId = id;
        this._applySelection();
    }

    setCategory(category) {
        this.env.setNetHeight(NET_HEIGHTS[category] || NET_HEIGHTS.men);
        this.dirty = true;
    }

    setOptions({ showPaths, showLabels }) {
        if (showPaths !== undefined) this.showPaths = showPaths;
        if (showLabels !== undefined) this.showLabels = showLabels;
        this._applyLabels();
        this._drawPaths();
    }

    setView(key, animate = true) {
        const v = VIEWS[key] || VIEWS.coach;
        const target = new THREE.Vector3(...v.target);
        // En pantallas angostas (móvil vertical) la cámara se aleja para que entre la cancha.
        const far = clamp(1.3 / this.camera.aspect, 1, 2.2);
        const pos = new THREE.Vector3(...v.pos).sub(target).multiplyScalar(far).add(target);
        if (!animate) {
            this.camera.position.copy(pos);
            this.controls.target.copy(target);
            this.controls.update();
            this.dirty = true;
            return;
        }
        this.camAnim = {
            start: performance.now(), dur: 650,
            fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), pos, target,
        };
    }

    // Reproduce una secuencia de pasos (cada paso = lista de ítems). En cada paso los jugadores
    // van a su destino y el balón recorre su parábola; entre pasos se funden las posiciones.
    // `onEnd` se llama al terminar o al interrumpirse (p. ej. si se edita la escena).
    play(steps, firstIndex = 0, onEnd) {
        const segments = [];
        steps.forEach((items, i) => {
            const k = firstIndex + i;
            segments.push({ kind: 'move', k, items, dur: items.some(it => it.to) ? PLAY_MS : STILL_MS });
            const next = steps[i + 1];
            if (next) {
                const from = new Map(items.map(it => [it.id, endState(it)]));
                segments.push({ kind: 'blend', k: k + 1, items: next, from, dur: BLEND_MS });
            }
        });
        if (steps.length === 1 && !steps[0].some(it => it.to)) return false;
        for (const items of steps) for (const it of items) this._ensure(it);
        this._stopAnim();
        this.paths.visible = false;
        this.anim = { start: performance.now(), segments, current: -1, total: segments.reduce((t, sg) => t + sg.dur, 0), onEnd };
        return true;
    }

    stop() {
        if (this.anim) this.setItems(this.items);
    }

    snapshot() {
        this.renderer.render(this.scene, this.camera);
        return new Promise(resolve => this.renderer.domElement.toBlob(resolve, 'image/png'));
    }

    dispose() {
        cancelAnimationFrame(this._raf);
        this._resize.disconnect();
        this.container.removeEventListener('pointerdown', this._down, true);
        window.removeEventListener('pointermove', this._move);
        window.removeEventListener('pointerup', this._up);
        window.removeEventListener('pointercancel', this._up);
        for (const id of [...this.objects.keys()]) this._remove(id);
        this.controls.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    // --- Internos ---
    // Crea (o recrea si cambió equipo/etiqueta) el objeto 3D de un ítem y le aplica la pose.
    _ensure(it) {
        const sig = `${it.kind}|${it.team || ''}|${it.label || ''}`;
        let entry = this.objects.get(it.id);
        if (!entry || entry.sig !== sig) {
            if (entry) this._remove(it.id);
            const obj = it.kind === 'player' ? createPlayer(it) : it.kind === 'ball' ? createBall(it) : createCone(it);
            this.scene.add(obj);
            entry = { obj, sig };
            this.objects.set(it.id, entry);
        }
        if (it.kind === 'player' && entry.obj.userData.pose !== it.pose) applyPose(entry.obj, it.pose);
        this.dirty = true;
        return entry.obj;
    }

    _stopAnim() {
        const anim = this.anim;
        this.anim = null;
        this.playingStep = null;
        this.paths.visible = true;
        if (!anim) return;
        this.onPlayStep?.(null);
        anim.onEnd?.();
    }

    // Prepara un segmento de la reproducción: solo se ven los ítems de ese paso, con su pose.
    _enterSegment(sg) {
        const ids = new Set(sg.items.map(it => it.id));
        for (const [id, { obj }] of this.objects) obj.visible = ids.has(id);
        for (const it of sg.items) this._ensure(it);
        this.playingStep = sg.k;
        this.onPlayStep?.(sg.k);
    }

    _remove(id) {
        const entry = this.objects.get(id);
        if (!entry) return;
        entry.obj.userData.label?.material.map?.dispose();
        entry.obj.userData.label?.material.dispose();
        entry.obj.getObjectByName('ring')?.material.dispose();
        this.scene.remove(entry.obj);
        this.objects.delete(id);
        this.dirty = true;
    }

    _fit() {
        const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.dirty = true;
    }

    _place(it, x = it.x, z = it.z, y = it.y) {
        const entry = this.objects.get(it.id);
        if (!entry) return;
        entry.obj.position.set(x, 0, z);
        if (it.kind === 'player') entry.obj.rotation.y = ((it.rot ?? 90) * Math.PI) / 180;
        if (it.kind === 'ball') setBallHeight(entry.obj, y ?? BALL_GROUND);
        this.dirty = true;
    }

    _placeAll() {
        for (const it of this.items) this._place(it);
    }

    _applySelection() {
        for (const [id, { obj }] of this.objects) setSelected(obj, id === this.selectedId);
        this.dirty = true;
    }

    _applyLabels() {
        for (const { obj } of this.objects.values()) if (obj.userData.label) obj.userData.label.visible = this.showLabels;
        this.dirty = true;
    }

    // Rutas: flecha discontinua en la arena para jugadores, parábola para el balón.
    _drawPaths(override) {
        for (const child of [...this.paths.children]) {
            this.paths.remove(child);
            if (child.geometry !== unitCylinder) child.geometry?.dispose();
            if (child.material !== arcMat) child.material?.dispose();
        }
        this.dirty = true;
        if (!this.showPaths) return;
        for (const base of this.items) {
            const it = override?.id === base.id ? override : base;
            if (!it.to) continue;
            if (it.kind === 'player') this._drawRun(it);
            else if (it.kind === 'ball') this._drawArc(it);
        }
    }

    _drawRun(it) {
        const color = TEAM_COLORS[it.team] || TEAM_COLORS.A;
        const target = createTarget(color);
        target.position.x = it.to.x;
        target.position.z = it.to.z;
        target.userData = { itemId: it.id, part: 'to' };
        this.paths.add(target);

        const dx = it.to.x - it.x, dz = it.to.z - it.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.9) return;
        const ux = dx / len, uz = dz / len, px = -uz, pz = ux;
        const verts = [];
        const quad = (s0, s1, w0, w1) => {
            const a = [it.x + ux * s0 + px * w0, it.z + uz * s0 + pz * w0];
            const b = [it.x + ux * s0 - px * w0, it.z + uz * s0 - pz * w0];
            const c = [it.x + ux * s1 + px * w1, it.z + uz * s1 + pz * w1];
            const d = [it.x + ux * s1 - px * w1, it.z + uz * s1 - pz * w1];
            verts.push(...a, ...b, ...c, ...b, ...d, ...c);
        };
        const end = len - 0.5; // la punta llega al borde del disco de destino
        for (let s = 0.5; s < end - 0.35; s += 0.38) quad(s, Math.min(s + 0.22, end - 0.35), 0.045, 0.045);
        quad(end - 0.35, end, 0.16, 0.001); // punta de flecha
        const pos = new Float32Array(verts.length / 2 * 3);
        for (let i = 0; i < verts.length / 2; i++) {
            pos[i * 3] = verts[i * 2];
            pos[i * 3 + 1] = 0.03;
            pos[i * 3 + 2] = verts[i * 2 + 1];
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
        m.renderOrder = 3;
        this.paths.add(m);
    }

    _drawArc(it) {
        const N = 36;
        const pts = Array.from({ length: N + 1 }, (_, i) => arcPoint(it, i / N));
        for (let i = 0; i < N; i += 2) {
            const a = pts[i], b = pts[i + 1];
            const dir = b.clone().sub(a);
            const seg = new THREE.Mesh(unitCylinder, arcMat);
            seg.position.copy(a);
            seg.scale.set(0.035, dir.length(), 0.035);
            seg.quaternion.setFromUnitVectors(UP, dir.normalize());
            this.paths.add(seg);
        }
        // Destino: balón fantasma + marca en la arena (arrastrable)
        const end = pts[N];
        const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12),
            new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.45 }));
        ghost.position.copy(end);
        ghost.userData = { itemId: it.id, part: 'to' };
        this.paths.add(ghost);
        const mark = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9, depthWrite: false }));
        mark.position.set(end.x, 0.03, end.z);
        mark.userData = { itemId: it.id, part: 'to' };
        this.paths.add(mark);
    }

    _tick(now) {
        if (this.controls.update()) this.dirty = true;

        if (this.camAnim) {
            const a = this.camAnim;
            const t = Math.min(1, (now - a.start) / a.dur), k = ease(t);
            this.camera.position.lerpVectors(a.fromPos, a.pos, k);
            this.controls.target.lerpVectors(a.fromTarget, a.target, k);
            this.camera.lookAt(this.controls.target);
            if (t >= 1) { this.camAnim = null; this.controls.update(); }
            this.dirty = true;
        }

        if (this.anim) this._animate(now);

        // Mientras se graba video se renderiza cada cuadro y se entrega al grabador.
        if (this.dirty || this.frameHook) {
            this.dirty = false;
            this.renderer.render(this.scene, this.camera);
            this.frameHook?.();
        }
    }

    _animate(now) {
        const a = this.anim;
        const elapsed = now - a.start;
        if (elapsed > a.total + HOLD_MS) { this.setItems(this.items); return; }
        let idx = 0, acc = 0;
        while (idx < a.segments.length - 1 && elapsed > acc + a.segments[idx].dur) acc += a.segments[idx++].dur;
        const sg = a.segments[idx];
        if (idx !== a.current) { a.current = idx; this._enterSegment(sg); }
        const t = Math.min(1, (elapsed - acc) / sg.dur), k = ease(t);

        for (const it of sg.items) {
            if (sg.kind === 'blend') {
                const f = sg.from.get(it.id) || it;
                this._place(it, lerp(f.x, it.x, k), lerp(f.z, it.z, k), lerp(f.y ?? BALL_GROUND, it.y ?? BALL_GROUND, k));
            } else if (!it.to) {
                this._place(it);
            } else if (it.kind === 'ball') {
                const p = arcPoint(it, t);
                this._place(it, p.x, p.z, p.y);
            } else {
                this._place(it, lerp(it.x, it.to.x, k), lerp(it.z, it.to.z, k));
            }
        }
        this.dirty = true;
    }

    _ndc(e) {
        const r = this.renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }

    _ground(e) {
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        const p = new THREE.Vector3();
        return this.raycaster.ray.intersectPlane(this.groundPlane, p) ? p : null;
    }

    _pick(e) {
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        const targets = [...this.paths.children.filter(c => c.userData.part)];
        for (const { obj } of this.objects.values()) obj.traverse(c => { if (c.isMesh) targets.push(c); });
        const hit = this.raycaster.intersectObjects(targets, false)[0];
        if (!hit) return null;
        let o = hit.object;
        while (o && !o.userData.itemId) o = o.parent;
        return o ? { id: o.userData.itemId, part: o.userData.part || 'body' } : null;
    }

    _onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        this.press = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
        window.addEventListener('pointerup', this._up);
        window.addEventListener('pointercancel', this._up);
        if (this.anim) return;

        const hit = this._pick(e);
        if (!hit) return;
        const it = this.items.find(i => i.id === hit.id);
        const g = this._ground(e);
        if (!it || !g) return;
        const ref = hit.part === 'to' ? it.to : it;
        this.drag = { id: it.id, part: hit.part, dx: g.x - ref.x, dz: g.z - ref.z, moved: false, x: ref.x, z: ref.z };
        this.controls.enabled = false; // que la cámara no gire mientras se arrastra
        e.stopPropagation();
        window.addEventListener('pointermove', this._move);
        if (hit.part === 'body') this.onSelect(it.id);
    }

    _onPointerMove(e) {
        const d = this.drag;
        if (!d) return;
        const g = this._ground(e);
        if (!g) return;
        d.x = r2(clamp(g.x - d.dx, -LIMIT_X, LIMIT_X));
        d.z = r2(clamp(g.z - d.dz, -LIMIT_Z, LIMIT_Z));
        d.moved = true;
        const it = this.items.find(i => i.id === d.id);
        if (!it) return;
        const live = d.part === 'to' ? { ...it, to: { ...it.to, x: d.x, z: d.z } } : { ...it, x: d.x, z: d.z };
        if (d.part === 'body') this._place(live);
        this._drawPaths(live);
    }

    _onPointerUp(e) {
        window.removeEventListener('pointermove', this._move);
        window.removeEventListener('pointerup', this._up);
        window.removeEventListener('pointercancel', this._up);
        const d = this.drag;
        this.drag = null;
        this.controls.enabled = true;
        const press = this.press;
        this.press = null;

        if (d) {
            if (!d.moved) return;
            const it = this.items.find(i => i.id === d.id);
            if (!it) return;
            this.onChange(d.id, d.part === 'to' ? { to: { ...it.to, x: d.x, z: d.z } } : { x: d.x, z: d.z });
            return;
        }
        // Toque en vacío sin girar la cámara: deselecciona.
        if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) this.onSelect(null);
    }
}
