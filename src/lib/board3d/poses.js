// Poses de los jugadores de la pizarra 3D.
// Para añadir una pose nueva basta con agregar una entrada: el motor y el panel la toman solos.
//
// Ángulos en grados, [x, y, z] por articulación, con el jugador mirando hacia +Z:
//   hombro/cadera x negativo = levantar el brazo/muslo hacia adelante (-180 = brazo arriba)
//   hombro z = abrir el brazo hacia el costado (izquierdo +, derecho -)
//   codo x negativo = flexionar el antebrazo · rodilla x positivo = flexionar la pierna
//   spine x positivo = inclinar el tronco hacia adelante
//   jump = metros en el aire · tilt/rootY = cuerpo inclinado entero (plancha)

export const POSES = {
    standing: {
        label: 'De pie',
        spine: [0, 0, 0],
        lShoulder: [0, 0, 8], rShoulder: [0, 0, -8], lElbow: [-10, 0, 0], rElbow: [-10, 0, 0],
        lHip: [0, 0, 3], rHip: [0, 0, -3], lKnee: [0, 0, 0], rKnee: [0, 0, 0],
    },
    ready: {
        label: 'Recepción',
        spine: [22, 0, 0],
        lShoulder: [-55, 0, -12], rShoulder: [-55, 0, 12], lElbow: [0, 0, 0], rElbow: [0, 0, 0],
        lHip: [-45, 0, 10], rHip: [-45, 0, -10], lKnee: [70, 0, 0], rKnee: [70, 0, 0],
    },
    set: {
        label: 'Colocación',
        spine: [-5, 0, 0],
        lShoulder: [-160, 0, 18], rShoulder: [-160, 0, -18], lElbow: [-60, 0, 0], rElbow: [-60, 0, 0],
        lHip: [-15, 0, 4], rHip: [-15, 0, -4], lKnee: [25, 0, 0], rKnee: [25, 0, 0],
    },
    jumpSet: {
        label: 'Coloc. en salto',
        jump: 0.4,
        spine: [-5, 0, 0],
        lShoulder: [-165, 0, 15], rShoulder: [-165, 0, -15], lElbow: [-55, 0, 0], rElbow: [-55, 0, 0],
        lHip: [-10, 0, 3], rHip: [-10, 0, -3], lKnee: [35, 0, 0], rKnee: [25, 0, 0],
    },
    forearmSet: {
        label: 'Coloc. antebrazos',
        spine: [25, 0, 0],
        lShoulder: [-70, 0, -12], rShoulder: [-70, 0, 12], lElbow: [0, 0, 0], rElbow: [0, 0, 0],
        lHip: [-35, 0, 8], rHip: [-35, 0, -8], lKnee: [55, 0, 0], rKnee: [55, 0, 0],
    },
    attack: {
        label: 'Ataque',
        jump: 0.75,
        spine: [-12, 0, 0],
        lShoulder: [-150, 0, 12], rShoulder: [-165, 0, -15], lElbow: [-10, 0, 0], rElbow: [-100, 0, 0],
        lHip: [-25, 0, 4], rHip: [-5, 0, -4], lKnee: [55, 0, 0], rKnee: [35, 0, 0],
    },
    hit: {
        label: 'Remate (contacto)',
        jump: 0.75,
        spine: [15, 0, 0],
        lShoulder: [-35, 0, 12], rShoulder: [-175, 0, -6], lElbow: [-30, 0, 0], rElbow: [0, 0, 0],
        lHip: [-30, 0, 4], rHip: [-10, 0, -4], lKnee: [45, 0, 0], rKnee: [30, 0, 0],
    },
    shot: {
        label: 'Tiro / coloque',
        jump: 0.6,
        spine: [5, 0, 0],
        lShoulder: [-120, 0, 15], rShoulder: [-172, 0, -5], lElbow: [-20, 0, 0], rElbow: [-15, 0, 0],
        lHip: [-20, 0, 4], rHip: [-10, 0, -4], lKnee: [40, 0, 0], rKnee: [30, 0, 0],
    },
    block: {
        label: 'Bloqueo',
        jump: 0.6,
        spine: [6, 0, 0],
        lShoulder: [-172, 0, 6], rShoulder: [-172, 0, -6], lElbow: [0, 0, 0], rElbow: [0, 0, 0],
        lHip: [-10, 0, 4], rHip: [-10, 0, -4], lKnee: [22, 0, 0], rKnee: [22, 0, 0],
    },
    blockReady: {
        label: 'Listo p/ bloquear',
        spine: [5, 0, 0],
        lShoulder: [-120, 0, 15], rShoulder: [-120, 0, -15], lElbow: [-70, 0, 0], rElbow: [-70, 0, 0],
        lHip: [-25, 0, 6], rHip: [-25, 0, -6], lKnee: [40, 0, 0], rKnee: [40, 0, 0],
    },
    defense: {
        label: 'Defensa',
        spine: [35, 0, 0],
        lShoulder: [-40, 0, 25], rShoulder: [-40, 0, -25], lElbow: [-30, 0, 0], rElbow: [-30, 0, 0],
        lHip: [-60, 0, 22], rHip: [-60, 0, -22], lKnee: [85, 0, 0], rKnee: [85, 0, 0],
    },
    serve: {
        label: 'Saque',
        spine: [-5, 0, 0],
        lShoulder: [-160, 0, 5], rShoulder: [-150, 0, -35], lElbow: [0, 0, 0], rElbow: [-100, 0, 0],
        lHip: [-10, 0, 3], rHip: [10, 0, -3], lKnee: [10, 0, 0], rKnee: [15, 0, 0],
    },
    jumpServe: {
        label: 'Saque en salto',
        jump: 0.6,
        spine: [-15, 0, 0],
        lShoulder: [-150, 0, 10], rShoulder: [-170, 0, -15], lElbow: [-10, 0, 0], rElbow: [-110, 0, 0],
        lHip: [-30, 0, 4], rHip: [-5, 0, -4], lKnee: [60, 0, 0], rKnee: [40, 0, 0],
    },
    run: {
        label: 'Desplazamiento',
        spine: [15, 0, 0],
        lShoulder: [40, 0, 8], rShoulder: [-50, 0, -8], lElbow: [-80, 0, 0], rElbow: [-80, 0, 0],
        lHip: [-50, 0, 3], rHip: [25, 0, -3], lKnee: [60, 0, 0], rKnee: [45, 0, 0],
    },
    dive: {
        label: 'Plancha',
        tilt: 72, rootY: 0.42,
        spine: [5, 0, 0],
        lShoulder: [-170, 0, 12], rShoulder: [-170, 0, -12], lElbow: [0, 0, 0], rElbow: [0, 0, 0],
        lHip: [15, 0, 6], rHip: [5, 0, -6], lKnee: [25, 0, 0], rKnee: [40, 0, 0],
    },
    celebrate: {
        label: 'Celebración',
        spine: [-5, 0, 0],
        lShoulder: [-150, 0, 40], rShoulder: [-150, 0, -40], lElbow: [-15, 0, 0], rElbow: [-15, 0, 0],
        lHip: [0, 0, 6], rHip: [0, 0, -6], lKnee: [0, 0, 0], rKnee: [0, 0, 0],
    },
};

export const POSE_KEYS = Object.keys(POSES);
export const DEFAULT_POSE = 'ready';
