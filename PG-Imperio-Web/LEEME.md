# P.G: Imperio — paquete web

Juego incremental (idle/clicker) de estética synthwave, escrito en C++17 con raylib 5.5 y compilado a WebAssembly con Emscripten. Este paquete trae todo lo necesario para alojarlo y para diseñar la página que lo contiene.

## Contenido

| Carpeta / archivo | Qué es |
|---|---|
| `juego/` | **La versión web compilada, lista para subir.** Es un sitio estático: no necesita servidor de aplicaciones ni base de datos. |
| `plantilla/shell.html` | Copia de la plantilla de compilación de Emscripten. Para editar este paquete web, usá los archivos de `juego/`. |
| `API_JAVASCRIPT.md` | Cómo se comunica la página con el juego: funciones disponibles, eventos de carga, guardado, audio, pantalla completa, tamaño del canvas, cómo incrustarlo. |
| `docs/` | Documentación del proyecto: `README.md` (general y compilación), `ARCHITECTURE.md` (código), `GAME_DESIGN.md` (mecánicas y economía), `CHANGELOG.md`, `ROADMAP.md` (pendientes). Son copias exactas de las del repositorio. Las rutas que mencionan (`src/`, `web/`, `tests/`, `CLAUDE.md`, `AGENTS.md`, `steam/STEAM.md`) son del repositorio y no vienen en este paquete. |
| `recursos/logo/` | `icon.png` (512x512, ícono/logo cuadrado), `icon.ico` (ícono de Windows), `library_logo.png` (1280x720, logotipo con fondo transparente). |
| `recursos/arte/` | Arte promocional en alta resolución (hecho para la tienda de Steam, sirve para la web): `library_hero.png` 3840x1240, `page_background.png` 1438x810, `main_capsule.png` 1232x706, `header_capsule.png` / `library_header.png` 920x430, `library_capsule.png` 600x900, `vertical_capsule.png` 748x896, `small_capsule.png` 462x174, `community_icon.jpg` 184x184, y `achievements/` con los 26 íconos de logros (256x256, versión normal y `_locked`). |
| `recursos/fuentes/` | Poppins Medium y Bold, la tipografía del juego (licencia SIL Open Font License, `OFL.txt`: se puede usar en la web; conservar la licencia). |

### Archivos de `juego/`

| Archivo | Tamaño aprox. | Función |
|---|---|---|
| `index.html` | — | Estructura de la página: canvas, carga, menú y controles. |
| `estilos.css` | — | Apariencia de la página y diseño adaptable. |
| `arranque.js` | — | Configura `Module` antes de cargar `index.js` y maneja menú, audio, pantalla completa y guardado. |
| `index.js` | 170 KB | Código de arranque de Emscripten (carga el `.wasm` y el `.data`). |
| `index.wasm` | 350 KB | El juego compilado. |
| `index.data` | 320 KB | Archivos empaquetados (las fuentes que usa el juego dentro del canvas). |
| `favicon.png` | 160 KB | Ícono de la pestaña. |
| `.nojekyll` | 0 B | Solo para GitHub Pages (evita que ignore archivos). Inofensivo en otros servidores. |

`index.js`, `index.wasm` e `index.data` van siempre juntos y en la misma carpeta que la página (salvo que se configure `Module.locateFile`, ver `API_JAVASCRIPT.md`).

## Probarlo en tu computadora

Abrir `index.html` con doble clic (`file://`) **no funciona**: el navegador bloquea la carga del `.wasm` y del `.data`. Hace falta un servidor local cualquiera, desde la carpeta `juego/`:

```
cd juego
python -m http.server 8080          # Python 3
# o bien:  npx http-server -p 8080
```

y abrir http://localhost:8080. Necesita un navegador con WebGL y WebAssembly. Se probó en Chrome; Edge usa el mismo motor y Firefox y Safari deberían funcionar, pero no se probaron.

## Alojarlo

Subir **el contenido** de `juego/` a cualquier hosting estático:

