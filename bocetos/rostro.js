// análisis 2: rostro (malla, expresiones, orientación de la cabeza) y gestos de manos
// lista de blendshapes: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#face_blendshapes

import { crearBoceto } from "../compartido/boceto.js";
import {
  cargarRostro,
  cargarGestos,
  blendshapesComoObjeto,
  FaceLandmarker,
  GestureRecognizer,
} from "../compartido/modelos.js";

const CANTIDAD_EXPRESIONES = 6;

// puntos de referencia de la cara
const PUNTA_NARIZ = 1;
const FRENTE = 10;
const MENTON = 152;
const MEJILLA_A = 234;
const MEJILLA_B = 454;
const OJO_A = 33;
const OJO_B = 263;

// orientación aproximada de la cabeza, calculada en pixeles de pantalla
// (así respeta el espejo). giro y cabeceo van de -1 a 1 aprox.
function orientacionCabeza(puntos, aPantalla) {
  const nariz = aPantalla(puntos[PUNTA_NARIZ]);
  const frente = aPantalla(puntos[FRENTE]);
  const menton = aPantalla(puntos[MENTON]);
  let mejillaIzq = aPantalla(puntos[MEJILLA_A]);
  let mejillaDer = aPantalla(puntos[MEJILLA_B]);
  if (mejillaIzq.x > mejillaDer.x) [mejillaIzq, mejillaDer] = [mejillaDer, mejillaIzq];
  let ojoIzq = aPantalla(puntos[OJO_A]);
  let ojoDer = aPantalla(puntos[OJO_B]);
  if (ojoIzq.x > ojoDer.x) [ojoIzq, ojoDer] = [ojoDer, ojoIzq];

  const giro = ((nariz.x - mejillaIzq.x) / (mejillaDer.x - mejillaIzq.x) - 0.5) * 2;
  const cabeceo = ((nariz.y - frente.y) / (menton.y - frente.y) - 0.5) * 2;
  const inclinacion = (Math.atan2(ojoDer.y - ojoIzq.y, ojoDer.x - ojoIzq.x) * 180) / Math.PI;
  return { giro, cabeceo, inclinacion, nariz };
}

function expresionesPrincipales(clasificaciones) {
  return (clasificaciones?.categories ?? [])
    .filter((c) => c.categoryName !== "_neutral")
    .sort((a, b) => b.score - a.score)
    .slice(0, CANTIDAD_EXPRESIONES);
}

crearBoceto({
  titulo: "rostro",
  cargar: async () => ({
    rostro: await cargarRostro({ rostros: 4 }),
    gestos: await cargarGestos({ manos: 4 }),
  }),
  analizar: (modelos, video, tiempo) => ({
    rostro: modelos.rostro.detectForVideo(video, tiempo),
    gestos: modelos.gestos.recognizeForVideo(video, tiempo),
  }),
  resumir: ({ rostro, gestos }) => ({
    rostros: rostro.faceLandmarks.length,
    expresiones: rostro.faceBlendshapes.map(blendshapesComoObjeto),
    gestos: gestos.gestures.map((g) => g[0]?.categoryName),
  }),
  dibujar: (p, { rostro, gestos }, { aPantalla, dibujarConexiones }) => {
    rostro.faceLandmarks.forEach((puntos, i) => {
      // malla tenue + contornos marcados
      p.stroke(255, 60);
      p.strokeWeight(1);
      dibujarConexiones(puntos, FaceLandmarker.FACE_LANDMARKS_TESSELATION);
      p.stroke("#4dd2ff");
      p.strokeWeight(2);
      dibujarConexiones(puntos, FaceLandmarker.FACE_LANDMARKS_CONTOURS);

      // flecha de orientación de la cabeza
      const cabeza = orientacionCabeza(puntos, aPantalla);
      p.stroke("#ffd24d");
      p.strokeWeight(4);
      p.line(
        cabeza.nariz.x,
        cabeza.nariz.y,
        cabeza.nariz.x + cabeza.giro * 150,
        cabeza.nariz.y + cabeza.cabeceo * 150,
      );

      // barras con las expresiones más fuertes, a la derecha de la cara
      const borde = puntos.reduce(
        (max, punto) => Math.max(max, aPantalla(punto).x),
        0,
      );
      const arriba = aPantalla(puntos[FRENTE]).y;
      const expresiones = expresionesPrincipales(rostro.faceBlendshapes[i]);
      p.textSize(13);
      p.textAlign(p.LEFT, p.CENTER);
      expresiones.forEach((expresion, j) => {
        const x = borde + 20;
        const y = arriba + j * 20;
        p.noStroke();
        p.fill(0, 150);
        p.rect(x, y - 8, 120, 16);
        p.fill("#ff4d6d");
        p.rect(x, y - 8, 120 * expresion.score, 16);
        p.fill(255);
        p.text(expresion.categoryName, x + 126, y);
      });
      p.text(
        `giro ${cabeza.giro.toFixed(2)} · cabeceo ${cabeza.cabeceo.toFixed(2)} · inclinación ${cabeza.inclinacion.toFixed(0)}°`,
        borde + 20,
        arriba + expresiones.length * 20 + 10,
      );
    });

    // manos y gestos
    gestos.landmarks.forEach((puntos, i) => {
      p.stroke("#7dff4d");
      p.strokeWeight(3);
      dibujarConexiones(puntos, GestureRecognizer.HAND_CONNECTIONS);

      const gesto = gestos.gestures[i]?.[0];
      if (gesto && gesto.categoryName !== "None") {
        const muneca = aPantalla(puntos[0]);
        p.noStroke();
        p.fill(255);
        p.textSize(20);
        p.textAlign(p.CENTER, p.TOP);
        p.text(
          `${gesto.categoryName} ${(gesto.score * 100).toFixed(0)}%`,
          muneca.x,
          muneca.y + 12,
        );
      }
    });
  },
});
