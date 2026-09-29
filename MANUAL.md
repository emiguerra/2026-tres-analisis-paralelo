# manual de uso

## qué es

una cámara mira a las personas y tres programas la analizan al mismo tiempo, cada uno en su propia ventana:

| ventana | qué muestra |
| --- | --- |
| cámara | el video en vivo y los datos de las otras ventanas |
| postura | el esqueleto del cuerpo de cada persona |
| rostro | la malla de la cara, las expresiones y los gestos de las manos |
| ojos | si los ojos están abiertos o cerrados, los parpadeos y hacia dónde se mira |

todo corre en Chrome (o Chromium en la Raspberry Pi). no se guarda ni se identifica a nadie.

## qué se necesita

- node instalado ([nodejs.org](https://nodejs.org) en Mac; en la Raspberry Pi ver abajo)
- Google Chrome (Mac) o Chromium (Raspberry Pi, viene instalado)
- una copia de esta carpeta en cada computador

### raspberry pi 5

- sistema: Raspberry Pi OS **64 bits, con escritorio**
- ventilador activo (el oficial, "Active Cooler") y la fuente oficial de 27 W. sin ventilador se pone lenta a los pocos minutos
- 8 GB de RAM si va a correr más de una ventana
- instalar node, con internet, en una terminal:

```sh
sudo apt update
sudo apt install nodejs npm
```

una Raspberry Pi 5 alcanza para **un solo análisis** (postura, rostro u ojos), no para los cuatro a la vez.

## 1. preparar (una sola vez, con internet)

abrir una terminal en esta carpeta y escribir:

```sh
npm run descargar
```

baja los modelos a la carpeta `recursos/`. al terminar dice `listo: ya no hace falta internet`.

si un computador no tiene internet, copiarle la carpeta completa (con `recursos/` adentro) desde otro, con un pendrive.

## 2. usar

### con un solo computador

```sh
npm start
```

se abren las 4 ventanas con la cámara del computador.

### con varios computadores (la instalación)

todos conectados a la misma red wifi, aunque no tenga internet.

**en el computador con la cámara (emisor):**

```sh
npm run emisor
```

la ventana muestra su dirección, por ejemplo `macbook-a.local:8080`. anotarla.

**en cada computador que analiza (receptor)**, cambiar `macbook-a.local:8080` por la dirección anotada:

```sh
EMISOR=macbook-a.local:8080 npm run receptor -- postura
EMISOR=macbook-a.local:8080 npm run receptor -- rostro
EMISOR=macbook-a.local:8080 npm run receptor -- ojos
```

uno por computador. el emisor muestra cuántos receptores están conectados.

## 3. teclas

con la ventana seleccionada:

- `f` pantalla completa
- `v` mostrar u ocultar el video (para proyectar solo el dibujo)
- `h` mostrar u ocultar el texto de arriba
- `e` espejo sí o no

## 4. apagar

cerrar las ventanas y, en la terminal, `ctrl + c`.

## si algo falla

| problema | qué hacer |
| --- | --- |
| la ventana dice `error` o queda en negro | falta preparar: correr `npm run descargar` |
| no aparece la cámara | cerrar otras apps que la usen (Zoom, Photo Booth) y volver a abrir |
| el receptor dice `esperando emisor` | revisar que el emisor esté abierto, que estén en la misma red y que la dirección esté bien escrita |
| macOS o Chrome preguntan por la red o la cámara | responder que sí |
| la Raspberry Pi va lenta después de un rato | se está calentando: revisar el ventilador. en una terminal, `vcgencmd get_throttled` debe decir `throttled=0x0` |
| va lento (sobre todo en la Raspberry Pi) | un solo análisis por computador. probar agregando `PARAMETROS="delegado=CPU"` o `PARAMETROS="postura=lite"` antes del comando, ej: `PARAMETROS="postura=lite" EMISOR=macbook-a.local:8080 npm run receptor -- postura` |
| el receptor se cortó | no hace falta hacer nada, se reconecta solo |

la primera vez cada ventana tarda unos segundos en cargar el modelo (en la Raspberry Pi, más). después no conviene recargarla: dejarla abierta.

detalles técnicos en el [README](README.md).
