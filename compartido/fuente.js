// fuente de video compartida por todas las páginas.
// este es el único archivo que decide de dónde viene el video.
//
// parámetros por URL:
//   (ninguno)                   cámara de este computador
//   ?emisor=macbook-a.local:8080  video que manda otro computador (ver emisor.html)
//   ?emisor                     video desde el mismo servidor que sirve la página
//   ?camara=facetime            elige la cámara cuyo nombre contenga ese texto
//                               (útil con tarjetas de captura USB)
//   ?ancho=1280&alto=720        resolución pedida a la cámara

import { recibirVideo } from "./red.js";

const parametros = new URLSearchParams(location.search);

export async function obtenerVideo({ avisar = () => {} } = {}) {
  if (parametros.has("emisor")) {
    const host = parametros.get("emisor") || location.host;
    return recibirVideo(host, avisar);
  }
  return crearVideo(await obtenerCamara());
}

// flujo (MediaStream) de la cámara local
export async function obtenerCamara() {
  if (!navigator.mediaDevices) {
    throw new Error(
      "la cámara solo funciona en localhost o https (abrir esta página en http://localhost:8080)",
    );
  }

  const nombreCamara = parametros.get("camara");
  const restricciones = {
    width: { ideal: Number(parametros.get("ancho") ?? 1280) },
    height: { ideal: Number(parametros.get("alto") ?? 720) },
  };

  // primero pedimos cualquier cámara, así el navegador entrega los nombres
  let flujo = await navigator.mediaDevices.getUserMedia({
    video: restricciones,
    audio: false,
  });

  const camaras = await listarCamaras();
  console.log("cámaras disponibles:", camaras.map((c) => c.label));

  if (nombreCamara) {
    const elegida = camaras.find((c) =>
      c.label.toLowerCase().includes(nombreCamara.toLowerCase()),
    );
    if (elegida) {
      flujo.getTracks().forEach((pista) => pista.stop());
      flujo = await navigator.mediaDevices.getUserMedia({
        video: { ...restricciones, deviceId: { exact: elegida.deviceId } },
        audio: false,
      });
    } else {
      console.warn(`no encontré una cámara que contenga "${nombreCamara}"`);
    }
  }

  return flujo;
}

export async function listarCamaras() {
  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  return dispositivos.filter((d) => d.kind === "videoinput");
}

export async function crearVideo(flujo) {
  const video = document.createElement("video");
  video.srcObject = flujo;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return video;
}
