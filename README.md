# 2026-tres-analisis-paralelo

prototipo para una instalación multimedia: una cámara, tres análisis en paralelo, cada uno en su propia ventana (y más adelante en su propio computador y proyector).

| ventana | archivo | qué hace |
| --- | --- | --- |
| 0 · cámara | [camara.html](camara.html) | video en vivo + datos que publican las otras ventanas |
| 1 · postura | [postura.html](postura.html) | presencia y esqueleto de hasta 4 personas, manos arriba, inclinación, cercanía |
| 2 · rostro | [rostro.html](rostro.html) | malla de la cara, expresiones (blendshapes), orientación de la cabeza, gestos de manos |
| 3 · ojos | [ojos.html](ojos.html) | ojos abiertos / cerrados, parpadeos por minuto, dirección de la mirada, zoom a los ojos |

hecho con [p5.js](https://p5js.org) (modo instancia) y [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/guide), todo en el navegador. no hay que instalar nada: las bibliotecas y modelos se cargan desde CDN.

## uso

```sh
npm start
```

levanta un servidor en `http://localhost:8080` y abre las 4 ventanas de Chrome en una grilla de 2x2. también se puede hacer por separado:

```sh
npm run servir     # terminal 1
npm run ventanas   # terminal 2
```

o abrir `http://localhost:8080` en cualquier navegador y elegir una página.

### teclas (en cualquier ventana)

- `v` mostrar / ocultar el video (para proyectar solo el análisis)
- `e` espejo sí / no
- `h` mostrar / ocultar el texto de estado
- `f` pantalla completa

### parámetros por URL

- `?camara=facetime` elige la cámara cuyo nombre contenga ese texto (la lista de cámaras aparece en la consola)
- `?espejo=0` empieza sin espejo

## estructura

```text
compartido/
  fuente.js    de dónde viene el video (hoy: cámara local)
  modelos.js   carga de modelos de MediaPipe
  boceto.js    boceto de p5 común: video, bucle de análisis, teclas, coordenadas
bocetos/
  camara.js, postura.js, rostro.js, ojos.js   un análisis por página
abrir-ventanas.sh   abre las 4 ventanas de Chrome
```

cada página llama a `crearBoceto({ titulo, cargar, analizar, resumir, dibujar })`. para un análisis nuevo, copiar una de las páginas y cambiar esas funciones.

`resumir` publica un objeto pequeño por un `BroadcastChannel` llamado `analisis`, que la ventana de cámara muestra. ese mismo objeto es el que después se puede mandar por WebSocket u OSC a otro programa.

## notas

- el análisis solo corre cuando llega un cuadro nuevo de la cámara, así que "análisis/s" nunca supera los cuadros por segundo de la cámara.
- la mirada desde una webcam es aproximada: sirve para izquierda / derecha / arriba / abajo, no para saber el punto exacto que se está mirando.
- en `bocetos/ojos.js`, si al guiñar un ojo se marca el otro, cambiar `INVERTIR_LADOS` a `true`.
- `rostro` no identifica personas (no hay reconocimiento de identidad). si se agrega, ojo con el consentimiento y la ley de datos personales.

## pasar a tres computadores

1. **por hardware** (lo más robusto): cámara → splitter HDMI → una tarjeta de captura USB en cada computador. cada computador ve una webcam normal, se abre la página con `?camara=<nombre de la tarjeta>` y listo.
2. **por red**: reemplazar `obtenerVideo()` en `compartido/fuente.js` por un video que venga de WebRTC (o NDI). el resto del código no cambia.

para funcionar sin internet, descargar los archivos de p5, MediaPipe (`wasm/`) y los modelos `.task`, y cambiar las rutas en los `.html` y en `compartido/modelos.js`.
