# P.G: Imperio (C++ / raylib)

Juego incremental ("clicker") de estética neón/synthwave: das golpes, comprás mejoras y negocios, contratás socios, esquivás redadas, te mudás entre 4 ciudades y apuntás a comprar la ciudad. Escrito en C++17 con raylib 5.5; corre en Windows (nativo, con integración opcional con Steam) y en el navegador (WebAssembly). La música house/techno se genera por código, sin archivos de audio.

- Diseño del juego (mecánicas, economía, balance): [GAME_DESIGN.md](GAME_DESIGN.md)
- Arquitectura y decisiones técnicas: [ARCHITECTURE.md](ARCHITECTURE.md)
- Instrucciones para Claude Code: [CLAUDE.md](CLAUDE.md) · para otros agentes de IA: [AGENTS.md](AGENTS.md)
- Historial de cambios: [CHANGELOG.md](CHANGELOG.md) · pendientes e ideas: [ROADMAP.md](ROADMAP.md)
- Publicación en Steam: [steam/STEAM.md](steam/STEAM.md)

## Compilar en Windows (nativo)
1. Instalar Visual Studio Build Tools (carga de trabajo "Desarrollo de escritorio con C++"), CMake y Git.
2. En esta carpeta (necesita internet la primera vez para bajar raylib con FetchContent):
   ```
   cmake -B build-native -G "Visual Studio 17 2022"
   cmake --build build-native --config Release
   ```
   El nombre de la carpeta de compilación es libre (antes se usaba `build`); las carpetas `build/` y `build-*/` están en `.gitignore`.
