// descarga una sola vez las bibliotecas y modelos a recursos/,
// para que todo funcione sin internet (solo red local).
//
// uso: node descargar.js   (o npm run descargar)
//
// si cambias una versión acá, cámbiala también en los .html
// (p5) y en compartido/modelos.js (MediaPipe).

import { mkdir, writeFile, rename, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "recursos");

const P5 = "p5@2.3.4";
const MEDIAPIPE = "tasks-vision@1.0.1";
const CDN = "https://cdn.jsdelivr.net/npm";
const MODELOS = "https://storage.googleapis.com/mediapipe-models";

// [url, ruta local dentro de recursos/]
const ARCHIVOS = [
  [`${CDN}/${P5}/lib/p5.min.js`, `${P5}/p5.min.js`],
  [`${CDN}/@mediapipe/${MEDIAPIPE}/vision_bundle.mjs`, `${MEDIAPIPE}/vision_bundle.mjs`],
  ...[
    "vision_wasm_internal",
    "vision_wasm_module_internal",
    "vision_wasm_nosimd_internal",
  ].flatMap((nombre) =>
    [".js", ".wasm"].map((ext) => [
      `${CDN}/@mediapipe/${MEDIAPIPE}/wasm/${nombre}${ext}`,
      `${MEDIAPIPE}/wasm/${nombre}${ext}`,
    ]),
  ),
  ...[
    "pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
  ].map((ruta) => [`${MODELOS}/${ruta}`, `modelos/${ruta}`]),
];

const existe = (ruta) => access(ruta).then(() => true, () => false);

let fallos = 0;
for (const [url, relativa] of ARCHIVOS) {
  const destino = join(RAIZ, relativa);
  if (await existe(destino)) {
    console.log(`ya está   ${relativa}`);
    continue;
  }
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`${respuesta.status} ${respuesta.statusText}`);
    const contenido = Buffer.from(await respuesta.arrayBuffer());
    await mkdir(dirname(destino), { recursive: true });
    // escribir aparte y renombrar: si se corta, no queda un archivo a medias
    await writeFile(`${destino}.parcial`, contenido);
    await rename(`${destino}.parcial`, destino);
    console.log(`descargué ${relativa} (${(contenido.length / 1e6).toFixed(1)} MB)`);
  } catch (error) {
    fallos++;
    console.error(`falló     ${relativa}: ${error.message}`);
  }
}

if (fallos) {
  console.error(`\n${fallos} archivo(s) fallaron. revisar la conexión y volver a correr.`);
  process.exit(1);
}
console.log("\nlisto: ya no hace falta internet.");
