// servidor local sin dependencias:
// 1. sirve los archivos del proyecto
// 2. hace de señalización WebRTC entre emisor.html y las páginas receptoras
//
// uso: node servidor.js [puerto]

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { networkInterfaces, hostname } from "node:os";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const PUERTO = Number(process.argv[2] ?? process.env.PUERTO ?? 8080);
const RAIZ = dirname(fileURLToPath(import.meta.url));
const TIEMPO_LIMITE_RESPUESTA = 15000;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
};

// ------------------------------------------------------------ señalización

let emisor = null; // respuesta HTTP abierta (server-sent events) hacia emisor.html
const pendientes = new Map(); // id -> respuesta HTTP del receptor esperando

function enviarAlEmisor(evento, datos) {
  emisor?.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
}

// mantiene viva la conexión con el emisor
setInterval(() => emisor?.write(": latido\n\n"), 15000);

function leerCuerpo(pedido) {
  return new Promise((resolver, rechazar) => {
    let cuerpo = "";
    pedido.on("data", (parte) => (cuerpo += parte));
    pedido.on("end", () => {
      try {
        resolver(JSON.parse(cuerpo));
      } catch (error) {
        rechazar(error);
      }
    });
  });
}

function direccionesLocales() {
  const direcciones = [`${hostname()}:${PUERTO}`];
  for (const lista of Object.values(networkInterfaces())) {
    for (const interfaz of lista ?? []) {
      if (interfaz.family === "IPv4" && !interfaz.internal) {
        direcciones.push(`${interfaz.address}:${PUERTO}`);
      }
    }
  }
  return direcciones;
}

async function atenderSenal(pedido, respuesta, ruta) {
  // las páginas receptoras pueden venir de otro servidor (ej: localhost del otro computador)
  respuesta.setHeader("access-control-allow-origin", "*");
  respuesta.setHeader("access-control-allow-headers", "content-type");
  if (pedido.method === "OPTIONS") return respuesta.writeHead(204).end();

  // emisor.html se suscribe para recibir ofertas
  if (ruta === "/senal/emisor" && pedido.method === "GET") {
    emisor?.end(); // si había otro emisor, lo reemplazamos
    respuesta.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    respuesta.write(": hola\n\n");
    emisor = respuesta;
    console.log("emisor conectado");
    pedido.on("close", () => {
      if (emisor === respuesta) {
        emisor = null;
        console.log("emisor desconectado");
      }
    });
    return;
  }

  // un receptor manda su oferta y espera la respuesta del emisor
  if (ruta === "/senal/oferta" && pedido.method === "POST") {
    if (!emisor) {
      return respuesta.writeHead(503).end("no hay emisor conectado");
    }
    const oferta = await leerCuerpo(pedido);
    const id = randomUUID();
    const temporizador = setTimeout(() => {
      pendientes.delete(id);
      respuesta.writeHead(504).end("el emisor no respondió");
    }, TIEMPO_LIMITE_RESPUESTA);
    pendientes.set(id, { respuesta, temporizador });
    enviarAlEmisor("oferta", { id, oferta });
    console.log(`receptor pidiendo video (${pedido.socket.remoteAddress})`);
    return;
  }

  // el emisor contesta una oferta
  if (ruta === "/senal/respuesta" && pedido.method === "POST") {
    const { id, respuesta: descripcion } = await leerCuerpo(pedido);
    const pendiente = pendientes.get(id);
    if (!pendiente) return respuesta.writeHead(404).end("oferta desconocida");
    clearTimeout(pendiente.temporizador);
    pendientes.delete(id);
    pendiente.respuesta
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(descripcion));
    return respuesta.writeHead(200).end("ok");
  }

  if (ruta === "/senal/direcciones" && pedido.method === "GET") {
    respuesta.writeHead(200, { "content-type": "application/json" });
    return respuesta.end(JSON.stringify(direccionesLocales()));
  }

  respuesta.writeHead(404).end("no encontrado");
}

// --------------------------------------------------------- archivos estáticos

async function servirArchivo(respuesta, ruta) {
  if (ruta.endsWith("/")) ruta += "index.html";
  const relativa = normalize(decodeURIComponent(ruta)).replace(/^([/\\])+/, "");

  // no salir de la carpeta ni servir archivos ocultos (ej: .perfil-chrome, .git)
  if (relativa.startsWith("..") || relativa.split(/[/\\]/).some((parte) => parte.startsWith("."))) {
    return respuesta.writeHead(403).end("prohibido");
  }

  try {
    const contenido = await readFile(join(RAIZ, relativa));
    respuesta.writeHead(200, {
      "content-type": TIPOS[extname(relativa)] ?? "application/octet-stream",
      // recursos/ tiene la versión en la ruta y nunca cambia: el navegador lo
      // guarda en su caché (y el wasm ya compilado) y no lo vuelve a pedir
      "cache-control": relativa.startsWith("recursos")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    respuesta.end(contenido);
  } catch {
    respuesta.writeHead(404).end("no encontrado");
  }
}

// ------------------------------------------------------------------ servidor

const servidor = createServer(async (pedido, respuesta) => {
  const ruta = new URL(pedido.url, "http://localhost").pathname;
  try {
    if (ruta.startsWith("/senal/")) return await atenderSenal(pedido, respuesta, ruta);
    await servirArchivo(respuesta, ruta);
  } catch (error) {
    console.error(error);
    if (!respuesta.headersSent) respuesta.writeHead(500).end(String(error));
  }
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  console.log(`servidor en http://localhost:${PUERTO}`);
  console.log("desde otro computador en la misma red:");
  for (const direccion of direccionesLocales()) console.log(`  http://${direccion}`);
  if (!existsSync(join(RAIZ, "recursos"))) {
    console.warn("\nfaltan las bibliotecas y modelos: correr `npm run descargar` (con internet, una vez)");
  }
});
