# Beach Volley Analytics 🏐

Scouting y estadísticas de voleibol de playa. React + Vite, Supabase y Vercel.
Producción: https://beachvolleyanalytics.com

## Desarrollo

```bash
npm install
npm run dev
```

## Versiones

La versión sale de `version` en `package.json`. Al compilar se le agregan el commit y la fecha,
y se muestra en el menú de cuenta, en el pie de la landing, en la consola del navegador
y en `/version.json` (por ejemplo https://beachvolleyanalytics.com/version.json).

Antes de cada subida a producción:

1. Sube el número de versión (también actualiza `package-lock.json`):
   - corrección de errores: `npm version patch --no-git-tag-version`
   - función nueva: `npm version minor --no-git-tag-version`
2. Anota los cambios en [CHANGELOG.md](CHANGELOG.md).
3. Haz commit y push a `main`: Vercel publica solo.

Para confirmar que la subida ya está en vivo, abre `/version.json` y revisa `version` y `commit`.
