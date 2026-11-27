# Arquitectura de P.G: Imperio

Para qué sirve y cómo se juega: [README.md](README.md) y [GAME_DESIGN.md](GAME_DESIGN.md). Este documento explica cómo está armado el código y por qué.

## Origen
El juego nació como un `main.cpp` grande más `game.h` y `music.h`. La refactorización (ver [CHANGELOG.md](CHANGELOG.md)) lo dividió en módulos SIN cambiar el comportamiento, salvo unos pocos arreglos autorizados. Los archivos originales `game.h` y `music.h` ya no existen en la raíz: sus copias congeladas viven en `tests/reference/` y sirven de vara de medir.

## Diagrama de dependencias

```
                    main.cpp
                       |
                   src/app (App, config)
        +--------------+----------------+-------------+
        |              |                |             |
     src/ui        src/platform      src/audio      src/audio
  (raylib, modo    (escritorio/web   audio_player   music_synth ----+
   inmediato)       + steam_integ.)   (raylib)      (sin raylib)    |
        |              |                |                           |
        +------+-------+----------------+                           |
               v                                                    |
   +---------------------- pg_core (lib estática, SIN raylib) ------+--+
   |  src/game: game_data, economy, session, save_data, save_file    |
   |  src/i18n: i18n                                                 |
   |  src/audio: music_synth                                         |
   +-----------------------------------------------------------------+
               ^
               |
   tests/ (pg_tests) ---- tests/reference/ (código original congelado, independiente de src/)

Ejecutable CostaNeon = main + app + ui + platform + audio_player + steam_integration + pg_core + raylib
```
Regla: las flechas solo apuntan hacia abajo. `ui` depende de `game`; `game` no sabe que existe la interfaz.

## Mapa de módulos

| Carpeta | Responsabilidad | Por qué existe |
|---|---|---|
| `main.cpp` | Crea la `App` (estática), `Init`, bucle, `Shutdown`. | Que el punto de entrada sea mínimo. En la web usa `emscripten_set_main_loop_arg` y nunca vuelve. |
| `src/app/` | `App`: posee todo el estado y ordena el cuadro. `config.h`: constantes de la aplicación (1280x720 de diseño, autoguardado de 5 s, tope de dt de 0,1 s). | El orden del cuadro importa (azar y acciones de botones dependen de él) y debe estar escrito en un solo lugar. |
| `src/game/` | `game_data` (tablas: mejoras, hitos, ciudades, socios, misiones, logros, precio de la ciudad), `economy` (fórmulas puras sobre `SaveData`), `session` (reglas por cuadro: maletín, misiones, combo, redadas, compras, mudanza, logros), `save_data` (formato binario v1/v2, migración, saneamiento), `save_file` (E/S de disco con recuperación). | Núcleo del juego, sin raylib, para poder probarlo sin ventana. |
| `src/i18n/` | Idioma actual (entero global), `L(es, en)` y los nombres localizados de los datos. | Sacar el idioma del núcleo; los textos se eligen al mostrarlos. |
| `src/audio/` | `music_synth`: sintetizador house/techno (7 temas, estéreo 44,1 kHz), sin raylib. `audio_player`: RAII sobre dispositivo y flujo de raylib. | Poder probar la síntesis sin dispositivo de audio. |
| `src/platform/` | `platform.h` + `platform_desktop.cpp` o `platform_web.cpp` (ruta de guardado, idioma del sistema, ventana inicial, flush a IndexedDB, quién maneja la pantalla completa, capturas). `steam_integration` (único punto que toca el SDK). | Evitar `#ifdef` por toda la interfaz. |
| `src/ui/` | Interfaz de modo inmediato: `widgets` (botones, capas, contexto de entrada), `draw`, `text` (fuentes), `format` (dinero), `icons`, `flags`, `effects`, `background`, `theme`, `ui_state` y los paneles (`hud.h` declara; `top_bar`, `left_panel`, `upgrades_panel`, `right_panel`, `popups`, `overlays` implementan). | Todo el dibujo y las acciones de botones; solo presentación. |
| `tests/` | `pg_tests`: marco propio (`test_framework.h`), pruebas por área, `tests/data/` (guardados v1 y v2 reales), `tests/reference/` (original congelado). | Garantizar que la refactorización no cambió nada. |
| `web/` | `shell.html` (carga, menú JUGAR, pantalla completa, guardado al ocultar la página), `build_web.ps1`, `serve.ps1`. | Despliegue en navegador. |
| `steam/` | `STEAM.md`, `build_dist.ps1`, `upload.ps1`, `art/` (imágenes y logros). | Publicación en Steam. |
| `tools/` | `make_icon.cpp`, `make_steam_art.cpp` (solo escritorio, `EXCLUDE_FROM_ALL`). | Regenerar ícono e imágenes de Steam. |

