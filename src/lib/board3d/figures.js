import * as THREE from 'three';
import { POSES, DEFAULT_POSE } from './poses';

// Figuras de la pizarra 3D: jugador articulado (low-poly), balón y cono.
// Todo se arma con primitivas para no depender de modelos externos.

export const TEAM_COLORS = { A: '#2563eb', B: '#dc2626', C: '#16a34a' };
export const SELECT_COLOR = '#f97316';

const THIGH = 0.45, SHIN = 0.45, FOOT = 0.06;
const DEG = Math.PI / 180;

// Geometrías compartidas entre todos los jugadores (se crean una sola vez).
let G = null;
function geos() {
    if (G) return G;
    const limb = (rTop, rBottom, len) => {
        const g = new THREE.CylinderGeometry(rTop, rBottom, len, 10);
        g.translate(0, -len / 2, 0); // cuelga desde la articulación
        return g;
    };
    G = {
        torso: new THREE.CylinderGeometry(0.2, 0.16, 0.56, 12).translate(0, 0.3, 0),
        shorts: new THREE.CylinderGeometry(0.17, 0.19, 0.2, 12).translate(0, -0.04, 0),
        neck: new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8).translate(0, 0.62, 0),
        head: new THREE.SphereGeometry(0.115, 16, 12).translate(0, 0.76, 0),
        cap: new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2).translate(0, 0.77, 0),
        upperArm: limb(0.055, 0.045, 0.3),
        foreArm: limb(0.045, 0.035, 0.27),
        hand: new THREE.SphereGeometry(0.045, 8, 6).translate(0, -0.3, 0),
        thigh: limb(0.08, 0.06, THIGH),
        shin: limb(0.055, 0.04, SHIN),
        foot: new THREE.BoxGeometry(0.1, 0.06, 0.24).translate(0, -SHIN - 0.02, 0.06),
        ring: new THREE.RingGeometry(0.36, 0.44, 40).rotateX(-Math.PI / 2),
        disc: new THREE.CircleGeometry(0.44, 40).rotateX(-Math.PI / 2),
        ball: new THREE.SphereGeometry(0.11, 24, 16),
        cone: new THREE.ConeGeometry(0.13, 0.32, 16).translate(0, 0.16, 0),
        coneBase: new THREE.BoxGeometry(0.3, 0.02, 0.3).translate(0, 0.01, 0),
    };
    return G;
}

const matCache = new Map();
function mat(color, opts = {}) {
    const key = `${color}|${JSON.stringify(opts)}`;
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
    return matCache.get(key);
}
const SKIN = '#c98b62', SHORTS = '#111827', HAIR = '#3b2a1d';

function mesh(geo, material, shadow = true) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = shadow;
    return m;
}

// Etiqueta flotante (número o iniciales) como sprite: siempre mira a la cámara.
export function makeLabel(text, color) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 80;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(17, 24, 39, 0.82)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(4, 4, 120, 72, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${text.length > 2 ? 38 : 46}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 4), 64, 42);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sprite.scale.set(0.5, 0.31, 1);
    sprite.renderOrder = 10;
    return sprite;
}

