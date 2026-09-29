#!/bin/sh
# abre páginas del proyecto como ventanas de Chrome sin barra de navegación,
# en una grilla de 2 columnas. si el servidor no está corriendo, lo levanta.
#
# ejemplos:
#   sh abrir-ventanas.sh                          las 4 ventanas con la cámara local
#   sh abrir-ventanas.sh emisor                   solo el emisor (computador con cámara)
#   EMISOR=macbook-a.local:8080 sh abrir-ventanas.sh              las 4, video por red
#   EMISOR=macbook-a.local:8080 sh abrir-ventanas.sh postura      una sola, video por red
#
# variables opcionales: PUERTO=8080  ANCHO=800  ALTO=500  EMISOR=host:puerto

cd "$(dirname "$0")" || exit 1

PUERTO="${PUERTO:-8080}"
URL="http://localhost:$PUERTO"
ANCHO="${ANCHO:-800}"
ALTO="${ALTO:-500}"
PAGINAS="${*:-camara postura rostro ojos}"

CONSULTA=""
if [ -n "$EMISOR" ]; then
  CONSULTA="?emisor=$EMISOR"
fi

# perfil de Chrome separado: recuerda permisos
# y no se mezcla con tu navegador de siempre
PERFIL="$(pwd)/.perfil-chrome"

# levantar el servidor si no está corriendo
PID_SERVIDOR=""
if ! curl -s -o /dev/null "$URL/"; then
  node servidor.js "$PUERTO" &
  PID_SERVIDOR=$!
  until curl -s -o /dev/null "$URL/"; do sleep 0.2; done
fi

i=0
for pagina in $PAGINAS; do
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
    --app="$URL/$pagina.html$CONSULTA"
  i=$((i + 1))
  sleep 1
done

# si levantamos el servidor, dejarlo corriendo hasta ctrl+c
if [ -n "$PID_SERVIDOR" ]; then
  echo "servidor corriendo, ctrl+c para cerrar"
  wait "$PID_SERVIDOR"
fi
