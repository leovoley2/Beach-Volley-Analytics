import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import vercel from './vercel.json' with { type: 'json' }
import pkg from './package.json' with { type: 'json' }

// Las cabeceras de seguridad (CSP, etc.) viven en vercel.json. `vite preview`
// las reutiliza para poder probar el build local con la misma política que prod.
// (No se aplican a `vite dev`: el HMR usa scripts inline que la CSP bloquearía.)
const prodHeaders = Object.fromEntries(
  vercel.headers.flatMap(h => h.headers).map(({ key, value }) => [key, value])
)

// Versión de la app: número de package.json + commit + fecha del build.
// En Vercel el commit viene de VERCEL_GIT_COMMIT_SHA (el clon puede no traer .git).
function gitCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { return '' }
}
const versionInfo = {
  version: pkg.version,
  commit: gitCommit(),
  builtAt: new Date().toISOString(),
  env: process.env.VERCEL_ENV || 'local', // production | preview | development | local
}

// Publica /version.json en el build: abre https://beachvolleyanalytics.com/version.json
// para ver qué versión está en producción sin iniciar sesión.
const versionFile = () => ({
  name: 'bva-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(versionInfo, null, 2) + '\n' })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  preview: { headers: prodHeaders },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(versionInfo.version),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(versionInfo.commit),
    'import.meta.env.VITE_APP_BUILT_AT': JSON.stringify(versionInfo.builtAt),
    'import.meta.env.VITE_APP_ENV': JSON.stringify(versionInfo.env),
  },
})
