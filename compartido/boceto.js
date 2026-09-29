// estructura común de las 4 páginas: un boceto de p5 (modo instancia)
// que muestra el video, corre un análisis por cada cuadro nuevo
// y deja que cada página dibuje encima.
//
// teclas:
//   v  mostrar / ocultar video (para proyectar solo el análisis)
//   e  activar / desactivar espejo
//   h  mostrar / ocultar texto de estado
//   f  pantalla completa

import { obtenerVideo } from "./fuente.js";

// canal para compartir resúmenes entre ventanas del mismo navegador
export const canal = new BroadcastChannel("analisis");

export function crearBoceto({
  titulo,
  cargar = async () => null, // devuelve el/los modelos
  analizar = () => null, // (modelo, video, tiempoMs) => resultado
  resumir = null, // (resultado) => objeto pequeño para compartir
  dibujar = () => {}, // (p, resultado, herramientas) => void
}) {
  document.title = titulo;

  new p5((p) => {
    let video = null;
    let modelo = null;
    let resultado = null;
    let listo = false;
    let estado = "pidiendo cámara…";
    let ultimoTiempoVideo = -1;

    let mostrarVideo = true;
    let mostrarEstado = true;
    let espejo = new URLSearchParams(location.search).get("espejo") !== "0";

    // cuadros analizados por segundo
    let cuadrosAnalizados = 0;
    let inicioConteo = performance.now();
    let cuadrosPorSegundo = 0;

    // rectángulo del canvas donde se dibuja el video
    const marco = { x: 0, y: 0, ancho: 0, alto: 0 };

    // convierte un punto normalizado de MediaPipe (0..1) a pixeles del canvas
    function aPantalla(punto) {
      const x = espejo ? 1 - punto.x : punto.x;
      return {
        x: marco.x + x * marco.ancho,
        y: marco.y + punto.y * marco.alto,
      };
    }

    // dibuja líneas entre puntos usando una lista de conexiones {start, end}
    function dibujarConexiones(puntos, conexiones) {
      for (const { start, end } of conexiones) {
        const a = puntos[start];
        const b = puntos[end];
        if (!a || !b) continue;
        const pa = aPantalla(a);
        const pb = aPantalla(b);
        p.line(pa.x, pa.y, pb.x, pb.y);
      }
    }

    // dibuja un recorte del video (coordenadas normalizadas) en el canvas
    function dibujarRecorte(recorte, destino) {
      const vx = recorte.x * video.videoWidth;
      const vy = recorte.y * video.videoHeight;
      const va = recorte.ancho * video.videoWidth;
      const vh = recorte.alto * video.videoHeight;
      p.push();
      if (espejo) {
        p.translate(destino.x + destino.ancho, destino.y);
        p.scale(-1, 1);
      } else {
        p.translate(destino.x, destino.y);
      }
      // en espejo el recorte también se toma desde el lado opuesto
      const origenX = espejo ? video.videoWidth - vx - va : vx;
      p.drawingContext.drawImage(
        video,
        origenX, vy, va, vh,
        0, 0, destino.ancho, destino.alto,
      );
      p.pop();
    }

    async function iniciar() {
      try {
        video = await obtenerVideo();
        estado = "cargando modelo…";
        modelo = await cargar();
        listo = true;
        estado = "";
      } catch (error) {
        estado = `error: ${error.message}`;
        console.error(error);
      }
    }

    function actualizarMarco() {
      const escala = Math.min(
        p.width / video.videoWidth,
        p.height / video.videoHeight,
      );
      marco.ancho = video.videoWidth * escala;
      marco.alto = video.videoHeight * escala;
      marco.x = (p.width - marco.ancho) / 2;
      marco.y = (p.height - marco.alto) / 2;
    }

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      iniciar();
    };

    p.draw = () => {
      p.background(0);

      if (video && video.readyState >= 2) {
        actualizarMarco();

        // solo analizamos cuando llega un cuadro nuevo de la cámara
        if (listo && video.currentTime !== ultimoTiempoVideo) {
          ultimoTiempoVideo = video.currentTime;
          resultado = analizar(modelo, video, performance.now());
          cuadrosAnalizados++;
          if (resumir && resultado) {
            canal.postMessage({ origen: titulo, datos: resumir(resultado) });
          }
        }

        if (mostrarVideo) {
          dibujarRecorte(
            { x: 0, y: 0, ancho: 1, alto: 1 },
            marco,
          );
        }

        if (resultado) {
          dibujar(p, resultado, {
            aPantalla,
            dibujarConexiones,
            dibujarRecorte,
            marco,
            video,
            espejo,
          });
        }
      }

      const ahora = performance.now();
      if (ahora - inicioConteo >= 1000) {
        cuadrosPorSegundo = cuadrosAnalizados;
        cuadrosAnalizados = 0;
        inicioConteo = ahora;
      }

      if (mostrarEstado) {
        p.push();
        p.noStroke();
        p.fill(0, 160);
        p.rect(0, 0, p.width, 28);
        p.fill(255);
        p.textSize(14);
        p.textAlign(p.LEFT, p.CENTER);
        const texto = estado || `${cuadrosPorSegundo} análisis/s`;
        p.text(`${titulo} · ${texto}`, 10, 14);
        p.pop();
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    p.keyPressed = () => {
      if (p.key === "v") mostrarVideo = !mostrarVideo;
      if (p.key === "e") espejo = !espejo;
      if (p.key === "h") mostrarEstado = !mostrarEstado;
      if (p.key === "f") p.fullscreen(!p.fullscreen());
    };
  });
}