## Reglas de dependencia
- `pg_core` (`game_data`, `economy`, `save_data`, `save_file`, `session`, `i18n`, `music_synth`) no incluye raylib y es lo único que linkean las pruebas. Eso permite correrlas en cualquier máquina, sin GPU ni audio.
- `CostaNeon` = `main.cpp` + `app` + `ui` + `platform` + `audio_player` + `steam_integration`, linkeado con `raylib` y `pg_core`.
- `steam_integration.cpp` está en `CostaNeon` y no en `pg_core` porque `USE_STEAM` es una definición PRIVADA del ejecutable. Sin `USE_STEAM` (y siempre en la web) todas sus funciones son stubs vacíos (`kSteamBuild == false`).
- CMake elige exactamente un archivo de plataforma: `platform_web.cpp` bajo Emscripten, `platform_desktop.cpp` en el resto.
- `ui` puede incluir `game`, `i18n`, `audio/music_synth.h` (el HUD toca volumen/música); `game` no puede incluir `ui`.
- `app/config.h` vive dentro de `app/` (se incluye como `"app/config.h"`) porque raylib trae su propio `config.h` y un header homónimo en la raíz de un include path chocaría.
- Los datos de logros usan punteros a función (`isUnlocked`) sobre `SaveData`; `game_data.h` declara `SaveData` por adelantado porque `save_data.h` necesita las cantidades de `game_data.h`.

## Ciclo de vida y cuadro
`App::Init`:
1. `SteamStart()` (antes de la ventana; si devuelve `RestartingThroughSteam`, `Init` devuelve false y el proceso termina).
2. Ventana oculta y redimensionable, `SetupInitialWindow`, lectura de `--lang`.
3. `Load()`: `LoadSaveFile` -> `SanitizeSave` -> idioma -> volumen/música -> ganancia offline (si el guardado tiene más de 60 s: hasta 8 h al 50 % del $/s) -> mensaje inferior.
4. Pantalla completa recordada (solo si el anfitrión no la maneja); audio (en escritorio ahora; en web con el primer gesto); fuentes; sincronización de logros con Steam.

`App::Frame` (cada cuadro, en este orden):
1. Web: arrancar audio si fue pedido o hay clic (respaldo del gesto).
2. Calcular dt (tope 0,1 s), escala y márgenes (la interfaz se escala centrada a 1280x720; el fondo se escala para cubrir toda la ventana), rellenar `UiContext` (mouse, clic, cuadro).
3. `HandleGlobalKeys` (F11/Alt+Enter, N, flechas, L, B, T, I).
4. Elegir la capa activa: logros/créditos 4, misión 3, maletín bajo el mouse 2, base 0.
5. `StepSimulation`: `Simulate` (ingreso, búsqueda, maletín, misión) y teclas de juego (espacio, M, 1-0, gamepad). Con créditos abiertos no pasa nada.
6. `UpdatePresentation`: hitos, efectos, combo, aviso de pista, temporizadores, dinero animado.
7. `Render`: `BeginDrawing`, fondo, `DrawHud` (los botones ejecutan acciones de `session` en el mismo punto del cuadro), maletín, efectos, misión, destellos, logros, créditos, avisos, `EndDrawing`.
8. `AfterFrame`: logros nuevos (aviso + Steam), callbacks de Steam, F12 (si corresponde), autoguardado cada 5 s.

`Shutdown`: guarda, detiene audio, descarga fuentes, `CloseWindow`, `SteamShutdown`. En la web el bucle no vuelve, así que `Shutdown` y los destructores no corren (por eso `App` es `static` en `main`); el guardado ocurre por autoguardado y por `pg_save` (pagehide/visibilitychange).

## Hilos
- Hilo principal: todo menos la síntesis.
- Hilo de audio (miniaudio, en escritorio) llama al callback de raylib, que invoca `GlobalMusic().Render()`. La instancia es global porque `SetAudioStreamCallback` no admite datos de usuario.
- Compartido entre ambos: `volume_`, `enabled_` y `track_` de `MusicSynth` son `std::atomic` (`memory_order_relaxed`). Antes eran variables comunes (data race). El resto del estado de `Render` lo toca solo el hilo de audio. En la web el audio corre de otro modo (ver ROADMAP sobre `ScriptProcessorNode`) y no se verificó el modelo de hilos allí.
- `i18n` usa un entero global sin protección: solo lo toca el hilo principal.

