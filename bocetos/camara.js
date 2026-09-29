// ventana 0: la cámara en vivo, sin análisis.
// muestra además los resúmenes que publican las otras ventanas
// (útil para ver los datos crudos mientras se prototipa).

import { crearBoceto, canal } from "../compartido/boceto.js";

const ultimosResumenes = {};

canal.addEventListener("message", ({ data }) => {
  ultimosResumenes[data.origen] = data.datos;
});

// redondea los números para que el texto sea legible
function formatear(datos) {
  return JSON.stringify(
    datos,
    (clave, valor) => (typeof valor === "number" ? Number(valor.toFixed(2)) : valor),
  );
}

crearBoceto({
  titulo: "cámara",
  analizar: () => ({}),
  dibujar: (p, resultado, { video }) => {
    const lineas = [`${video.videoWidth}×${video.videoHeight}`];
    for (const [origen, datos] of Object.entries(ultimosResumenes)) {
      lineas.push(`${origen}: ${formatear(datos).slice(0, 200)}`);
    }
    p.noStroke();
    p.fill(0, 160);
    p.rect(0, p.height - lineas.length * 18 - 16, p.width, lineas.length * 18 + 16);
    p.fill(255);
    p.textSize(12);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.text(lineas.join("\n"), 10, p.height - 8);
  },
});
