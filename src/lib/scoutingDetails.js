// Detalles de scouting por fundamento (dimensiones y opciones seleccionables).
//
// Cada acción registrada puede llevar un objeto `detail` (p. ej. { tipoSaque: 'Flotante' })
// que se guarda dentro del JSONB `actions` en Supabase — sin migración de esquema — y se
// refleja en la sección "Detalle de Scouting" de las Tendencias / PDF.
//
// La clave de cada dimensión (`key`) es estable y se usa como campo en `action.detail`.
// Las etiquetas (`label` / `options`) son texto visible y pueden ajustarse sin migrar datos.
//
// El nombre del fundamento es el "base skill": para el ataque, `Ataque Contundente`,
// `Ataque Coloque` y `Ataque 2 Toques` comparten los detalles definidos en `Ataque`.
export const SKILL_DETAILS = {
    'Saque': [
        { key: 'tipoSaque', label: 'Tipo de servicio', options: ['Flotante', 'Potencia'] },
        { key: 'profundidad', label: 'Profundidad', options: ['Normal', 'Corto'] },
    ],
    'Recepción': [
        { key: 'zona', label: 'Zona de recepción', options: ['Corta', 'Lado derecho', 'Fondo', 'Lado izquierdo'] },
    ],
    'Armado': [
        { key: 'tipoArmado', label: 'Tipo de armado', options: ['Atrás', 'Tendido', 'Cerca del jugador'] },
    ],
    'Ataque': [
        { key: 'direccion', label: 'Dirección', options: ['Delante del jugador', 'Por detrás'] },
    ],
    'Defensa': [
        { key: 'tipoDefensa', label: 'Tipo de defensa', options: ['De ataque contundente', 'De coloque'] },
    ],
};

// Devuelve el "base skill" de una acción (agrupa los tipos de ataque bajo "Ataque").
export function baseSkillOf(skill) {
    if (!skill) return skill;
    return skill.startsWith('Ataque') ? 'Ataque' : skill;
}
