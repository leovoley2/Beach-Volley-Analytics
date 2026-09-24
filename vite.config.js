import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from './vercel.json' with { type: 'json' }

// Las cabeceras de seguridad (CSP, etc.) viven en vercel.json. `vite preview`
// las reutiliza para poder probar el build local con la misma política que prod.
// (No se aplican a `vite dev`: el HMR usa scripts inline que la CSP bloquearía.)
const prodHeaders = Object.fromEntries(
  vercel.headers.flatMap(h => h.headers).map(({ key, value }) => [key, value])
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: { headers: prodHeaders },
})
