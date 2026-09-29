// carga de modelos de MediaPipe Tasks Vision.
// documentación: https://ai.google.dev/edge/mediapipe/solutions/guide

import {
  FilesetResolver,
  PoseLandmarker,
  FaceLandmarker,
  GestureRecognizer,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

export { PoseLandmarker, FaceLandmarker, GestureRecognizer };

// para la instalación sin internet: descargar estos archivos y
// cambiar estas rutas por rutas locales
const RUTA_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const RUTA_MODELOS = "https://storage.googleapis.com/mediapipe-models";

let archivosWasm = null;

async function obtenerWasm() {
  archivosWasm ??= await FilesetResolver.forVisionTasks(RUTA_WASM);
  return archivosWasm;
}

// 33 puntos del cuerpo por persona
export async function cargarPostura({ personas = 4 } = {}) {
  return PoseLandmarker.createFromOptions(await obtenerWasm(), {
    baseOptions: {
      modelAssetPath: `${RUTA_MODELOS}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
      delegate: "GPU",
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
      delegate: "GPU",
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
      delegate: "GPU",
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
