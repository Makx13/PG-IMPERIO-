# Hoja de ruta

Pendientes conocidos (salidos de la auditoría de la refactorización) e ideas. Nada de esto está hecho. Las ideas NO son compromisos. Todo cambio de comportamiento requiere autorización del dueño del proyecto (ver [CLAUDE.md](CLAUDE.md)).

## Verificaciones pendientes (no se pudieron comprobar)
- Compilación con `-DUSE_STEAM=ON`: no se construyó durante la refactorización (no había SDK); solo se verificó el tipado contra un stub. Probar con el SDK real siguiendo [steam/STEAM.md](steam/STEAM.md).
- Pantalla completa en la web y uso táctil/móvil: no verificados en un navegador real.
- Comportamiento del audio web en distintos navegadores.

## Rendimiento por cuadro (de la auditoría; no medido con un perfilador en este documento)
- El fondo calcula unos 3000 `sinf` por cuadro (luces de ventanas de edificios).
- Unos 60 cortes de lote por cambio de modo de mezcla por cuadro, por `Glow`/`GlowText`.
- `MeasureTextEx` repetido sobre textos estáticos.
- `IncomePerClick`/`IncomePerSecond` se recalculan varias veces por cuadro.

## Comportamientos originales conservados a propósito (candidatos a revisar con el usuario)
- `MaxAffordable` solo corrige hacia abajo: si el dinero es exactamente el costo de k+1 unidades, puede devolver k.
- El color de acento de la ciudad (`acc`) se captura una vez por cuadro: tras mudarse queda desactualizado el resto de ese cuadro.

## Deuda técnica menor
- Si `Save()` falla, se registra una advertencia en cada autoguardado (cada 5 s).
- `ScriptProcessorNode` está deprecado en los navegadores; lo usa el miniaudio de raylib 5.5 en la web. Pasar a AudioWorklet requeriría una raylib más nueva o flags específicos.
- raylib 5.5 emite una advertencia de CMake por su `cmake_minimum_required`.
- `backup_original/` y `backup_pre_refactor/` están versionados y duplican código viejo; decidir si se conservan.
- `assets.zip` (sin versionar) en la raíz: no se verificó su contenido ni si se debe versionar o borrar.

## Funcionalidades no portadas (ya mencionadas en el README)
- Conexión con Spotify (en C++ requeriría libcurl y un servidor local para el login OAuth).
- Sonidos de efectos.

## Ideas (sin compromiso)
- Medir y reducir el costo por cuadro de los puntos de rendimiento de arriba, sin cambiar el aspecto.
- Agregar pruebas de interfaz mínimas o un modo de captura automatizado para la versión web.
- Integración continua que compile nativo y corra `pg_tests`.
- Compilar y probar la ruta de Steam en CI o localmente con el SDK.
