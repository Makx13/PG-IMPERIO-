# Integración JavaScript de P.G: Imperio

Cómo se comunica una página web con el juego compilado (`juego/index.js` + `index.wasm` + `index.data`). Toda la comunicación pasa por el objeto global `Module` de Emscripten.

> Este documento describe **solo lo que existe y se verificó** en esta compilación. El juego no ofrece hoy funciones para leer el dinero, cambiar el volumen o recibir eventos de juego desde JavaScript: si hacen falta, hay que agregarlas en el código C++ (ver el final).

## 1. Requisitos mínimos de la página

Página mínima funcional (verificada: copiada junto a los archivos de `juego/`, carga el juego, el audio arranca con el botón y la partida se guarda en IndexedDB):

```html
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>P.G: Imperio</title><link rel="icon" href="favicon.png">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#10061e}#canvas{display:block;width:100vw;height:100vh}</style>
</head>
<body>
  <canvas id="canvas" tabindex="-1" oncontextmenu="return false"></canvas>
  <button id="play">JUGAR</button>
  <script>
    var Module = {
      canvas: document.getElementById('canvas'),
      // Guardado persistente: montar IndexedDB en /persist ANTES de que arranque el juego
      preRun: [function () {
        FS.mkdir('/persist');
        FS.mount(IDBFS, {}, '/persist');
        addRunDependency('pg-idbfs');                       // el juego espera a que termine la lectura
        FS.syncfs(true, function (err) { if (err) console.warn(err); removeRunDependency('pg-idbfs'); });
      }],
      onRuntimeInitialized: function () { /* listo: habilitar el botón JUGAR */ }
    };
    document.getElementById('play').addEventListener('click', function () {
      Module._pg_unlock_audio();                            // dentro del clic: si no, el navegador bloquea el audio
      this.remove();
    });
    addEventListener('pagehide', function () { if (Module._pg_save) Module._pg_save(); });
  </script>
  <script async src="index.js"></script>
</body>
</html>
```

Reglas:
- **El canvas tiene que tener `id="canvas"`.** raylib lo busca por ese id (por ejemplo para el clic y la opacidad), además de recibirlo en `Module.canvas`.
- `Module` tiene que existir **antes** de cargar `index.js`.
- `FS`, `IDBFS`, `addRunDependency` y `removeRunDependency` están disponibles dentro de `preRun` (se exportan en la compilación). La plantilla completa (`plantilla/shell.html`) los toma de forma más defensiva: `var M = mod || window.Module; var fs = M.FS || window.FS; ...`.
- Sin el montaje de `/persist`, el juego funciona igual pero **no guarda** entre sesiones.

## 2. Funciones del juego

### `Module._pg_unlock_audio()`
Inicia el audio (la música, generada en tiempo real por el juego).
- **Llamarla dentro del manejador de un gesto del usuario** (`click`, `keydown`, `pointerup`/`touchend`). Así el `AudioContext` del navegador se crea "habilitado". Fuera de un gesto, el navegador lo deja suspendido.
- Si se llama antes de que el juego termine de iniciar, queda pedida y el audio arranca en el primer cuadro.
- Es idempotente: llamarla de nuevo no hace nada si el audio ya suena.
- Respaldo: si nunca se llama, el audio arranca solo con el primer clic dentro del canvas.
- No recibe parámetros ni devuelve nada.

### `Module._pg_save()`
Fuerza un guardado inmediato.
- Escribe la partida en el sistema de archivos virtual (`/persist/save.dat`) y la vuelca a IndexedDB. El volcado es **asíncrono**: termina unos milisegundos después de volver la función.
- No hace nada si el juego todavía no terminó de iniciar.
- El juego ya guarda solo cada 5 segundos; esta función sirve para `pagehide` y `visibilitychange` (pestaña oculta), como hace la plantilla.
- No recibe parámetros ni devuelve nada.

### `Module.pauseMainLoop()` / `Module.resumeMainLoop()`
Las provee el runtime de Emscripten, no el juego, pero funcionan (verificado): pausan y reanudan el bucle de cuadros, es decir la simulación y el dibujo.
- **La música sigue sonando durante la pausa**, porque el audio no depende del bucle. No hay hoy una función para silenciarla desde JavaScript: el jugador usa la tecla N.
- Mientras el bucle está pausado no se acumula dinero. Al reanudar, el primer cuadro avanza como máximo 0,1 s de juego.
- La ganancia "mientras no estabas" solo se calcula al abrir el juego, a partir de la hora del último guardado: 50% del ingreso por segundo, hasta 8 h.

## 3. Eventos de carga (para una pantalla de carga propia)

Son las convenciones estándar de Emscripten; la plantilla las usa todas:

| Propiedad de `Module` | Cuándo se llama | Uso en la plantilla |
|---|---|---|
| `setStatus(texto)` | Durante la descarga. El texto trae el progreso como `"... (recibido/total)"`. | Barra de progreso: se extraen los dos números con `/\((\d+(?:\.\d+)?)\/(\d+)\)/`. |
| `monitorRunDependencies(pendientes)` | Cada vez que cambia la cantidad de tareas de arranque pendientes (descarga del `.data`, lectura de IndexedDB...). | Progreso aproximado y el texto "Iniciando...". |
| `onRuntimeInitialized()` | El runtime está listo, justo antes de que arranque el juego. | Oculta la carga y muestra el menú con JUGAR habilitado. |
| `onAbort(motivo)` | Error fatal (por ejemplo, el navegador no soporta WebAssembly). | Mensaje de error en español. |
| `print(t)` / `printErr(t)` | Mensajes del juego y de raylib (registro). | Se redirigen a `console.log` / `console.warn`. |

