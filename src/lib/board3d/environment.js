import * as THREE from 'three';

// Escenario fijo de la pizarra 3D: arena, líneas, red, mar y un poco de paisaje.
// Medidas reglamentarias de vóley playa: cancha 16 x 8 m, red de 8,5 m.

export const COURT_L = 16, COURT_W = 8;
export const NET_HEIGHTS = { men: 2.43, women: 2.24 };
const POST_Z = 4.85;

function sandTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8cf9c';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
        const shade = Math.random() < 0.5 ? 'rgba(160, 120, 70, 0.10)' : 'rgba(255, 245, 220, 0.18)';
        ctx.fillStyle = shade;
        const r = Math.random() * 2.2 + 0.4;
        ctx.beginPath();
        ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 10);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

function netTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.9)';
    ctx.lineWidth = 1.5;
    const step = 512 / 85; // malla de 10 cm en 8,5 m
    for (let x = 0; x <= 512; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 64); ctx.stroke(); }
    for (let y = 0; y <= 64; y += 64 / 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function antennaTexture() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 64;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 18; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#dc2626';
        ctx.fillRect(0, (i * 64) / 18, 4, 64 / 18 + 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#8b6b47' });
    const leafMat = new THREE.MeshLambertMaterial({ color: '#2f8f3a', side: THREE.DoubleSide });
    let px = 0, py = 0;
    for (let i = 0; i < 6; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.015, 0.2 - i * 0.015, 1.2, 7), trunkMat);
        px += 0.12 * i * 0.3;
        py += 1.1;
        seg.position.set(px, py - 0.5, 0);
        seg.rotation.z = -0.06 * i;
        g.add(seg);
    }
    for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3, 4, 1, true), leafMat);
        leaf.geometry.translate(0, 1.5, 0);
        leaf.position.set(px, py, 0);
        leaf.rotation.set(1.15, (i / 7) * Math.PI * 2, 0, 'YXZ');
        leaf.scale.set(1, 1, 0.25);
        g.add(leaf);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = Math.random() * Math.PI;
    return g;
}

function rock(x, z, s, color = '#8a9a8b') {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color, flatShading: true }));
    m.position.set(x, s * 0.6, z);
    m.scale.set(s * 0.9, s * 1.6, s);
    m.rotation.y = Math.random() * Math.PI;
    return m;
}

export function buildEnvironment(scene) {
    scene.background = new THREE.Color('#9fd6f2');
    scene.fog = new THREE.Fog('#bfe3f5', 45, 140);

    scene.add(new THREE.HemisphereLight('#ffffff', '#c9a56b', 1.6));
    const sun = new THREE.DirectionalLight('#fff4dd', 2.2);
    sun.position.set(-8, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // Arena
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), new THREE.MeshLambertMaterial({ map: sandTexture() }));
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    sand.name = 'sand';
    scene.add(sand);

    // Mar y horizonte (detrás de la red, del lado -z)
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 160), new THREE.MeshLambertMaterial({ color: '#2ba6c6' }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.02, -25 - 80);
    scene.add(sea);
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(400, 2.5), new THREE.MeshLambertMaterial({ color: '#d6efe9' }));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(0, -0.01, -25);
    scene.add(shore);

    [[-40, -60, 6], [-18, -75, 9], [12, -70, 7], [35, -58, 5], [55, -80, 10]].forEach(([x, z, s]) => scene.add(rock(x, z, s)));
    [[-20, -14, 1.1], [-24, 6, 1], [21, -15, 1.2], [25, 9, 0.95], [-13, -19, 0.9]].forEach(([x, z, s]) => scene.add(palm(x, z, s)));

    // Líneas de la cancha (cinta azul de 5 cm)
    const lineMat = new THREE.MeshBasicMaterial({ color: '#1d4ed8' });
    const tape = (w, d, x, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), lineMat);
        m.position.set(x, 0.006, z);
        m.receiveShadow = true;
        scene.add(m);
    };
    tape(COURT_L + 0.05, 0.05, 0, -COURT_W / 2);
    tape(COURT_L + 0.05, 0.05, 0, COURT_W / 2);
    tape(0.05, COURT_W, -COURT_L / 2, 0);
    tape(0.05, COURT_W, COURT_L / 2, 0);

    // Red: postes, malla, bandas y antenas (la altura cambia con la categoría)
    const net = new THREE.Group();
    net.name = 'net';
    const postMat = new THREE.MeshLambertMaterial({ color: '#1f2937' });
    const posts = [];
    for (const z of [-POST_Z, POST_Z]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 12), postMat);
        post.castShadow = true;
        post.position.z = z;
        scene.add(post);
        posts.push(post);
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12), new THREE.MeshLambertMaterial({ color: '#1e3a8a' }));
        pad.position.set(0, 0.8, z);
        pad.castShadow = true;
        scene.add(pad);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 1),
        new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.y = -0.5;
    net.add(mesh);
    const band = (y, h) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 8.5), new THREE.MeshLambertMaterial({ color: '#f8fafc' }));
        b.position.y = y;
        b.castShadow = true;
        net.add(b);
    };
    band(-0.035, 0.07);
    band(-0.98, 0.04);
    const antMat = new THREE.MeshLambertMaterial({ map: antennaTexture() });
    for (const z of [-COURT_W / 2, COURT_W / 2]) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.8, 8), antMat);
        ant.position.set(0, -0.1, z);
        net.add(ant);
    }
    scene.add(net);

    return {
        setNetHeight(h) {
            net.position.y = h;
            for (const p of posts) {
                p.scale.y = h + 0.15;
                p.position.y = (h + 0.15) / 2;
            }
        },
    };
}
