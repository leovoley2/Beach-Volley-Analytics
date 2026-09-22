/**
 * Flags de configuración de autenticación.
 */

/**
 * Inicio/registro con Google.
 *
 * Está DESACTIVADO porque el proveedor Google aún no está habilitado en el panel
 * de Supabase (Authentication → Providers → Google). Mientras no lo esté, el
 * botón "Continuar con Google" devuelve:
 *   { code: 400, error_code: "validation_failed",
 *     msg: "Unsupported provider: provider is not enabled" }
 * y deja fuera a los usuarios nuevos que lo intentan.
 *
 * Para reactivarlo cuando Google ya esté configurado en Supabase:
 *   - pon esta constante en `true`, o
 *   - define VITE_GOOGLE_AUTH_ENABLED=true en el entorno (.env / Vercel).
 */
export const GOOGLE_AUTH_ENABLED =
    import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
