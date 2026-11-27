# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Más reciente primero. Fechas según `git log`.

## [Sin publicar] - Refactorización (2026-11-27)

Objetivo: dividir `main.cpp`, `game.h` y `music.h` en módulos sin cambiar el comportamiento del juego, con pruebas que lo demuestren. Los pasos 1 y 2 están en commits; el resto (módulo `session`, `src/app`, `src/ui`, `tests/test_session.cpp`, `GAME_DESIGN.md` y estos documentos) estaba sin commitear al escribir esta entrada.

### Añadido
- `src/game/`: `game_data` (tablas), `economy` (fórmulas puras sobre `SaveData`), `save_data` (formato v2 de 216 bytes, v1 de 136 bytes, `ParseSave`, `SanitizeSave`, `static_assert` de tamaño y offsets), `save_file` (E/S de disco) y `session` (reglas por cuadro: maletín, misiones, combo, redadas, compras, mudanza, logros; azar inyectado con `RandomSource`).
- `src/i18n/`: idioma y nombres localizados.
- `src/audio/`: `music_synth` (sintetizador sin raylib) y `audio_player` (RAII sobre dispositivo y flujo).
- `src/platform/`: `platform_desktop.cpp`, `platform_web.cpp` y `steam_integration` (con stubs si no hay `USE_STEAM`).
- `src/app/` (`App`, `config.h`) y `src/ui/` (interfaz dividida en paneles, widgets, efectos, fondo, etc.).
- Objetivo `pg_tests` (opción `PG_BUILD_TESTS`, solo nativo) con 58 pruebas y marco propio; `tests/reference/` con copias congeladas del código original (`ref_game.h`, `ref_music.h`) y `tests/data/` con guardados v1 y v2.
- Escritura de guardado por archivo temporal y reemplazo; lectura con recuperación (principal, `.tmp`, legados); archivo ilegible apartado como `save.dat.bad`.
- Verificación de `IsAudioDeviceReady` al iniciar el audio.
- `GAME_DESIGN.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `AGENTS.md`, `ROADMAP.md`; README actualizado.

### Cambiado
- `main.cpp` pasó de unas 600 líneas a un punto de entrada mínimo; `game.h` y `music.h` se movieron a `tests/reference/` como `ref_game.h` y `ref_music.h` (congelados) y se reescribieron como módulos.
- Las reglas con número suelto en `Frame()` ahora son constantes con nombre en `session.h`.
- `tools/make_steam_art.cpp` usa el nuevo `game_data.h`.
- CMake: biblioteca `pg_core` (sin raylib) compartida por el juego, las pruebas y las herramientas.

### Corregido (arreglos autorizados)
- Música: las fases de los osciladores se mantienen en [0,1) (antes se desafinaba a los pocos segundos o minutos).
- Data race: volumen, música encendida y tema actual son `std::atomic` (los lee el hilo de audio).
- Interfaz: ids estables de controles y reemplazo LRU de estados de botón (la tabla se llenaba).
- Misión: el temporizador se pausa mientras está abierto el panel de logros.
- Guardado: volumen inválido acotado al cargar; escritura atómica.
- Fama: conversión a entero con saturación (evita comportamiento indefinido con valores extremos).
- Fuga de memoria al fallar la carga de fuentes.

### Eliminado
- `game.h` y `music.h` de la raíz (ver Cambiado).
- Del README: el ítem "traducción al inglés" de "No portado todavía" (ya existe) y las referencias a `game.h`/`music.h`.

## Versión web / WebAssembly (previa a la refactorización; estado base commiteado el 2026-11-27)

El historial de git de esta etapa no está separado: llega en el commit base "Estado base antes de la refactorización (versión web funcional)". Se describe según el contenido de ese commit.

### Añadido
- Compilación con Emscripten (`web/build_web.ps1`, `web/serve.ps1`): sitio estático en `build-web\web` (index.html, .js, .wasm, .data, favicon.png, .nojekyll).
- Guardado en IndexedDB mediante IDBFS montado en `/persist`; `pg_save` exportado para `pagehide`/`visibilitychange`.
- Audio iniciado dentro del clic en JUGAR (`pg_unlock_audio`) por la política de autoplay.
- Página `web/shell.html` estilo synthwave: pantalla de carga con progreso, menú JUGAR, pantalla completa (F11 y botones), manejo de errores.
- CMake con rama nativa y rama web; Steam desactivado en la web.
- Idioma por `navigator.language` en la web.

### Corregido
- `HEAPF32` agregado a `EXPORTED_RUNTIME_METHODS` (lo necesita el miniaudio de raylib 5.5 con Emscripten reciente).
- El audio se arranca dentro del gesto del clic (antes quedaba bloqueado por el navegador).

## Versión original (línea base)
- Juego en C++/raylib 5.5 con `main.cpp`, `game.h` y `music.h`: golpes, mejoras por clic y negocios, socios, maletines, misiones, redadas, 4 ciudades, fama, logros, música generada, español e inglés, guardado en `%APPDATA%\PG Imperio\save.dat` (formato v2; migración desde v1) y integración opcional con Steam.
- Copias de esa etapa: `backup_original/` y `backup_pre_refactor/`.
