// Biblioteca de ejercicios/situaciones para la pizarra 3D.
// Coordenadas en metros con el centro de la red en el origen:
//   x = largo de la cancha (-8 fondo del equipo A … +8 fondo del equipo B)
//   z = ancho (-4 … +4) · y = altura (solo balón)
//   rot = hacia dónde mira el jugador en grados (90 = mira hacia B, -90 = mira hacia A)
// Los jugadores se indican con equipo + slot (0/1) y reciben el nombre real al cargarse.
// Para añadir un ejercicio, agrega un objeto a DRILLS: `items` si es de un solo paso o
// `steps: [{ items }, …]` si es una secuencia. En las secuencias, `ref` identifica al mismo
// jugador/balón en todos los pasos para animar el paso de uno a otro.
// (Los entrenadores también pueden crear los suyos desde la app: "Mis ejercicios".)

const A = (slot, x, z, pose, extra = {}) => ({ kind: 'player', team: 'A', slot, x, z, rot: 90, pose, ...extra });
const B = (slot, x, z, pose, extra = {}) => ({ kind: 'player', team: 'B', slot, x, z, rot: -90, pose, ...extra });
const COACH = (x, z, pose, extra = {}) => ({ kind: 'player', team: 'C', slot: 0, x, z, rot: x < 0 ? 90 : -90, pose, ...extra });
const BALL = (x, y, z, to) => ({ kind: 'ball', x, y, z, ...(to && { to }) });
const CONE = (x, z) => ({ kind: 'cone', x, z });

export const DRILL_CATEGORIES = ['Saque y recepción', 'Side-out', 'Bloqueo y defensa', 'Ejercicios'];

