# 2026-tres-analisis-paralelo

prototipo para una instalación multimedia: una cámara, tres análisis en paralelo, cada uno en su propia ventana (y más adelante en su propio computador y proyector).

para usarlo sin entrar en detalles técnicos: [MANUAL.md](MANUAL.md).

| ventana | archivo | qué hace |
| --- | --- | --- |
| 0 · cámara | [camara.html](camara.html) | video en vivo + datos que publican las otras ventanas |
| 1 · postura | [postura.html](postura.html) | presencia y esqueleto de hasta 4 personas, manos arriba, inclinación, cercanía |
| 2 · rostro | [rostro.html](rostro.html) | malla de la cara, expresiones (blendshapes), orientación de la cabeza, gestos de manos |
| 3 · ojos | [ojos.html](ojos.html) | ojos abiertos / cerrados, parpadeos por minuto, dirección de la mirada, zoom a los ojos |
| emisor | [emisor.html](emisor.html) | manda la cámara de este computador a otro por red |

hecho con [p5.js](https://p5js.org) (modo instancia) y [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide), todo en el navegador. no hay que instalar nada más que node, y el servidor ([servidor.js](servidor.js)) no tiene dependencias.

## antes de empezar: descargar bibliotecas y modelos

una sola vez, con internet, en cada computador (o copiando la carpeta `recursos/` de uno a otro):

```sh
npm run descargar
```

baja p5, MediaPipe y los modelos `.task` (unos 60 MB) a `recursos/`. desde ahí todo funciona sin internet, solo con la red local. el servidor los manda con caché larga, así que el navegador los lee de su caché en vez de pedirlos cada vez.

## modo 1: un computador

todo corre en el mismo computador, con su cámara.

```sh
npm start
```

levanta el servidor en `http://localhost:8080` y abre las 4 ventanas de Chrome en una grilla de 2x2.

## modo 2: dos computadores

- **computador A** (emisor): tiene la cámara y manda el video.
- **computador B** (receptor): recibe el video y corre los análisis, todos o uno a la vez.

los dos tienen que estar en la misma red. los dos tienen una copia de este repositorio.

en **A**:

```sh
npm run emisor
```

abre la ventana del emisor, que muestra cuántos receptores hay conectados y las direcciones para usar en B (por ejemplo `macbook-a.local:8080` o `192.168.1.20:8080`).

en **B**:

```sh
EMISOR=macbook-a.local:8080 npm run receptor              # las 4 ventanas
EMISOR=macbook-a.local:8080 npm run receptor -- postura   # una sola
EMISOR=macbook-a.local:8080 npm run receptor -- rostro ojos
```

o, sin scripts, abrir cualquier página agregando `?emisor=`, por ejemplo `http://localhost:8080/postura.html?emisor=macbook-a.local:8080`.

detalles:

- el video va por WebRTC, directo entre los dos navegadores. [servidor.js](servidor.js) en A solo presenta a las dos partes (señalización).
- el video no va "crudo": 720p sin comprimir son unos 660 Mbps. va comprimido a 8 Mbps por receptor, que es de sobra para estos análisis. se puede cambiar con `emisor.html?bitrate=15`.
- cada ventana receptora es una conexión aparte, así que A comprime el video una vez por ventana.
- si A se cae o se recarga, las ventanas de B se reconectan solas.
- la primera vez, macOS puede preguntar en A si node puede recibir conexiones: responder que sí. Chrome en B puede pedir permiso para acceder a la red local: también sí.
- con wifi funciona, pero con cable de red (o un cable directo entre los dos computadores) es más estable.

## teclas (en cualquier ventana)

- `v` mostrar / ocultar el video (para proyectar solo el análisis)
- `e` espejo sí / no
- `h` mostrar / ocultar el texto de estado
- `f` pantalla completa

## parámetros por URL

- `?emisor=host:puerto` recibe el video desde un emisor en vez de usar la cámara local (`?emisor` sin valor: el mismo servidor que sirve la página)
- `?camara=facetime` elige la cámara cuyo nombre contenga ese texto (la lista de cámaras aparece en la consola)
- `?ancho=1920&alto=1080` resolución pedida a la cámara
- `?espejo=0` empieza sin espejo
- `?bitrate=8` (solo emisor) megabits por segundo por receptor
- `?delegado=CPU` corre los modelos en la CPU en vez de la GPU (para comparar, ej: en una Raspberry Pi)
- `?postura=lite` modelo de postura liviano: más rápido, menos preciso

con los scripts, los parámetros extra van en `PARAMETROS`, ej: `PARAMETROS="delegado=CPU&postura=lite" npm run receptor -- postura`.

## estructura

```text
servidor.js          archivos estáticos + señalización WebRTC (node, sin dependencias)
descargar.js         baja bibliotecas y modelos a recursos/ (una vez, con internet)
abrir-ventanas.sh    abre páginas como ventanas de Chrome o Chromium (y el servidor si no está corriendo)
compartido/
  fuente.js    de dónde viene el video: cámara local o red
  red.js       WebRTC: emitirVideo() y recibirVideo()
  modelos.js   carga de modelos de MediaPipe
  boceto.js    boceto de p5 común: video, bucle de análisis, teclas, coordenadas
bocetos/
  camara.js, postura.js, rostro.js, ojos.js, emisor.js   una por página
```

cada página llama a `crearBoceto({ titulo, cargar, analizar, resumir, dibujar })`. para un análisis nuevo, copiar una de las páginas y cambiar esas funciones. las páginas no saben de dónde viene el video: eso lo decide `compartido/fuente.js`.

`resumir` publica un objeto pequeño por un `BroadcastChannel` llamado `analisis`, que la ventana de cámara muestra (solo entre ventanas del mismo computador). ese mismo objeto es el que después se puede mandar por WebSocket u OSC a otro programa.

## notas

- el análisis solo corre cuando llega un cuadro nuevo del video, así que "análisis/s" nunca supera los cuadros por segundo de la cámara.
- la mirada desde una webcam es aproximada: sirve para izquierda / derecha / arriba / abajo, no para saber el punto exacto que se está mirando.
- en `bocetos/ojos.js`, si al guiñar un ojo se marca el otro, cambiar `INVERTIR_LADOS` a `true`.
- `rostro` no identifica personas (no hay reconocimiento de identidad). si se agrega, ojo con el consentimiento y la ley de datos personales.

## hacia la instalación: un emisor y tres computadores

el modo 2 ya sirve para esto: un emisor (A) y tres receptores, cada uno con `npm run receptor -- postura`, `-- rostro` y `-- ojos`.

la alternativa por hardware es cámara → splitter HDMI → una tarjeta de captura USB en cada computador. cada computador ve una webcam normal (modo 1, con `?camara=<nombre de la tarjeta>`), sin red de por medio.