Además conviene escuchar `webglcontextlost` en el canvas: si el navegador descarta el contexto gráfico, la plantilla avisa al jugador que recargue.

## 4. Opciones de arranque

### Forzar el idioma: `Module.arguments`
```js
var Module = { arguments: ['--lang', 'en'], /* ... */ };   // 'en' o 'es'
```
Fuerza inglés o español al abrir, por encima de lo guardado y del idioma del navegador (verificado con `'en'`). Si no se pasa, el juego usa el idioma guardado, o el del navegador en la primera partida (`navigator.language` que empiece con `es` da español, cualquier otro inglés). El jugador lo cambia con la tecla I o con las banderas.

### Ubicación de los archivos: `Module.locateFile`
Función estándar de Emscripten para cargar `index.wasm` e `index.data` desde otra carpeta o un CDN, o para agregarles una versión anti-caché:
```js
var Module = { locateFile: function (path, prefix) { return 'https://cdn.ejemplo.com/pg/' + path + '?v=2'; } };
```
No se probó con esta compilación; es el mecanismo documentado de Emscripten.

## 5. Tamaño del canvas e incrustación

- El juego ajusta el canvas a **`window.innerWidth` x `window.innerHeight`** al iniciar y en cada `resize` de la ventana. El CSS del canvas no lo cambia: lo vuelve a fijar el juego.
- La interfaz está diseñada en 1280x720 y se escala centrada (16:9). El fondo cubre el resto de la pantalla, así que cualquier proporción se ve bien.
- **Para mostrarlo en un recuadro dentro de otra página, usar un `<iframe>`.** Dentro del iframe, la "ventana" es el iframe, y el canvas toma su tamaño (verificado con 800x450):
```html
<iframe src="juego/index.html" width="1280" height="720" style="border:0;max-width:100%"
        allow="autoplay; fullscreen" title="P.G: Imperio"></iframe>
```
`allow="fullscreen"` es necesario para que funcione el botón de pantalla completa dentro del iframe. El teclado llega al juego cuando el iframe tiene el foco: el clic en JUGAR o en el juego se lo da.

## 6. Entrada y pantalla completa

- **Teclado:** el juego lo escucha en la ventana. La plantilla evita que Espacio y las flechas desplacen la página (`preventDefault` en `keydown`, solo mientras se juega). Si se cambia la plantilla, mantener eso.
- **Mouse:** clic sobre el canvas. Se bloquea el menú contextual (`oncontextmenu`).
- **Gamepad:** botón inferior (A) para golpear y botón izquierdo (X) para agarrar el maletín.
- **Táctil:** no verificado.
- **Pantalla completa:** en la web la maneja la página. El juego ignora F11, y la plantilla intercepta F11 y llama a `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`. Tiene que ejecutarse desde un gesto del usuario (clic o tecla).

## 7. Dónde queda la partida

- **IndexedDB**, base de datos `/persist`, almacén `FILE_DATA`, clave `/persist/save.dat`.
- El valor es `{ timestamp, mode, contents }`, donde `contents` es un `Uint8Array` de **216 bytes**: el formato binario v2 del juego, descrito en `docs/GAME_DESIGN.md` (sección de guardado) y `docs/ARCHITECTURE.md`.
- Pueden existir también `/persist/save.dat.tmp` (escritura en curso) y `/persist/save.dat.bad`. Este último es un guardado ilegible que el juego apartó en lugar de pisarlo.
- La partida es por navegador y por origen (dominio + protocolo + puerto). Borrar los datos del sitio la elimina.
- No se recomienda escribir ese registro desde la página: un formato incorrecto hace que el juego aparte la partida como `.bad` y empiece de cero.

## 8. Elementos de la página (`juego/index.html`)

El archivo `juego/arranque.js` usa estos ids. Se pueden cambiar, pero entonces hay que cambiar también el script:

| id | Elemento |
|---|---|
| `canvas` | El canvas del juego (**no cambiarlo**). |
| `loading`, `load-title`, `bar`, `status` | Pantalla de carga, título, barra de progreso y texto de estado. |
| `menu`, `play`, `menu-fs` | Menú de inicio, botón JUGAR y botón de pantalla completa del menú. |
| `hud-fs` | Botón de pantalla completa que queda en una esquina mientras se juega. |

En el paquete servido, `arranque.js` se ejecuta antes de `index.js` para preparar `window.Module`. La marca `{{{ SCRIPT }}}` de `plantilla/shell.html` queda reservada para la compilación con Emscripten.

## 9. Agregar funciones nuevas (requiere el código fuente)

Las funciones `_pg_*` están definidas en C++ en `src/app/app.cpp` del repositorio, con `extern "C" EMSCRIPTEN_KEEPALIVE`. Cada una nueva hay que agregarla a `-sEXPORTED_FUNCTIONS` en `CMakeLists.txt` y recompilar con `web\build_web.ps1`. Por ejemplo, para silenciar la música, leer el dinero o avisar a la página cuando se gana un logro.
