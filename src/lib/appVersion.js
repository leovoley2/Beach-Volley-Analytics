// Versión de la app, inyectada en el build por vite.config.js (package.json + commit + fecha).
// Para publicar una versión nueva: sube el número en package.json y anota los cambios en CHANGELOG.md.

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const APP_COMMIT = import.meta.env.VITE_APP_COMMIT || '';
export const APP_BUILT_AT = import.meta.env.VITE_APP_BUILT_AT || '';
// production | preview | development | local
export const APP_ENV = import.meta.env.DEV ? 'dev' : (import.meta.env.VITE_APP_ENV || 'local');

// "v1.1.0", más una marca si no es producción ("v1.1.0 · dev").
export function versionLabel() {
    const tag = APP_ENV === 'production' ? '' : ` · ${APP_ENV === 'preview' ? 'prueba' : APP_ENV}`;
    return `v${APP_VERSION}${tag}`;
}

// Detalle para tooltips / soporte: "v1.1.0 · a1b2c3d · 9 nov 2026, 15:42".
export function versionDetail() {
    const date = APP_BUILT_AT
        ? new Date(APP_BUILT_AT).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
    return [versionLabel(), APP_COMMIT, date].filter(Boolean).join(' · ');
}
