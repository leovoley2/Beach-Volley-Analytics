// Utilidades compartidas por las páginas de cuenta (Mi cuenta, Suscripción).

export function formatDate(value) {
    if (!value) return null;
    return new Date(value).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Llama a un endpoint de api/ con el token de la sesión actual.
export async function postApi(path, accessToken, body = {}) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ocurrió un error. Inténtalo de nuevo.');
    return data;
}
