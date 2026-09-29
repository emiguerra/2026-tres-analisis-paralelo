// carga de modelos de MediaPipe Tasks Vision.
// documentación: https://ai.google.dev/edge/mediapipe/solutions/guide

import {
  FilesetResolver,
  PoseLandmarker,
  FaceLandmarker,
  GestureRecognizer,
} from "../recursos/tasks-vision@1.0.1/vision_bundle.mjs";

export { PoseLandmarker, FaceLandmarker, GestureRecognizer };

// archivos locales, descargados con `npm run descargar` (ver descargar.js)
const RUTA_WASM = new URL("../recursos/tasks-vision@1.0.1/wasm", import.meta.url).href;
const RUTA_MODELOS = new URL("../recursos/modelos", import.meta.url).href;

const parametros = new URLSearchParams(location.search);

// ?delegado=CPU para comparar con la GPU (útil en la Raspberry Pi)
const DELEGADO = parametros.get("delegado")?.toUpperCase() === "CPU" ? "CPU" : "GPU";

// ?postura=lite usa el modelo de postura liviano (más rápido, menos preciso)
const VARIANTE_POSTURA = parametros.get("postura") === "lite" ? "lite" : "full";

let archivosWasm = null;

async function obtenerWasm() {
  archivosWasm ??= await FilesetResolver.forVisionTasks(RUTA_WASM);
  return archivosWasm;
}

// 33 puntos del cuerpo por persona
export async function cargarPostura({ personas = 4 } = {}) {
  return PoseLandmarker.createFromOptions(await obtenerWasm(), {
    baseOptions: {
      modelAssetPath: `${RUTA_MODELOS}/pose_landmarker/pose_landmarker_${VARIANTE_POSTURA}/float16/1/pose_landmarker_${VARIANTE_POSTURA}.task`,
      delegate: DELEGADO,
    },
    runningMode: "VIDEO",
    numPoses: personas,
  });
}

// 478 puntos de la cara + 52 blendshapes (expresiones, parpadeo, mirada)
export async function cargarRostro({ rostros = 4 } = {}) {
  return FaceLandmarker.createFromOptions(await obtenerWasm(), {
    baseOptions: {
      modelAssetPath: `${RUTA_MODELOS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: DELEGADO,
    },
    runningMode: "VIDEO",
    numFaces: rostros,
    outputFaceBlendshapes: true,
  });
}

// 21 puntos por mano + gesto reconocido
// (Closed_Fist, Open_Palm, Pointing_Up, Thumb_Down, Thumb_Up, Victory, ILoveYou)
export async function cargarGestos({ manos = 4 } = {}) {
  return GestureRecognizer.createFromOptions(await obtenerWasm(), {
    baseOptions: {
      modelAssetPath: `${RUTA_MODELOS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`,
      delegate: DELEGADO,
    },
    runningMode: "VIDEO",
    numHands: manos,
  });
}

// convierte la lista de blendshapes en un objeto { nombre: valor }
export function blendshapesComoObjeto(clasificaciones) {
  const resultado = {};
  for (const categoria of clasificaciones?.categories ?? []) {
    resultado[categoria.categoryName] = categoria.score;
  }
  return resultado;
}