- **GitHub Pages**: subir los archivos a la rama/carpeta publicada (el `.nojekyll` ya está).
- **Netlify / Vercel / Cloudflare Pages**: arrastrar la carpeta o publicarla como directorio estático, sin comando de build.
- **itch.io**: comprimir el *contenido* de `juego/` (con `index.html` en la raíz del zip) y subirlo como proyecto HTML5. Tamaño de ventana sugerido 1280x720, con la opción de pantalla completa activada.
- **Apache / Nginx / IIS**: copiar los archivos a una carpeta pública.

Recomendaciones del servidor:
- Servir `.wasm` con el tipo MIME `application/wasm`. Casi todos los servidores ya lo hacen; si no, el juego igual carga (Emscripten usa un método más lento), pero conviene configurarlo.
- Activar compresión gzip o brotli para `.wasm`, `.js` y `.data`: los reduce bastante.
- **No** hacen falta las cabeceras COOP/COEP (el juego no usa hilos) ni HTTPS obligatorio. HTTPS es recomendable igual.
- Los nombres de archivo no llevan hash. Al publicar una versión nueva, conviene invalidar la caché o agregar `?v=N` a las URLs (ver `API_JAVASCRIPT.md`, `locateFile`).

## Qué tiene que saber quien diseñe la página

1. **El juego dibuja todo dentro de un `<canvas id="canvas">`** y lo ajusta siempre al tamaño de la *ventana* del navegador (`window.innerWidth` x `window.innerHeight`). Si la página tiene que mostrar el juego en un recuadro más chico, la forma correcta es **ponerlo en un `<iframe>`** (verificado). Ver `API_JAVASCRIPT.md`.
2. **El audio solo puede arrancar con un gesto del usuario** (regla de los navegadores). Por eso existe el botón JUGAR: al hacer clic llama a `Module._pg_unlock_audio()`. Si se rediseña el menú, ese llamado tiene que seguir dentro del manejador del clic.
3. **La partida se guarda sola** en el navegador (IndexedDB) cada 5 segundos y al cerrar/ocultar la pestaña. Es por navegador y por dominio: si se cambia el dominio, los jugadores empiezan de cero.
4. **La pantalla completa la maneja la página**, no el juego (botón y tecla F11).
5. La interfaz del juego está en español e inglés: elige sola según el idioma del navegador la primera vez y el jugador la cambia con la tecla I o las banderas.
6. Se juega con mouse y teclado: Espacio golpe · 1-0 comprar · B cantidad · M maletín · L logros · I idioma · T temblor · N música · flechas arriba/abajo volumen · F11 pantalla completa. Detalle de mecánicas en `docs/GAME_DESIGN.md`.

## Modificar el juego (no solo la página)

Para cambiar el juego en sí, trabajá sobre el repositorio C++ y compilá con `web\build_web.ps1` (ver [docs/README.md](docs/README.md)). Para incorporar al repositorio los cambios de la página, sincronizá el HTML, el CSS y el JavaScript con `web/shell.html` y conservá la marca de Emscripten. Si llevás los archivos CSS y JS por separado, el proceso de compilación también debe copiarlos a la salida. Para actualizar solo el motor de este paquete, revisá la compatibilidad de la API y traé `index.js`, `index.wasm` e `index.data` juntos desde la misma compilación.

## Pruebas históricas del paquete original

Se sirvió la carpeta `juego/` tal cual está en este paquete y se probó en Chrome (modo sin ventana, render por software):
carga y menú · sin audio antes de JUGAR y audio activo después · teclado y clics · la página no se desplaza con Espacio/flechas · guardado en IndexedDB (216 bytes) y partida recuperada al recargar · `Module._pg_save()` · `Module.pauseMainLoop()` / `resumeMainLoop()` · el canvas sigue el tamaño de la ventana · funcionamiento dentro de un `<iframe>` de 800x450 · idioma forzado con `Module.arguments` · sin errores en la consola.

**No verificado:** Safari, Firefox, dispositivos móviles / pantallas táctiles, y la pantalla completa en un navegador real (el modo sin ventana no la permite).