3. El ejecutable queda en `build-native\Release\CostaNeon.exe`. La carpeta `assets\` se copia sola al lado del .exe. El runtime de C++ es estático (el jugador no necesita el Visual C++ Redistributable).

## Pruebas
El objetivo `pg_tests` (opción `PG_BUILD_TESTS`, activada por defecto, solo en compilación nativa) se compila junto con el juego:
```
build-native\Release\pg_tests.exe
ctest --test-dir build-native -C Release --output-on-failure
```
Hoy son 58 pruebas y pasan. Comparan el núcleo del juego bit a bit contra copias congeladas del código original (`tests/reference/`); ver [ARCHITECTURE.md](ARCHITECTURE.md).

## Compilar para la web (navegador)
1. Instalar emsdk (https://emscripten.org/docs/getting_started/downloads.html), por defecto en `%USERPROFILE%\emsdk`:
   ```
   git clone https://github.com/emscripten-core/emsdk.git %USERPROFILE%\emsdk
   cd %USERPROFILE%\emsdk ; emsdk install latest ; emsdk activate latest
   ```
   emsdk necesita Python 3 en el PATH. También hace falta Ninja: el script usa el que trae Visual Studio/Build Tools, o el del PATH (`winget install Ninja-build.Ninja`), o `mingw32-make`.
2. Compilar (necesita internet la primera vez para bajar raylib):
   ```
   powershell -ExecutionPolicy Bypass -File web\build_web.ps1
   ```
   (opcional: `-Emsdk C:\otra\carpeta`). La salida es un sitio estático en `build-web\web` (index.html, .js, .wasm, .data, favicon.png, .nojekyll).
3. Probar en local: `web\serve.ps1` y abrir http://localhost:8080 (necesita Python o Node/npx). Abrir index.html con doble click (file://) no funciona.
4. Publicar: subir el contenido de `build-web\web` a cualquier hosting estático (GitHub Pages, itch.io con index.html en la raíz del zip, Netlify, etc.).

Particularidades de la web:
- La partida se guarda en IndexedDB (IDBFS montado en `/persist`), por navegador: no se comparte entre navegadores ni dispositivos.
- El audio arranca recién al apretar JUGAR (los navegadores exigen un gesto del usuario).
- Steam está desactivado. La página (`web/shell.html`) maneja la pantalla completa (F11 o botones).

## Steam
Todo el proceso (SDK, logros, Cloud, imágenes, subida) está en [steam/STEAM.md](steam/STEAM.md). Resumen:
- Compilar con Steam: `-DUSE_STEAM=ON -DSTEAM_APPID=...` y el SDK en `./steamworks_sdk` (no se versiona).
- `steam\build_dist.ps1 -AppId N` compila con Steam y arma `dist\`; `steam\upload.ps1` sube `dist\` con SteamPipe.
- Imágenes de tienda e íconos de logros: `cmake --build build-native --config Release --target make_steam_art` y luego ejecutar `make_steam_art.exe` desde esta carpeta (genera `steam\art\`).
- Nota: la ruta con Steam no se pudo compilar contra el SDK real durante la refactorización (solo se verificó el tipado con un stub). Ver [ROADMAP.md](ROADMAP.md).

## Ejecutar
`build-native\Release\CostaNeon.exe`. Argumento opcional: `--lang es` o `--lang en` para forzar el idioma.

## Controles
Espacio golpe · 1-0 comprar · B cantidad (x1/x10/MÁX) · M maletín · L logros · I idioma (español/inglés) · T temblor · N música · Flechas arriba/abajo volumen · F11 pantalla completa (Alt+Enter también, en escritorio) · F12 captura (solo escritorio sin Steam; con Steam lo maneja el overlay). Hay soporte básico de gamepad (botón inferior = golpe, izquierdo = maletín).

## Dónde se guarda la partida
- Windows: `%APPDATA%\PG Imperio\save.dat` (binario, 216 bytes, formato v2; se migra el v1 de 136 bytes). Si había un `save.dat` al lado del .exe o en el directorio actual (versiones anteriores), se carga solo la primera vez.
- Web: `/persist/save.dat` dentro de IndexedDB del navegador.
- Autoguardado cada 5 s y al cerrar. Un archivo ilegible se aparta como `save.dat.bad`. Detalles en [ARCHITECTURE.md](ARCHITECTURE.md).

## Estructura de carpetas
- `main.cpp`: punto de entrada mínimo (crea `pg::App`, corre el bucle).
- `src/app/`: `App` (ciclo de cuadro, orden de los pasos) y `config.h`.
- `src/game/`: núcleo sin raylib: `game_data` (tablas), `economy` (fórmulas), `session` (reglas por cuadro), `save_data` (formato, migración, saneamiento), `save_file` (disco).
- `src/i18n/`: idioma y textos localizados (`L(es, en)`).
- `src/audio/`: `music_synth` (sintetizador, sin raylib) y `audio_player` (dispositivo y flujo de raylib).
- `src/platform/`: diferencias escritorio/web (`platform_desktop.cpp` / `platform_web.cpp`) e integración con Steam (`steam_integration`).
- `src/ui/`: toda la interfaz (modo inmediato, raylib).
- `tests/`: pruebas (`pg_tests`), `tests/reference/` (código original congelado, no editar), `tests/data/` (guardados de ejemplo v1 y v2).
- `web/`: `shell.html`, `build_web.ps1`, `serve.ps1`.
- `steam/`: `STEAM.md`, scripts `build_dist.ps1` / `upload.ps1`, imágenes en `steam/art/`.
- `tools/`: `make_icon.cpp` (regenera `assets/icon.*`) y `make_steam_art.cpp`; ambos con `EXCLUDE_FROM_ALL` (no se compilan por defecto).
- `assets/`: fuente Poppins (licencia SIL OFL, ver `OFL.txt`) e ícono (`icon.ico`/`icon.png`; el .ico se mete en el .exe con `app.rc`). Para regenerar el ícono: `cmake --build build-native --config Release --target make_icon` y ejecutar `make_icon.exe` desde esta carpeta.
- `backup_original/`, `backup_pre_refactor/`: copias del código anterior, solo de referencia histórica (no forman parte de la compilación).

## No portado
Respecto de la versión original: conexión con Spotify (en C++ requeriría libcurl y un servidor local para el login OAuth) y sonidos de efectos. (La traducción al inglés ya existe: tecla I.)
