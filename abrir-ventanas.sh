#!/bin/sh
# abre las 4 páginas como ventanas de Chrome sin barra de navegación,
# en una grilla de 2x2. requiere el servidor corriendo (npm run servir).
#
# variables opcionales:
#   URL=http://localhost:8080  ANCHO=800  ALTO=500  sh abrir-ventanas.sh

URL="${URL:-http://localhost:8080}"
ANCHO="${ANCHO:-800}"
ALTO="${ALTO:-500}"

# perfil de Chrome separado: recuerda el permiso de cámara
# y no se mezcla con tu navegador de siempre
PERFIL="$(cd "$(dirname "$0")" && pwd)/.perfil-chrome"

i=0
for pagina in camara postura rostro ojos; do
  x=$(( (i % 2) * ANCHO ))
  y=$(( (i / 2) * ALTO + 30 ))
  open -na "Google Chrome" --args \
    --user-data-dir="$PERFIL" \
    --no-first-run \
    --no-default-browser-check \
    --use-fake-ui-for-media-stream \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-background-timer-throttling \
    --window-position="$x,$y" \
    --window-size="$ANCHO,$ALTO" \
    --app="$URL/$pagina.html"
  i=$((i + 1))
  sleep 1
done
