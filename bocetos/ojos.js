// análisis 3: ojos abiertos / cerrados, parpadeos y dirección de la mirada
// usa los blendshapes eyeBlink* y eyeLook* del modelo de rostro.
// la mirada desde una webcam es aproximada: sirve para izquierda / derecha /
// arriba / abajo, no para saber el punto exacto que se está mirando.

import { crearBoceto } from "../compartido/boceto.js";
import {
  cargarRostro,
  blendshapesComoObjeto,
  FaceLandmarker,
} from "../compartido/modelos.js";

// sobre este valor de eyeBlink el ojo se considera cerrado
const UMBRAL_CERRADO = 0.5;

// los blendshapes nombran los lados desde el punto de vista de la persona.
// si al guiñar el ojo derecho se marca el izquierdo, cambiar a true.
const INVERTIR_LADOS = false;

// índices de todos los puntos de ojos e iris, para recortar la zona de los ojos
const INDICES_OJOS = [
  ...new Set(
    [
      ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    ].flatMap(({ start, end }) => [start, end]),
  ),
];

// estado de parpadeo por cada rostro (según su orden de detección)
const parpadeos = [];

function analizarOjos(formas) {
  const izq = INVERTIR_LADOS ? "Right" : "Left";
  const der = INVERTIR_LADOS ? "Left" : "Right";

  const cierreIzq = formas[`eyeBlink${izq}`] ?? 0;
  const cierreDer = formas[`eyeBlink${der}`] ?? 0;

  // mirada horizontal: positivo = hacia la derecha de la persona
  const haciaDerecha = ((formas[`eyeLookIn${izq}`] ?? 0) + (formas[`eyeLookOut${der}`] ?? 0)) / 2;
  const haciaIzquierda = ((formas[`eyeLookOut${izq}`] ?? 0) + (formas[`eyeLookIn${der}`] ?? 0)) / 2;
  const haciaArriba = ((formas.eyeLookUpLeft ?? 0) + (formas.eyeLookUpRight ?? 0)) / 2;
  const haciaAbajo = ((formas.eyeLookDownLeft ?? 0) + (formas.eyeLookDownRight ?? 0)) / 2;

  const miradaX = haciaDerecha - haciaIzquierda;
  const miradaY = haciaAbajo - haciaArriba;

  return {
    ojoIzqAbierto: cierreIzq < UMBRAL_CERRADO,
    ojoDerAbierto: cierreDer < UMBRAL_CERRADO,
    aperturaIzq: 1 - cierreIzq,
    aperturaDer: 1 - cierreDer,
    miradaX,
    miradaY,
  };
}

function contarParpadeo(indice, ojos) {
  parpadeos[indice] ??= { cerrados: false, total: 0, tiempos: [] };
  const registro = parpadeos[indice];
  const cerrados = !ojos.ojoIzqAbierto && !ojos.ojoDerAbierto;
  if (cerrados && !registro.cerrados) {
    registro.total++;
    registro.tiempos.push(performance.now());
  }
  registro.cerrados = cerrados;
  // parpadeos en el último minuto
  const haceUnMinuto = performance.now() - 60000;
  registro.tiempos = registro.tiempos.filter((t) => t > haceUnMinuto);
  return registro;
}

crearBoceto({
  titulo: "ojos",
  cargar: () => cargarRostro({ rostros: 4 }),
  analizar: (modelo, video, tiempo) => {
    const resultado = modelo.detectForVideo(video, tiempo);
    resultado.ojos = resultado.faceBlendshapes.map((clasificaciones, i) => {
      const ojos = analizarOjos(blendshapesComoObjeto(clasificaciones));
      const registro = contarParpadeo(i, ojos);
      return {
        ...ojos,
        parpadeos: registro.total,
        parpadeosPorMinuto: registro.tiempos.length,
      };
    });
    return resultado;
  },
  resumir: (resultado) => ({ ojos: resultado.ojos }),
  dibujar: (p, resultado, herramientas) => {
    const { aPantalla, dibujarConexiones, dibujarRecorte, marco, espejo } = herramientas;

    resultado.faceLandmarks.forEach((puntos, i) => {
      const ojos = resultado.ojos[i];
      if (!ojos) return;

      // contorno de los ojos: verde abierto, rojo cerrado
      p.strokeWeight(2);
      p.stroke(ojos.ojoIzqAbierto ? "#7dff4d" : "#ff4d6d");
      dibujarConexiones(puntos, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE);
      p.stroke(ojos.ojoDerAbierto ? "#7dff4d" : "#ff4d6d");
      dibujarConexiones(puntos, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE);
      p.stroke("#4dd2ff");
      dibujarConexiones(puntos, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS);
      dibujarConexiones(puntos, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS);

      // flecha de mirada desde el entrecejo.
      // en espejo, la derecha de la persona queda a la derecha de la pantalla
      const entrecejo = aPantalla(puntos[168]);
      p.stroke("#ffd24d");
      p.strokeWeight(4);
      p.line(
        entrecejo.x,
        entrecejo.y,
        entrecejo.x + ojos.miradaX * (espejo ? 1 : -1) * 200,
        entrecejo.y + ojos.miradaY * 200,
      );

      p.noStroke();
      p.fill(255);
      p.textSize(14);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text(
        `parpadeos ${ojos.parpadeos} · ${ojos.parpadeosPorMinuto}/min`,
        entrecejo.x,
        entrecejo.y - 60,
      );
    });

    // zoom a los ojos de la primera persona, en la parte de abajo
    const puntos = resultado.faceLandmarks[0];
    if (puntos) {
      const xs = INDICES_OJOS.map((indice) => puntos[indice].x);
      const ys = INDICES_OJOS.map((indice) => puntos[indice].y);
      const margen = 0.2 * (Math.max(...xs) - Math.min(...xs));
      const recorte = {
        x: Math.max(0, Math.min(...xs) - margen),
        y: Math.max(0, Math.min(...ys) - margen),
      };
      recorte.ancho = Math.min(1 - recorte.x, Math.max(...xs) + margen - recorte.x);
      recorte.alto = Math.min(1 - recorte.y, Math.max(...ys) + margen - recorte.y);

      const proporcion =
        (recorte.alto * marco.alto) / (recorte.ancho * marco.ancho);
      const ancho = p.width * 0.5;
      const alto = ancho * proporcion;
      const destino = {
        x: (p.width - ancho) / 2,
        y: p.height - alto - 16,
        ancho,
        alto,
      };
      dibujarRecorte(recorte, destino);
      p.noFill();
      p.stroke(255);
      p.strokeWeight(2);
      p.rect(destino.x, destino.y, destino.ancho, destino.alto);
    }
  },
});