## Formato de guardado y compatibilidad
- `SaveData` (v2) es un volcado directo de la estructura: 216 bytes. `SaveDataV1` (136 bytes, 7 mejoras y 3 socios) solo se lee para migrar. Los `static_assert` de `save_data.h` fijan tamaños y offsets, que deben ser idénticos en Windows x64 y wasm32.
- Reglas: no reordenar ni cambiar tipos; campos nuevos en `reserved[4]`; no reordenar logros (orden = bit); solo agregar logros al final (y las cantidades `kNum*` definen tamaños de arreglos: cambiarlas rompe el formato).
- Migración v1 -> v2: se copian campos comunes; las mejoras 3..6 pasan a 4..7 (se insertó "Red de informantes" en el índice 3); `moves` se reconstruye.
- `SanitizeSave` (tras cada lectura): no finitos -> 0, negativos -> 0, `heat` 0..100, `city` 0..3, `owned` 0..4000, socios 0/1, `fame` y `laps` acotados, contadores >= 0, `vol` NaN -> 0,6 y si no 0..1, etc. No altera guardados normales (hay pruebas).
- Escritura (`WriteSaveFile`): archivo `.tmp` y luego reemplazo. Lectura (`LoadSaveFile`): principal, luego `.tmp`, luego rutas legadas (solo si el principal no existía). Un principal inválido se renombra a `save.dat.bad`.
- Rutas: escritorio `%APPDATA%\PG Imperio\save.dat` (cae a `save.dat` local); web `/persist/save.dat` en IDBFS (la página lo monta y hace `syncfs(true)` antes de arrancar; `FlushPersistentStorage` hace `syncfs(false)` sin encimar sincronizaciones). Steam Cloud (Auto-Cloud) apunta a la ruta de escritorio.

## Interfaz de modo inmediato
- Dibujo y manejo de entrada ocurren en la misma pasada: cada control llama `Interact(rect, enabled, capa, stableId)`, que lee el mouse, consume el clic y devuelve el estado animado (hover/presión), y luego se dibuja.
- Ids de controles: se calculan con posición y capa; los controles que se mueven (maletín, botones de misión) pasan un `stableId` fijo. La tabla de animaciones tiene 200 entradas con reemplazo del menos usado recientemente (antes se llenaba).
- Capas: 0 base, 2 maletín, 3 misión, 4 logros/créditos. Un control solo reacciona si su capa >= la capa activa; así las ventanas modales bloquean lo de atrás.
- Contexto de entrada global (`UiContext`), la `FontSet` activa y la escala se fijan una vez por cuadro. `FrameContext` pasa referencias (`Session`, `UiState`, `Effects`, `MusicSynth`, `RandomSource`, tiempo, color de acento) a cada panel.
- `UiState` (mensaje, dinero animado, popups) no se guarda ni pertenece a `Session`.

## Decisiones de diseño y por qué
- **`SaveData` se pasa explícitamente** a las funciones de economía (nada de estado global): permite probar con estados arbitrarios y comparar contra el original.
- **Orden exacto de las operaciones de punto flotante y de los sorteos al azar** (`RandomSource` inyectado: `GetRandomValue` en la app, un generador determinista en las pruebas). Las pruebas exigen igualdad bit a bit; reordenar una suma cambia el último bit y rompe el balance medido.
- **Referencias congeladas** (`tests/reference/ref_game.h`, `ref_music.h`): son pruebas de caracterización, no de especificación. Dicen "el código nuevo hace lo mismo que el viejo", incluidos defectos originales conservados a propósito. Editarlas haría que la prueba dejara de probar algo. Esos archivos se aíslan de `src/` (`ref_api.h` usa solo tipos planos) y se comparan campo por campo.
- **Textos con `L(es, en)` en línea** en vez de una tabla de claves: decidido con el usuario por bajo riesgo (son pocos, español e inglés se leen lado a lado, no requiere herramientas ni cambia el comportamiento). Los datos de `game_data` llevan ambos idiomas por fila y `i18n` elige.
- **Sin marco de pruebas externo**: `test_framework.h` (TEST, CHECK, CHECK_EQ) mínimo, para no sumar dependencias.
- **Plataforma por selección de archivo en CMake**, no por `#ifdef` en la UI.
- **Arreglos autorizados** respecto del original (todo lo demás debe ser idéntico): fases de osciladores acotadas a [0,1) (se desafinaba tras ~15 s o más), volumen/música/pista atómicos, ids estables y reemplazo LRU de estados de botón, temporizador de misión pausado con el panel de logros abierto, volumen inválido del guardado acotado, conversión a entero saturada en la fama, fuga al cargar fuentes, verificación de dispositivo de audio, escritura atómica y `.bad`.

## Web (resumen técnico)
Emscripten + raylib `PLATFORM=Web`. Opciones de enlace relevantes (en `CMakeLists.txt`): `-sUSE_GLFW=3`, memoria que crece (inicial 64 MB), `-lidbfs.js`, `FORCE_FILESYSTEM`, exportadas `_main`, `_pg_save`, `_pg_unlock_audio`, métodos de runtime `FS, addRunDependency, removeRunDependency, HEAPF32` (HEAPF32 lo necesita el miniaudio de raylib 5.5 con Emscripten reciente). Fuentes empaquetadas con `--preload-file`. El audio se inicia dentro del clic en JUGAR (`pg_unlock_audio`) por la política de autoplay; hay un respaldo en el primer clic dentro de `Frame`. Pantalla completa: la maneja `shell.html`.

## Verificación y límites conocidos
La estructura se probó con `pg_tests` (58 pruebas) y la compilación nativa. La interfaz no tiene pruebas automáticas. La compilación con Steam y el comportamiento en un navegador real de pantalla completa y táctil no se verificaron (ver [ROADMAP.md](ROADMAP.md)).
