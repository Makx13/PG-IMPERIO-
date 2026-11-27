(function () {
  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('canvas'), loading = $('loading'), menu = $('menu'),
      bar = $('bar'), statusEl = $('status'), playBtn = $('play'), hud = $('hud-fs');
  var playing = false, failed = false, ready = false;

  function setProgress(p) { bar.style.width = Math.max(0, Math.min(100, p)) + '%'; }

  function fail(msg) {
    if (failed) return;
    failed = true;
    loading.classList.add('error');
    loading.style.display = 'flex';
    $('load-title').textContent = 'Algo salió mal';
    statusEl.textContent = msg || 'No se pudo cargar el juego. Probá recargar la página.';
    menu.classList.remove('show');
    hud.classList.remove('show');
  }

  function showMenu() {
    if (failed || ready) return;
    ready = true;
    setProgress(100);
    loading.style.display = 'none';
    menu.classList.add('show');
    playBtn.disabled = false;
    playBtn.focus();
  }

  // Pantalla completa
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFs() {
    var el = document.documentElement;
    try {
      if (isFs()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        var r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        if (r && r.catch) r.catch(function (e) { console.warn(e); });
      }
    } catch (e) { console.warn(e); }
  }
  $('menu-fs').addEventListener('click', toggleFs);
  hud.addEventListener('click', function () { toggleFs(); canvas.focus(); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'F11' || e.keyCode === 122) { e.preventDefault(); toggleFs(); return; }
    // Evita que el espacio y las flechas scrolleen la pagina
    if (playing && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
                    e.code === 'ArrowLeft' || e.code === 'ArrowRight')) e.preventDefault();
  }, { capture: true });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); fail('Se perdió el contexto gráfico. Recargá la página.'); });

  // JUGAR: desbloquea el audio (gesto del usuario) y muestra el juego
  playBtn.addEventListener('click', function () {
    try { if (Module._pg_unlock_audio) Module._pg_unlock_audio(); } catch (e) { console.warn(e); }
    playing = true;
    menu.classList.remove('show');
    hud.classList.add('show');
    canvas.focus();
  });
  // Al volver a tocar el canvas, que tenga el foco para el teclado
  canvas.addEventListener('pointerdown', function () { canvas.focus(); });

  // Guardado: la parte C++ hace el syncfs
  function save() { try { if (Module._pg_save) Module._pg_save(); } catch (e) { console.warn(e); } }
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); });

  window.onerror = function (msg) {
    console.error(msg);
    if (!ready) fail('Ocurrió un error al cargar el juego. Probá recargar la página.');
    else if (/abort|unreachable|memory/i.test(String(msg))) fail('El juego se detuvo por un error. Recargá la página (tu partida está guardada).');
  };
  window.addEventListener('unhandledrejection', function (e) { console.warn(e.reason); });

  // ---- Module de Emscripten ----
  var totalDeps = 0;
  window.Module = {
    canvas: canvas,
    print: function (t) { console.log(t); },
    printErr: function (t) { console.warn(t); },
    preRun: [function (mod) {
      // Persistencia: IDBFS en /persist, el arranque espera a que cargue
      var M = mod || window.Module;
      var fs = M.FS || window.FS;
      var idb = M.IDBFS || (typeof IDBFS !== 'undefined' ? IDBFS : (fs.filesystems && fs.filesystems.IDBFS));
      var add = M.addRunDependency || window.addRunDependency;
      var rem = M.removeRunDependency || window.removeRunDependency;
      try {
        fs.mkdir('/persist');
        fs.mount(idb, {}, '/persist');
        add('pg-idbfs');
        fs.syncfs(true, function (e) { if (e) console.warn(e); rem('pg-idbfs'); });
      } catch (e) {
        console.warn('IDBFS no disponible, la partida no se va a guardar', e);
      }
    }],
    postRun: [function () { showMenu(); }],
    onRuntimeInitialized: function () { showMenu(); },
    onAbort: function (what) { console.error(what); fail('El juego se detuvo por un error. Recargá la página.'); },
    setStatus: function (text) {
      if (failed || ready) return;
      var m = /([^(]+)\((\d+(?:\.\d+)?)\/(\d+)\)/.exec(text);
      if (m) {
        setProgress(100 * parseFloat(m[2]) / parseFloat(m[3]));
        statusEl.textContent = 'Cargando... ' + Math.round(100 * parseFloat(m[2]) / parseFloat(m[3])) + '%';
      } else if (text) {
        statusEl.textContent = 'Cargando...';
      }
    },
    monitorRunDependencies: function (left) {
      totalDeps = Math.max(totalDeps, left);
      if (failed || ready) return;
      if (left) {
        // Progreso aproximado por dependencias pendientes (descarga de .data / lectura de la partida)
        if (totalDeps > 0 && !/\d%/.test(statusEl.textContent)) setProgress(100 * (totalDeps - left) / totalDeps);
        statusEl.textContent = 'Cargando... (' + (totalDeps - left) + '/' + totalDeps + ')';
      } else {
        statusEl.textContent = 'Iniciando...';
      }
    }
  };
  Module.setStatus('Descargando...');
})();