function selectionRing(color) {
    const ring = new THREE.Mesh(geos().ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.position.y = 0.02;
    ring.renderOrder = 2;
    ring.name = 'ring';
    return ring;
}

export function setSelected(obj, selected) {
    const ring = obj.getObjectByName('ring');
    if (!ring) return;
    ring.material.color.set(selected ? SELECT_COLOR : obj.userData.baseColor);
    ring.material.opacity = selected ? 1 : 0.55;
    ring.scale.setScalar(selected ? 1.15 : 1);
}

// --- Jugador ---
export function createPlayer(item) {
    const g = geos();
    const color = TEAM_COLORS[item.team] || TEAM_COLORS.A;
    const jersey = mat(color), skin = mat(SKIN), shorts = mat(SHORTS);

    const root = new THREE.Group();
    const body = new THREE.Group(); // a la altura de la cadera
    root.add(body);

    const joint = (parent, x, y, z) => {
        const j = new THREE.Group();
        j.position.set(x, y, z);
        parent.add(j);
        return j;
    };

    body.add(mesh(g.shorts, shorts));
    const spine = joint(body, 0, 0, 0);
    spine.add(mesh(g.torso, jersey), mesh(g.neck, skin), mesh(g.head, skin), mesh(g.cap, mat(item.team === 'C' ? '#f8fafc' : HAIR)));

    const arm = (side) => {
        const shoulder = joint(spine, 0.25 * side, 0.52, 0);
        shoulder.add(mesh(g.upperArm, skin));
        const elbow = joint(shoulder, 0, -0.3, 0);
        elbow.add(mesh(g.foreArm, skin), mesh(g.hand, skin));
        return [shoulder, elbow];
    };
    const leg = (side) => {
        const hip = joint(body, 0.1 * side, -0.05, 0);
        hip.add(mesh(g.thigh, skin));
        const knee = joint(hip, 0, -THIGH, 0);
        knee.add(mesh(g.shin, skin), mesh(g.foot, mat('#e5e7eb')));
        return [hip, knee];
    };
    const [lShoulder, lElbow] = arm(1);
    const [rShoulder, rElbow] = arm(-1);
    const [lHip, lKnee] = leg(1);
    const [rHip, rKnee] = leg(-1);

    const label = makeLabel(item.label || '', color);
    label.name = 'label';
    root.add(label);
    root.add(selectionRing(color));

    root.userData = {
        itemId: item.id, baseColor: color, body, label,
        joints: { spine, lShoulder, lElbow, rShoulder, rElbow, lHip, lKnee, rHip, rKnee },
    };
    applyPose(root, item.pose);
    return root;
}

// Altura de la cadera para que los pies queden apoyados en la arena según la flexión de las piernas.
function legDrop(hip, knee) {
    const a = hip[0] * DEG, b = knee[0] * DEG;
    return (THIGH * Math.cos(a) + SHIN * Math.cos(a + b)) * Math.cos(hip[2] * DEG);
}

export function applyPose(player, poseKey) {
    const pose = POSES[poseKey] || POSES[DEFAULT_POSE];
    const { joints, body, label } = player.userData;
    for (const [name, j] of Object.entries(joints)) {
        const r = pose[name] || [0, 0, 0];
        j.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
    }
    // El jugador tiene la cadera 5 cm por debajo del centro del cuerpo (ver leg()).
    const hipY = pose.rootY ?? Math.max(legDrop(pose.lHip, pose.lKnee), legDrop(pose.rHip, pose.rKnee)) + FOOT + 0.05;
    body.position.y = hipY + (pose.jump || 0);
    body.rotation.x = (pose.tilt || 0) * DEG;
    label.position.y = body.position.y + (pose.tilt ? 0.6 : 1.25);
    player.userData.pose = poseKey;
}

// --- Balón ---
let ballTexture = null;
function ballTex() {
    if (ballTexture) return ballTexture;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    const bands = ['#facc15', '#1d4ed8', '#ffffff', '#facc15', '#1d4ed8', '#ffffff'];
    bands.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(i * 256 / 6, 0);
        ctx.bezierCurveTo(i * 256 / 6 + 40, 40, i * 256 / 6 - 10, 90, i * 256 / 6 + 30, 128);
        ctx.lineTo((i + 1) * 256 / 6 + 30, 128);
        ctx.bezierCurveTo((i + 1) * 256 / 6 - 10, 90, (i + 1) * 256 / 6 + 40, 40, (i + 1) * 256 / 6, 0);
        ctx.fill();
    });
    ballTexture = new THREE.CanvasTexture(c);
    ballTexture.colorSpace = THREE.SRGBColorSpace;
    return ballTexture;
}

export function createBall(item) {
    const root = new THREE.Group();
    const ball = mesh(geos().ball, new THREE.MeshLambertMaterial({ map: ballTex() }));
    ball.name = 'ball';
    root.add(ball);
    // Poste fino que une el balón con su sombra en la arena: ayuda a leer la altura.
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6).translate(0, 0.5, 0),
        new THREE.MeshBasicMaterial({ color: '#111827', transparent: true, opacity: 0.35 }));
    stem.name = 'stem';
    root.add(stem);
    const ring = selectionRing('#facc15');
    ring.scale.setScalar(0.45);
    root.add(ring);
    root.userData = { itemId: item.id, baseColor: '#facc15', ball, stem };
    return root;
}

export function setBallHeight(obj, y) {
    obj.userData.ball.position.y = y;
    obj.userData.stem.scale.y = Math.max(0.001, y - 0.11);
    obj.userData.stem.visible = y > 0.3;
}

// --- Cono ---
export function createCone(item) {
    const root = new THREE.Group();
    root.add(mesh(geos().cone, mat('#f97316')), mesh(geos().coneBase, mat('#f97316')));
    const ring = selectionRing('#f97316');
    ring.scale.setScalar(0.6);
    ring.material.opacity = 0;
    root.add(ring);
    root.userData = { itemId: item.id, baseColor: '#f97316' };
    return root;
}

// Marcador del destino de un jugador (disco translúcido arrastrable).
export function createTarget(color) {
    const disc = new THREE.Mesh(geos().disc, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
    disc.position.y = 0.025;
    disc.renderOrder = 3;
    return disc;
}
