# Novedades — Beach Volley Analytics

Cada subida a producción lleva un número de versión (`MAYOR.MENOR.PARCHE`):

- **PARCHE** (1.1.0 → 1.1.1): correcciones de errores, sin funciones nuevas.
- **MENOR** (1.1.0 → 1.2.0): funciones nuevas.
- **MAYOR** (1.x → 2.0.0): cambios grandes que modifican cómo se usa la app.

La versión en producción se ve en el menú de cuenta (abajo), en el pie de la página de inicio
y en https://beachvolleyanalytics.com/version.json.

## 1.3.0 — Video: corregir tiempos y diagnóstico de bloqueos

- Botón **⏱** en cada acción del video para corregir su momento: −1 s, −0.5, +0.5, +1 s o
  **Fijar aquí** (el punto actual del video). El clip se reproduce para comprobar el ajuste.
- **Anticipo**: resta automáticamente 0.5–3 s al momento en que tocas al jugador, para que los
  clips no salgan tarde.
- Si el video se queda en «Cargando…», la app comprueba si el equipo puede leer el archivo,
  explica la causa probable y **Reintentar** vuelve a abrir el archivo.

## 1.2.0 — Guardado sin conexión

- Cada acción se guarda **primero en el equipo** y después en el servidor: si se cae la señal
  en la cancha, no se pierde nada.
- Indicador junto al logo: **✓ Guardado**, **Guardando…** o **⚠ Sin conexión · guardado en este equipo**.
- Reintento automático al volver la conexión, cada 15 s y al reabrir el partido; si se cerró la
  pestaña sin señal, al volver a abrir el partido se recuperan los cambios.
- En **Mis partidos**, aviso de partidos con cambios sin subir y botón **Reintentar**.
- Interno: contextos y hooks separados para el recargado en caliente (sin cambios visibles).

## 1.1.1 — Video: avisos de pausa y de error

- Cuando un ataque pausa el video para marcar la cancha, aparece un aviso sobre el video con
  **Ir a la cancha** y **Omitir y seguir** (en iPad la cancha queda fuera de la pantalla).
- Si el navegador no puede leer o decodificar el video, se muestra la causa probable y botones
  para **reintentar desde ese punto**, **saltar 5 s** o elegir otro archivo.
- Indicador "Cargando…" cuando el reproductor espera datos.

## 1.1.0 — Scouting en video (PRO)

- Pestaña **Video** en cada partido: abre el video del partido desde tu computadora (no se sube)
  y registra las acciones mientras lo miras, con teclado o con clics.
- Ataques con **trayectoria opcional** (inicio → final) en una mini cancha; aparecen en el Mapa de ataques.
- **Clips** filtrados por atleta, fundamento, resultado y set, reproducidos uno tras otro.
- En Tendencias, los números de la tabla abren **esos clips** en el video.
- **Descargar video**: une los clips en un MP4 con portada y rótulos, listo para WhatsApp.
- La versión de la app ahora se muestra en el menú de cuenta y en los correos de soporte.

## 1.0.0 — Versión base

- Primera versión numerada: tracker en vivo, Tendencias y PDF, pizarra 2D/3D, planes Free / Pro con PayPal.
