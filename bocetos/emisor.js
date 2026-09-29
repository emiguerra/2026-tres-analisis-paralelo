// emisor: corre en el computador que tiene la cámara y le manda el video
// a las páginas receptoras de otro computador (abiertas con ?emisor=...).
// tiene que abrirse en http://localhost:8080/emisor.html para poder usar la cámara.
//
// parámetros por URL, además de los de compartido/fuente.js:
//   ?bitrate=8   megabits por segundo por receptor

import { crearBoceto } from "../compartido/boceto.js";
import { emitirVideo } from "../compartido/red.js";

const MEGABITS = Number(new URLSearchParams(location.search).get("bitrate") ?? 8);

let receptores = 0;
let direcciones = [];

fetch("/senal/direcciones")
  .then((respuesta) => respuesta.json())
  .then((lista) => (direcciones = lista))
  .catch(() => (direcciones = ["(no pude leer las direcciones: ¿corre servidor.js?)"]));

crearBoceto({
  titulo: "emisor",
  cargar: async (video) =>
    emitirVideo(video.srcObject, {
      bitrate: MEGABITS * 1_000_000,
      alCambiar: (cantidad) => (receptores = cantidad),
    }),
  analizar: () => ({}),
  dibujar: (p, resultado, { video }) => {
    const lineas = [
      `${video.videoWidth}×${video.videoHeight} · ${MEGABITS} Mbps por receptor`,
      `${receptores} ${receptores === 1 ? "receptor conectado" : "receptores conectados"}`,
      "",
      "en el otro computador abrir una página con ?emisor=<dirección>, por ejemplo:",
      ...direcciones.map((direccion) => `  postura.html?emisor=${direccion}`),
    ];
    p.noStroke();
    p.fill(0, 170);
    p.rect(0, p.height - lineas.length * 18 - 16, p.width, lineas.length * 18 + 16);
    p.fill(255);
    p.textSize(13);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text(lineas.join("\n"), 10, p.height - 8);
  },
});
