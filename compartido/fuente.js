// fuente de video compartida por todas las páginas.
// hoy: la cámara local (getUserMedia).
// mañana: este es el único archivo que hay que cambiar para recibir
// el video desde otro computador (WebRTC, NDI, tarjeta de captura, etc).

// parámetros por URL:
//   ?camara=facetime   elige la cámara cuyo nombre contenga ese texto
//                      (útil con tarjetas de captura USB)

export async function obtenerVideo({ ancho = 1280, alto = 720 } = {}) {
  const parametros = new URLSearchParams(location.search);
  const nombreCamara = parametros.get("camara");
  const restricciones = { width: { ideal: ancho }, height: { ideal: alto } };

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

  const video = document.createElement("video");
  video.srcObject = flujo;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return video;
}

export async function listarCamaras() {
  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  return dispositivos.filter((d) => d.kind === "videoinput");
}
