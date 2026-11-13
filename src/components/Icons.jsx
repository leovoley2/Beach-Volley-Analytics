// Iconos de línea (estilo 1.75px) para la interfaz. Heredan el color del texto.
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const Svg = ({ size = 16, children, ...rest }) => <svg {...base} width={size} height={size} {...rest}>{children}</svg>;

export const IconSearch   = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IconPlus     = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconEdit     = (p) => <Svg {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></Svg>;
export const IconTrash    = (p) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>;
export const IconPlay     = (p) => <Svg {...p}><path d="M7 4.5v15l12-7.5-12-7.5Z" /></Svg>;
export const IconChart    = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
export const IconPin      = (p) => <Svg {...p}><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
export const IconCalendar = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const IconBack     = (p) => <Svg {...p}><path d="M15 18 9 12l6-6" /></Svg>;
export const IconChevron  = (p) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
export const IconImage    = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></Svg>;
export const IconTrophy   = (p) => <Svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6" /></Svg>;
export const IconGrid     = (p) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>;
export const IconList     = (p) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>;
export const IconTag      = (p) => <Svg {...p}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1.5" /></Svg>;
export const IconClose    = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