export const DRILLS = [
    {
        key: 'start',
        category: 'Saque y recepción',
        name: 'Formación inicial 2 vs 2',
        notes: 'Posición base: B saca desde el fondo; A espera en recepción repartiendo la cancha en dos.',
        items: [
            A(0, -5, -2, 'ready'), A(1, -5, 2, 'ready'),
            B(0, 9, 1.5, 'serve'), B(1, 2.5, -1, 'blockReady'),
            BALL(9.15, 2.6, 1.6),
        ],
    },
    {
        key: 'reception-diagonal',
        category: 'Saque y recepción',
        name: 'Recepción de saque en diagonal',
        notes: 'Saque de B en diagonal. El receptor ataca el balón con los pies orientados hacia la zona de colocación; el compañero acompaña y se prepara para colocar.',
        items: [
            A(0, -5, -2, 'ready'), A(1, -5, 2, 'ready', { to: { x: -1.5, z: 0 } }),
            B(0, 9, 2, 'serve'), B(1, 2.5, -0.5, 'blockReady'),
            BALL(9.1, 2.6, 2.1, { x: -5, y: 0.8, z: -2, peak: 2.5 }),
        ],
    },
    {
        key: 'serve-targets',
        category: 'Saque y recepción',
        name: 'Saque a zonas (conos)',
        notes: 'El sacador apunta a los conos: líneas laterales profundas, centro (conflicto entre receptores) y corto a la red. Contar aciertos por serie.',
        items: [
            A(0, -9, 1.5, 'serve'),
            BALL(-9.1, 2.6, 1.6, { x: 6.5, y: 0.11, z: -3.2, peak: 2.8 }),
            CONE(6.5, -3.2), CONE(6.5, 3.2), CONE(4, 0), CONE(1.5, -2.5), CONE(1.5, 2.5),
        ],
    },
    {
        key: 'sideout',
        category: 'Side-out',
        name: 'Side-out: recepción → colocación → ataque',
        notes: 'A1 recibe y sale a atacar abriéndose por fuera. A2 se desplaza a la red para colocar. Pase de recepción alto, 1–1,5 m de la red y hacia el centro.',
        items: [
            A(0, -5, -2, 'ready', { to: { x: -3.2, z: -3 } }),
            A(1, -5, 2, 'run', { to: { x: -1.3, z: -0.6 } }),
            B(0, 0.7, -2, 'blockReady'), B(1, 5.5, 1.5, 'defense'),
            BALL(-5, 0.9, -2, { x: -1.3, y: 2.6, z: -0.8, peak: 3 }),
        ],
    },
    {
        key: 'sideout-full',
        category: 'Side-out',
        name: 'Side-out completo (saque → ataque)',
        notes: 'Secuencia completa en 4 pasos. 1) Saque de B. 2) A1 recibe y A2 va a la red a colocar. 3) A2 coloca mientras A1 hace la carrera. 4) A1 ataca la diagonal y A2 cubre. Usa ▶ Todo para verla seguida.',
        steps: [
            { items: [
                A(0, -5, -2, 'ready', { ref: 'a0' }), A(1, -5, 2, 'ready', { ref: 'a1' }),
                B(0, 9, 1.5, 'serve', { ref: 'b0', to: { x: 5.5, z: 1.5 } }),
                B(1, 2.5, -0.5, 'blockReady', { ref: 'b1', to: { x: 0.7, z: -2.6 } }),
                { ...BALL(9.1, 2.6, 1.6, { x: -5, y: 0.8, z: -2, peak: 2.5 }), ref: 'ball' },
            ] },
            { items: [
                A(0, -5, -2, 'forearmSet', { ref: 'a0', to: { x: -3.5, z: -3.2 } }),
                A(1, -5, 2, 'run', { ref: 'a1', to: { x: -1.3, z: -0.6 } }),
                B(0, 5.5, 1.5, 'defense', { ref: 'b0' }), B(1, 0.7, -2.6, 'blockReady', { ref: 'b1' }),
                { ...BALL(-5, 0.8, -2, { x: -1.3, y: 2.6, z: -0.6, peak: 2.5 }), ref: 'ball' },
            ] },
            { items: [
                A(0, -3.5, -3.2, 'run', { ref: 'a0', to: { x: -1.8, z: -2.8 } }),
                A(1, -1.3, -0.6, 'set', { ref: 'a1' }),
                B(0, 5.5, 1.5, 'defense', { ref: 'b0', to: { x: 5.5, z: 2.5 } }), B(1, 0.7, -2.6, 'blockReady', { ref: 'b1' }),
                { ...BALL(-1.3, 2.6, -0.6, { x: -1, y: 3.3, z: -2.6, peak: 1.3 }), ref: 'ball' },
            ] },
            { items: [
                A(0, -1.8, -2.8, 'hit', { ref: 'a0' }),
                A(1, -1.3, -0.6, 'standing', { ref: 'a1', to: { x: -3, z: -1.5 } }),
                B(0, 5.5, 2.5, 'defense', { ref: 'b0' }), B(1, 0.6, -2.7, 'block', { ref: 'b1' }),
                { ...BALL(-1, 3.3, -2.6, { x: 6.2, y: 0.11, z: 3, peak: 0.3 }), ref: 'ball' },
            ] },
        ],
    },
    {
        key: 'attack-options',
        category: 'Side-out',
        name: 'Opciones de ataque contra bloqueo',
        notes: 'Con bloqueo en línea, el atacante busca diagonal fuerte o tiro corto a la diagonal. Con bloqueo diagonal: línea o tiro alto por encima del bloqueo.',
        items: [
            A(0, -1.6, -2.8, 'attack'), A(1, -1.2, -0.5, 'set'),
            B(0, 0.6, -2.8, 'block'), B(1, 5.5, 2, 'defense'),
            BALL(-1, 3.3, -2.7, { x: 6.5, y: 0.11, z: 2.8, peak: 0.4 }),
        ],
    },
    {
        key: 'block-line',
        category: 'Bloqueo y defensa',
        name: 'Bloqueo en línea + defensa diagonal',
        notes: 'El bloqueador cierra la línea; el defensor cubre la diagonal y se desplaza al ver el brazo del atacante. Comunicar la señal antes del saque.',
        items: [
            B(0, 1.5, -2.8, 'attack'), B(1, 1.3, -0.4, 'set'),
            A(0, -0.6, -2.8, 'block'), A(1, -5, 1.5, 'defense', { to: { x: -5.5, z: 2.6 } }),
            BALL(1, 3.3, -2.7, { x: -5.6, y: 0.7, z: 2.8, peak: 0.3 }),
        ],
    },
    {
        key: 'pull-off',
        category: 'Bloqueo y defensa',
        name: 'Finta de bloqueo (salir de la red)',
        notes: 'El bloqueador muestra el bloqueo y sale de la red hacia atrás para defender el tiro corto. El compañero cubre la zona profunda.',
        items: [
            B(0, 1.5, -2.5, 'attack'), B(1, 1.2, 0, 'set'),
            A(0, -0.6, -2.4, 'blockReady', { to: { x: -3.2, z: -2 } }),
            A(1, -5.5, 1, 'defense', { to: { x: -6, z: -1 } }),
            BALL(1.1, 3.2, -2.4, { x: -3.4, y: 0.6, z: -1.8, peak: 1.2 }),
        ],
    },
    {
        key: 'coach-defense',
        category: 'Ejercicios',
        name: 'Defensa con entrenador',
        notes: 'El entrenador ataca desde la red (sobre cajón o de pie). El defensor parte de la posición base, lee el brazo y defiende hacia el cono objetivo. Series de 8–10 balones.',
        items: [
            COACH(-1.2, -2.5, 'hit'),
            A(0, -5.5, 1, 'defense'),
            BALL(-1.4, 2.8, -2.4, { x: -5.6, y: 0.7, z: 1.2, peak: 0.3 }),
            CONE(-6, -1), CONE(-6, 3), CONE(-2, 0.5),
        ],
    },
    {
        key: 'setting-pairs',
        category: 'Ejercicios',
        name: 'Colocación en parejas',
        notes: 'Pase de antebrazos al compañero, que coloca de manos hacia la antena. Rotar los roles cada 10 repeticiones.',
        items: [
            A(0, -5, 0, 'forearmSet'), A(1, -1.3, -0.5, 'set'),
            BALL(-5, 0.9, 0, { x: -1.3, y: 2.6, z: -0.5, peak: 2.5 }),
            CONE(-1, -3.5),
        ],
    },
];
