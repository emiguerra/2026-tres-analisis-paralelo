// video por red local con WebRTC.
//
// emisor (computador con la cámara): emitirVideo(flujo)
// receptor (computador que analiza):  recibirVideo("macbook-a.local:8080")
//
// la señalización (intercambio de ofertas y respuestas) pasa por
// servidor.js, que corre en el computador emisor. el video en sí va
// directo entre los dos navegadores.
//
// cada ventana receptora abre su propia conexión, así que el emisor
// comprime el video una vez por ventana conectada.

// en red local no hace falta STUN ni TURN
const CONFIGURACION_RTC = { iceServers: [] };

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// sin "trickle ICE": esperamos a juntar los candidatos antes de mandar la
// descripción, así la señalización es un solo pedido HTTP por conexión
async function esperarCandidatos(conexion, ms = 2000) {
  if (conexion.iceGatheringState === "complete") return;
  await new Promise((resolver) => {
    conexion.addEventListener("icegatheringstatechange", () => {
      if (conexion.iceGatheringState === "complete") resolver();
    });
    setTimeout(resolver, ms);
  });
}

async function esperarConexion(conexion, ms = 10000) {
  await new Promise((resolver, rechazar) => {
    const revisar = () => {
      if (conexion.connectionState === "connected") resolver();
      if (conexion.connectionState === "failed") rechazar(new Error("falló la conexión"));
    };
    conexion.addEventListener("connectionstatechange", revisar);
    revisar();
    setTimeout(() => rechazar(new Error("se acabó el tiempo de conexión")), ms);
  });
}

// ---------------------------------------------------------------- receptor

// devuelve un <video> que se reconecta solo si el emisor se cae
export async function recibirVideo(host, avisar = () => {}) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  await conectarConReintentos(host, video, avisar);
  return video;
}

async function conectarConReintentos(host, video, avisar) {
  while (true) {
    try {
      avisar(`conectando con ${host}…`);
      const conexion = await conectar(host, video);
      avisar("");

      let terminada = false;
      conexion.addEventListener("connectionstatechange", () => {
        if (terminada) return;
        if (["disconnected", "failed", "closed"].includes(conexion.connectionState)) {
          terminada = true;
          conexion.close();
          conectarConReintentos(host, video, avisar);
        }
      });
      return;
    } catch (error) {
      avisar(`esperando emisor en ${host} (${error.message})`);
      await esperar(2000);
    }
  }
}

async function conectar(host, video) {
  const conexion = new RTCPeerConnection(CONFIGURACION_RTC);
  try {
    conexion.addTransceiver("video", { direction: "recvonly" });
    const pistaRecibida = new Promise((resolver) =>
      conexion.addEventListener("track", ({ track }) => resolver(track), { once: true }),
    );

    await conexion.setLocalDescription(await conexion.createOffer());
    await esperarCandidatos(conexion);

    const respuesta = await fetch(`http://${host}/senal/oferta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(conexion.localDescription),
    });
    if (!respuesta.ok) throw new Error(await respuesta.text());
    await conexion.setRemoteDescription(await respuesta.json());

    await esperarConexion(conexion);
    video.srcObject = new MediaStream([await pistaRecibida]);
    await video.play();
    return conexion;
  } catch (error) {
    conexion.close();
    throw error;
  }
}

// ------------------------------------------------------------------ emisor

// escucha pedidos de receptores y les manda el flujo de la cámara.
// alCambiar(cantidad) avisa cuántos receptores hay conectados.
export function emitirVideo(flujo, { bitrate = 8_000_000, alCambiar = () => {} } = {}) {
  const conexiones = new Set();

  // "detail" le pide al codificador cuidar la nitidez antes que la fluidez
  for (const pista of flujo.getVideoTracks()) pista.contentHint = "detail";

  const eventos = new EventSource("/senal/emisor");
  eventos.addEventListener("oferta", async ({ data }) => {
    const { id, oferta } = JSON.parse(data);
    const conexion = new RTCPeerConnection(CONFIGURACION_RTC);

    conexion.addEventListener("connectionstatechange", () => {
      const estado = conexion.connectionState;
      if (estado === "connected") {
        conexiones.add(conexion);
        configurarCalidad(conexion, bitrate);
      }
      if (["disconnected", "failed", "closed"].includes(estado)) {
        conexion.close();
        conexiones.delete(conexion);
      }
      alCambiar(conexiones.size);
    });

    try {
      await conexion.setRemoteDescription(oferta);
      for (const pista of flujo.getVideoTracks()) conexion.addTrack(pista, flujo);
      await conexion.setLocalDescription(await conexion.createAnswer());
      await esperarCandidatos(conexion);
      await fetch("/senal/respuesta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, respuesta: conexion.localDescription }),
      });
    } catch (error) {
      console.error("no pude responder a un receptor:", error);
      conexion.close();
    }
  });

  return { conexiones, eventos };
}

async function configurarCalidad(conexion, bitrate) {
  for (const emisor of conexion.getSenders()) {
    try {
      const parametros = emisor.getParameters();
      if (!parametros.encodings?.length) parametros.encodings = [{}];
      parametros.encodings[0].maxBitrate = bitrate;
      // si falta ancho de banda, bajar cuadros por segundo antes que resolución
      parametros.degradationPreference = "maintain-resolution";
      await emisor.setParameters(parametros);
    } catch (error) {
      console.warn("no pude configurar la calidad:", error);
    }
  }
}
