# PG-Imperio-Web

Paquete web estático de **P.G: Imperio**. Podés editar la página y probarla con un servidor local. El juego se ejecuta en el canvas mediante WebAssembly.

## Probalo en local

Desde esta carpeta, ejecutá con Python 3:

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory juego
```

Abrí [http://127.0.0.1:8080](http://127.0.0.1:8080) en un navegador con WebGL y WebAssembly. Usá siempre la misma dirección y puerto si querés conservar la partida de prueba en IndexedDB.

## Dónde hacer cada cambio

| Quiero cambiar o consultar | Archivo o carpeta |
|---|---|
| Textos, menú y estructura de la página | [juego/index.html](juego/index.html) |
| Colores, estilos y tamaños | [juego/estilos.css](juego/estilos.css) |
| Carga, botón JUGAR, audio, guardado o pantalla completa | [juego/arranque.js](juego/arranque.js) y [API JavaScript](API_JAVASCRIPT.md) |
| Plantilla del proyecto C++ para una futura compilación | [plantilla/shell.html](plantilla/shell.html) y [compilación del proyecto](docs/README.md) |
| Arte, logotipos y tipografía Poppins | [recursos/](recursos/) |
| Arquitectura, reglas, historial y pendientes | [docs/](docs/) |
| Inventario de archivos y opciones de alojamiento | [LEEME.md](LEEME.md) |

## Qué archivos necesita la página

Publicá el contenido completo de `juego/` cuando decidas desplegarlo. `arranque.js` configura el canvas y prepara `window.Module` antes de que se ejecute `index.js`. Ese cargador usa `index.wasm` e `index.data` de la misma compilación. Para servirlos alcanza un servidor estático. El servidor debe entregar el WASM como `application/wasm`.

Para editar mecánicas o generar nuevos binarios se necesita el repositorio C++17 con raylib 5.5 y Emscripten. La copia de la plantilla conserva el marcador del compilador. Los cambios de la página se hacen en `juego/`. Si después querés incluirlos en futuras compilaciones, incorporalos a la plantilla y al proceso de copia de archivos del repositorio siguiendo [LEEME.md](LEEME.md).

El favicon y el ícono cuadrado de recursos tienen los mismos bytes, igual que `header_capsule.png` y `library_header.png`. Se conservan sus nombres por sus usos de publicación y diseño. Conservá `OFL.txt` junto a las fuentes Poppins si las redistribuís.
