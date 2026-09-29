// análisis 1: presencia humana y postura (33 puntos del cuerpo por persona)
// índices de los puntos: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#pose_landmarker_model

import { crearBoceto } from "../compartido/boceto.js";
import { cargarPostura, PoseLandmarker } from "../compartido/modelos.js";

const NARIZ = 0;
const HOMBRO_IZQ = 11;
const HOMBRO_DER = 12;
const MUNECA_IZQ = 15;
const MUNECA_DER = 16;
const CADERA_IZQ = 23;
const CADERA_DER = 24;

const COLORES = ["#ff4d6d", "#4dd2ff", "#ffd24d", "#7dff4d"];

function describirPersona(puntos) {
  const nariz = puntos[NARIZ];
  const hombroIzq = puntos[HOMBRO_IZQ];
  const hombroDer = puntos[HOMBRO_DER];
  const caderaIzq = puntos[CADERA_IZQ];
  const caderaDer = puntos[CADERA_DER];

  // la y crece hacia abajo, así que "arriba" es y menor
  const manoIzqArriba = puntos[MUNECA_IZQ].y < nariz.y;
  const manoDerArriba = puntos[MUNECA_DER].y < nariz.y;

  // ancho de hombros: sirve como estimación de cercanía a la cámara
  const anchoHombros = Math.hypot(
    hombroIzq.x - hombroDer.x,
    hombroIzq.y - hombroDer.y,
  );

  // inclinación del torso en grados (0 = vertical)
  const centroHombros = {
    x: (hombroIzq.x + hombroDer.x) / 2,
    y: (hombroIzq.y + hombroDer.y) / 2,
  };
  const centroCaderas = {
    x: (caderaIzq.x + caderaDer.x) / 2,
    y: (caderaIzq.y + caderaDer.y) / 2,
  };
  const inclinacion =
    (Math.atan2(
      centroHombros.x - centroCaderas.x,
      centroCaderas.y - centroHombros.y,
    ) *
      180) /
    Math.PI;

  return {
    x: centroHombros.x,
    y: centroHombros.y,
    manosArriba: manoIzqArriba && manoDerArriba,
    manoIzqArriba,
    manoDerArriba,
    cercania: anchoHombros,
    inclinacion,
  };
}

crearBoceto({
  titulo: "postura",
  cargar: () => cargarPostura({ personas: 4 }),
  analizar: (modelo, video, tiempo) => modelo.detectForVideo(video, tiempo),
  resumir: (resultado) => ({
    personas: resultado.landmarks.length,
    detalle: resultado.landmarks.map(describirPersona),
  }),
  dibujar: (p, resultado, { aPantalla, dibujarConexiones }) => {
    resultado.landmarks.forEach((puntos, i) => {
      const color = COLORES[i % COLORES.length];

      p.stroke(color);
      p.strokeWeight(4);
      dibujarConexiones(puntos, PoseLandmarker.POSE_CONNECTIONS);

      p.noStroke();
      p.fill(color);
      for (const punto of puntos) {
        if (punto.visibility < 0.5) continue;
        const { x, y } = aPantalla(punto);
        p.circle(x, y, 8);
      }

      // etiqueta sobre la cabeza
      const persona = describirPersona(puntos);
      const cabeza = aPantalla(puntos[NARIZ]);
      const lineas = [
        `persona ${i + 1}`,
        `inclinación ${persona.inclinacion.toFixed(0)}°`,
        `cercanía ${persona.cercania.toFixed(2)}`,
      ];
      if (persona.manosArriba) lineas.push("¡manos arriba!");
      p.fill(255);
      p.stroke(0);
      p.strokeWeight(3);
      p.textSize(16);
      p.textAlign(p.CENTER, p.BOTTOM);
      p.text(lineas.join("\n"), cabeza.x, cabeza.y - 40);
    });

    // contador de personas
    const cantidad = resultado.landmarks.length;
    p.fill(255);
    p.stroke(0);
    p.strokeWeight(4);
    p.textSize(32);
    p.textAlign(p.RIGHT, p.BOTTOM);
    p.text(`${cantidad} ${cantidad === 1 ? "persona" : "personas"}`, p.width - 16, p.height - 16);
  },
});
