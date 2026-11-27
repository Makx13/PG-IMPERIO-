# P.G: Imperio (Costa Neon) - Diseño del juego

Documento de referencia de mecánicas y balance. Todos los números salen del código (`src/game/game_data.cpp`, `src/game/economy.cpp`, `src/game/save_data.h`, `src/audio/music_synth.*`, `web/shell.html` y las reglas por cuadro de `main.cpp` en el commit HEAD). Lo que no figura en el código y es una interpretación se marca "(inferido)".

Referencias de código: tablas en `src/game/game_data.*`, fórmulas puras en `src/game/economy.*`, guardado en `src/game/save_data.*` y `src/game/save_file.*`. Las reglas "por cuadro" (decaimiento de búsqueda, temporizadores, redadas, misiones, ganancia offline) vivían en `main.cpp` al momento de escribir esto; si se mueven en el refactor, buscar los mismos números.

---

## 1. Resumen

Juego idle/clicker de un imperio "neón" costero. Se empieza en la ciudad P.G dando golpes (clic o Espacio), se compran mejoras y negocios que generan dinero por clic y por segundo, se contratan socios con efectos permanentes y se "muda" el imperio a otra ciudad (prestigio) a cambio de fama. Hay 4 ciudades en ciclo; completar el ciclo da una vuelta (x1.5 permanente).

**Objetivo final:** comprar la ciudad por `kCityPrice = 1e10` ($10.000 M). Requiere tener `money >= 1e10`; el botón aparece solo si `!ended`. Comprar descuenta 1e10, pone `ended = 1` y muestra los créditos (se puede "Seguir jugando"). Con los créditos abiertos la simulación se pausa.

Idiomas: español (`lang = 1`) e inglés (`lang = 2`); `0` = detectar el del sistema. Cada fila de las tablas trae ambos textos.

## 2. Bucle de juego

1. Dar golpes -> dinero (`IncomePerClick` x combo). Cada golpe sube la búsqueda (heat).
2. Gastar en mejoras por clic (4) y negocios que dan $/s (6).
3. Contratar socios (compra única, se conservan al mudarse).
4. Mudarse a la ciudad siguiente cuando se ganó lo suficiente en la ciudad actual: da fama (+10% a todo cada punto), reinicia dinero y mejoras.
5. Al volver a P.G tras las 4 ciudades: vuelta, x1.5 permanente. Repetir hasta juntar 1e10 y comprar la ciudad.
6. En paralelo: maletines (bonus aleatorio con tiempo límite), misiones (apuesta riesgo/premio), redadas (castigo por golpear demasiado), logros.

## 3. Economía y reglas (fórmulas exactas)

Notación: `n = owned[i]` (unidades de la mejora i), `g = costGrowth`, `s` = estado guardado.

### 3.1 Multiplicadores

```
hitos(i)         = cantidad de valores de {25,50,100,200,300,400,500} que cumplen owned[i] >= valor
UpgradeMult(i)   = 2 ^ hitos(i)
LapMultiplier    = 1.5 ^ laps
GlobalMultiplier = (1 + 0.1 * fame) * ciudad.allMul * 1.5^laps
HeatMultiplier   = ciudad.heatMul * (Rosa ? 0.6 : 1)
LossMultiplier   = Tito ? 0.5 : 1
```

### 3.2 Ingreso

```
UpgradeOutput(i)  = baseOutput[i] * owned[i] * UpgradeMult(i)           (antes del multiplicador global)
Ingreso/s         = Global * (suma UpgradeOutput de los negocios, i = 4..9) * (Vera ? 1.5 : 1)
ClickPercent      = 0.01 + (Dante ? 0.03 : 0)                            (1% o 4% del $/s)
Ingreso/clic      = Global * ciudad.clickMul * (Dante ? 1.25 : 1) * (1 + suma UpgradeOutput de las mejoras por clic, i = 0..3)
                    + Ingreso/s * ClickPercent
```

- El "1 +" es el golpe base de $1.
- El % del $/s queda fuera de `ciudad.clickMul` y de `Dante x1.25`, pero `Ingreso/s` ya incluye el global y a Vera.
- Cada cuadro: `Earn(Ingreso/s * dt)` (suma a dinero, a `run` y a `total`) y `time += dt`. Con los créditos abiertos no corre.

### 3.3 Golpe y combo

Cada golpe (botón, clic en el botón o Espacio / A del gamepad):

```
combo++ ; comboT = 1 s (kComboWindow) ; bestCombo = max(bestCombo, combo)
ganancia = Ingreso/clic * ComboMultiplier(combo)
ComboMultiplier(c) = 1 + min(max(c - 1, 0), 100) * 0.01     (+1% por golpe desde el 2.o; tope x2.00 en el golpe 101)
clicks++ ; heat = min(100, heat + 0.6 * HeatMultiplier)
```

- Si pasa 1 s sin golpear, el combo vuelve a 0 (aviso si era >= 10). Una redada también lo pone en 0.
- El combo multiplica todo el valor del clic, incluido el componente de % del $/s.
- Avisos de combo en 10, 25, 50 y cada múltiplo de 100.

### 3.4 Costos y compra

```
UnitCost(i)        = ceil(baseCost * g^n)                          (próxima unidad)
CostOfUnits(i, k)  = ceil( baseCost * g^n * (g^k - 1) / (g - 1) )  (se redondea el total, no cada unidad)
```

- `g = 1.17` en mejoras por clic y `1.15` en negocios.
- Modos de compra (`buyMode`): 0 = x1, 1 = x10, 2 = MÁX. Cambia con la tecla B o con los botones x1/x10/MÁX. La cantidad comprada es `1`, `10` o `max(1, MaxAffordable)`.
- `TryBuy(i, k)`: si `money < CostOfUnits(k)` no hace nada. Ojo: en x10 se compran 10 o ninguna (no compra "las que alcance").
- `MaxAffordable`: se estima `k = floor( log(money*(g-1)/c0 + 1) / log(g) )` con `c0 = baseCost * g^n` (sin ceil), se limita a >= 0 y se baja de a uno mientras `CostOfUnits(k) > money`. Solo corrige hacia abajo. Peculiaridad: si el dinero es exactamente el costo de k+1 unidades, el estimado en punto flotante puede quedar apenas por debajo de k+1 y devolver k (nunca corrige hacia arriba). En modo MÁX, si no alcanza ni para una, `BuyAmount` devuelve 1 (la compra falla por falta de dinero).
- Atajos 1-9 y 0 compran las mejoras 0-9 con la cantidad del modo actual, solo si la mejora está desbloqueada.

### 3.5 Hitos x2

Cuando `owned[i]` llega a 25, 50, 100, 200, 300, 400 y 500 la salida de esa mejora se duplica (acumulativo: con 500 unidades es x128). Aviso "Hito" al cruzarlo. La interfaz muestra cuántas faltan para el próximo.

### 3.6 Desbloqueo de mejoras

Una mejora i se muestra/compra si se cumple alguna:

```
i == 0  ||  i == 4  ||  owned[i] > 0  ||  owned[i-1] > 0  ||  total >= baseCost[i] * 0.4
```

(0 = primera por clic, 4 = primer negocio; `total` es lo ganado en toda la partida, no baja nunca.)

### 3.7 Maletín

- Aparece en una posición aleatoria (x 460-820, y 160-580) y dura 10 s (`caseLife = 10`); se agarra con clic o tecla M / X del gamepad.
- Temporizador: arranca en 40 s; al llegar a 0 se reinicia a `45 + rnd01()*45` (45-90 s) y, si no hay otro en pantalla, aparece uno. El temporizador baja a doble velocidad con Luna (`caseT -= dt * 2`), o sea frecuencia el doble.
- Valor: `BriefcaseValue = Ingreso/s * 60 + Ingreso/clic * 40`, multiplicado por `ciudad.casesMul` (Bahía Sombra x2). Se suma con `Earn`; `cases++`.

### 3.8 Misiones

- Temporizador `misT`: arranca en 90 s; cuando llega a 0 y no hay misión abierta, se reinicia a `120 + rnd01()*60` (120-180 s) y, solo si `total >= 500`, se abre una misión al azar (uniforme entre las 8). Si ya había una abierta, el temporizador queda en 0 y la siguiente aparece apenas se resuelve.
- Tiempo límite: 20 s (`misLife`). Si vence, equivale a no elegir (`pick = 2`: sin premio ni castigo, no cuenta como resuelta).
- Recompensa si sale bien: `Ingreso/s * segundos + Ingreso/clic * 30`. Los segundos y la probabilidad dependen de la opción (tabla 4.5).
- Opciones con probabilidad 0 ("Rechazar", "Ignorar", etc.): sin riesgo ni premio; no suman a `done`.
- Cualquier opción con probabilidad > 0 suma `done++` (misiones resueltas) y tira `rnd01() < chance`.
- Si sale mal: pierde `floor(money * 0.08 * LossMultiplier)` (8%, o 4% con Tito) y `heat = min(99, heat + 25)` (nunca dispara redada por sí solo).

### 3.9 Búsqueda (heat) y redadas

- Rango 0-100. Cada golpe suma `0.6 * HeatMultiplier` (Rosa x0.6, Bahía Sombra x0.5; juntos x0.3 = 0.18 por golpe).
- Decaimiento por segundo: `0.5 + min(TotalOwned, 100) * 0.01` (de 0.5/s sin mejoras hasta 1.5/s con 100 o más unidades en total), mínimo 0.
- Al llegar a 100 tras un golpe: redada. `lost = floor(money * 0.10 * LossMultiplier)` (10%, o 5% con Tito); `heat = 40`; `raids++`; combo a 0. No hay otra consecuencia.
- Interfaz: alerta visual desde 50%, aviso de texto sobre 75%.

### 3.10 Fama y mudanza

```
FameBase = floor( cbrt(run / 1e6) + 1e-9 )          (run = dinero ganado en la ciudad actual)
FameGain = Capitán ? floor(FameBase * 1.5) : FameBase
Umbral del próximo punto = (FameBase + 1)^3 * 1e6
```

- Cada punto de fama = +10% a todo el ingreso (suma lineal en `GlobalMultiplier`). El punto g exige `g^3` millones ganados en la ciudad (1, 8, 27, 64... M).
- Solo se puede mudar si `FameGain >= 1` (hace falta `run >= 1e6`).
- `MoveToNextCity`: `fame += FameGain`; `moves++`; `city = (city + 1) % 4`; si la nueva ciudad es 0, `laps++`.

| Se reinicia | Se conserva |
|---|---|
| `money`, `run`, `heat` (a 0), todas las `owned[]` | `total`, `fame`, `partner[]`, `laps`, `moves`, `clicks`, `cases`, `done`, `raids`, `bestCombo`, `ach`, `time`, ajustes |

(Combo y temporizadores en curso no se reinician explícitamente en `MoveToNextCity`; inferido: persisten.)

### 3.11 Vueltas

Cada vez que se vuelve a P.G tras recorrer las 4 ciudades, `laps++` y el multiplicador global se multiplica por 1.5 (`1.5^laps`, permanente). Saneamiento: `laps` máximo 1000.

### 3.12 Ganancias offline

Al cargar un guardado válido: `away = min(ahora - stamp, 28800)` (tope 8 h). Si `away > 60`: `Earn(Ingreso/s * away * 0.5)`, es decir 50% del $/s actual, con el estado recién cargado. No hay ganancia offline por clics ni maletines ni misiones.

## 4. Tablas de datos

### 4.1 Mejoras (índice = posición en `owned[]` y tecla 1-9, 0)

Costo de la unidad n = `ceil(base * g^n)`. "Salida" = por unidad, antes de multiplicadores.

| # | Nombre es | Nombre en | Costo base | Salida | g | Tipo |
|---|---|---|---|---|---|---|
| 0 | Guantes finos | Fine Gloves | 15 | +1 por clic | 1.17 | clic |
| 1 | Camioneta rápida | Fast Van | 220 | +6 por clic | 1.17 | clic |
| 2 | Equipo de confianza | Trusted Crew | 3.200 | +40 por clic | 1.17 | clic |
| 3 | Red de informantes | Informant Network | 48.000 | +300 por clic | 1.17 | clic |
| 4 | Puesto en la playa | Beach Stand | 30 | $1/s | 1.15 | negocio |
| 5 | Club nocturno | Nightclub | 420 | $8/s | 1.15 | negocio |
| 6 | Puerto deportivo | Marina | 5.500 | $55/s | 1.15 | negocio |
| 7 | Casino flotante | Floating Casino | 70.000 | $400/s | 1.15 | negocio |
| 8 | Hotel de lujo | Luxury Hotel | 1,2e6 | $2.800/s | 1.15 | negocio |
| 9 | Naviera del Golfo | Gulf Shipping Co. | 2e7 | $20.000/s | 1.15 | negocio |

### 4.2 Ciudades (orden del ciclo)

| # | Nombre es / en | Texto del bonus (es) | allMul | clickMul | heatMul | casesMul |
|---|---|---|---|---|---|---|
| 0 | P.G / P.G | Sin bonus: tu ciudad natal | 1.0 | 1.0 | 1.0 | 1.0 |
| 1 | Puerto Dorado / Gold Harbor | +25% a todo | 1.25 | 1.0 | 1.0 | 1.0 |
| 2 | Isla Cristal / Crystal Island | Clics x2 | 1.0 | 2.0 | 1.0 | 1.0 |
| 3 | Bahía Sombra / Shadow Bay | -50% búsqueda, maletines x2 | 1.15 | 1.0 | 0.5 | 2.0 |

Nota: el texto de Bahía Sombra no menciona el +15% a todo (`allMul = 1.15`), pero el código lo aplica.

### 4.3 Socios (compra única, orden = `PartnerId`)

| # | Nombre es / en | Costo | Efecto en código |
|---|---|---|---|
| 0 | Rosa, la contadora / Rosa, the Accountant | 5.000 | heat por golpe x0.6 (-40%) |
| 1 | Dante, el chofer / Dante, the Driver | 30.000 | clic x1.25 y `ClickPercent` 1% -> 4% del $/s |
| 2 | Luna, la hacker / Luna, the Hacker | 150.000 | temporizador del maletín x2 (aparecen el doble de seguido) |
| 3 | Tito, el abogado / Tito, the Lawyer | 1,5e6 | pérdidas de redada (10% -> 5%) y misión fallida (8% -> 4%) a la mitad |
| 4 | Vera, la inversora / Vera, the Investor | 5e7 | $/s x1.5 |
| 5 | El Capitán / The Captain | 1e9 | fama al mudarse x1.5 (floor) |

Se compran con clic en su fila si `money >= costo`; descuentan el costo del dinero.

### 4.4 Hitos

`25, 50, 100, 200, 300, 400, 500` (cada uno x2 sobre esa mejora).

### 4.5 Misiones

La recompensa de cada opción es `Ingreso/s * segundos + Ingreso/clic * 30`. Prob. 0 = sin riesgo ni premio (no cuenta como resuelta).

| # | Situación (es) | Opción A (prob., s de $/s) | Opción B (prob., s de $/s) |
|---|---|---|---|
| 0 | Un contacto te ofrece un cargamento sin papeles. | Aceptar (55%, 300 s) | Rechazar (0%) |
| 1 | Golpe al banco del puerto, pero hay policía cerca. | Entrar (40%, 900 s) | Esperar (90%, 60 s) |
| 2 | Un rival vende su club a buen precio. | Comprar (60%, 500 s) | Ignorar (0%) |
| 3 | Una periodista pregunta por tus negocios. | Sobornarla (50%, 200 s) | Entrevista falsa (80%, 80 s) |
| 4 | Un yate llega de madrugada con carga extraña. | Abordarlo (45%, 700 s) | Mirar de lejos (95%, 40 s) |
| 5 | El DJ del club pide más presupuesto para la fiesta. | Dárselo (70%, 350 s) | Negarte (0%) |
| 6 | Un inspector quiere revisar el casino. | Invitarle una cena (65%, 250 s) | Cerrar un día (90%, 90 s) |
| 7 | Te ofrecen apostar todo a una carrera de lanchas. | Apostar (35%, 1500 s) | Pasar (0%) |

Valor esperado en segundos de $/s (sin el término de 30 clics), calculable de la tabla: p. ej. misión 1 opción A = 0.40 x 900 = 360 s frente a 8% del dinero como castigo; misión 7 = 0.35 x 1500 = 525 s.

### 4.6 Logros (26)

**El orden de `kAchievements` es el orden de bits de `SaveData::ach` (bit i = logro i). Nunca reordenar ni insertar en el medio; solo agregar al final.** Los primeros 16 mantienen el orden de la versión 1. Cada logro se otorga una sola vez cuando su condición se cumple (se evalúa cada cuadro) y se informa a Steam con el `id`.

| Bit | id | Nombre es | Condición |
|---|---|---|---|
| 0 | first | Primer billete | `total >= 1` |
| 1 | k | Mil en el bolsillo | `total >= 1e3` |
| 2 | m | Millonario | `total >= 1e6` |
| 3 | club | Dueño de la noche | `owned[5] >= 1` (Club nocturno) |
| 4 | casino | La casa siempre gana | `owned[7] >= 1` (Casino flotante) |
| 5 | move | Nueva ciudad | `moves >= 1` |
| 6 | case | Cazador de maletines (5) | `cases >= 5` |
| 7 | c100 | Manos rápidas (100 clics) | `clicks >= 100` |
| 8 | c1k | Dedos de acero (1.000) | `clicks >= 1000` |
| 9 | c10k | Tendinitis (10.000) | `clicks >= 10000` |
| 10 | m5 | Hombre de negocios (5 misiones) | `done >= 5` |
| 11 | pall | Equipo completo | los 6 socios contratados |
| 12 | rich | Mil millones | `total >= 1e9` |
| 13 | city3 | Trotamundos (3 mudanzas) | `moves >= 3` |
| 14 | own25 | Veinticinco puestos | `owned[4] >= 25` (Puesto en la playa) |
| 15 | end | Dueño de la ciudad | `ended != 0` |
| 16 | hotel | Cinco estrellas | `owned[8] >= 1` |
| 17 | ship | Rey del Golfo | `owned[9] >= 1` |
| 18 | o100 | Producción en serie (100 de algo) | `MaxOwned >= 100` |
| 19 | lap | Vuelta completa | `laps >= 1` |
| 20 | raid | Sobreviviste a una redada | `raids >= 1` |
| 21 | case25 | Coleccionista (25 maletines) | `cases >= 25` |
| 22 | m25 | Agenda llena (25 misiones) | `done >= 25` |
| 23 | t1 | Billonario (1 T en total) | `total >= 1e12` |
| 24 | combo50 | Imparable (combo de 50) | `bestCombo >= 50` |
| 25 | combo100 | Furia neón (combo de 100) | `bestCombo >= 100` |

Nombres en inglés: First Buck, A Grand in Your Pocket, Millionaire, Lord of the Night, The House Always Wins, New City, Briefcase Hunter (5), Quick Hands (100 clicks), Fingers of Steel (1,000), Tendinitis (10,000), Businessman (5 missions), Full Crew, Billion Dollar Baby, Globetrotter (3 moves), Twenty-Five Stands, Owner of the City, Five Stars, King of the Gulf, Mass Production (100 of one), Full Lap, Raid Survivor, Collector (25 briefcases), Full Schedule (25 missions), Trillionaire ($1T total), Unstoppable (50 combo), Neon Fury (100 combo).

## 5. Guardado

- Archivo `save.dat` (ruta según plataforma: `platform::SaveFilePath()`; en la web, almacenamiento persistente del navegador). Es un volcado binario directo de `SaveData`.
- **Autoguardado cada 5 s** (`saveT > 5`), más al cerrar y (web) al ocultar la página (`pg_save`). Antes de guardar se actualizan `stamp = time(nullptr)`, volumen y música.
- **Formato v2: 216 bytes.** No reordenar, quitar ni cambiar el tipo de miembros; los `static_assert` protegen tamaño y offsets (money@8, fame@40, clicks@64, owned@80, partner@120, ach@144, stamp@152, moves@160, vol@180, lang@192, reserved@200). Para campos nuevos usar `reserved[4]` manteniendo el tamaño.
- Qué se guarda: `ver, money, run, total, heat, fame, city, cases, done, ended, clicks, time, owned[10], partner[6], ach, stamp, moves, laps, raids, buyMode, music, vol, noShake, bestCombo, lang (0 auto / 1 es / 2 en), full, reserved[4]`.
- **Migración v1 -> v2** (136 bytes, 7 mejoras y 3 socios): se copian los campos comunes; mejoras 0-2 quedan en su lugar y los negocios 3-6 pasan a 4-7 (en v2 se insertó "Red de informantes" en el índice 3); `moves` se reconstruye: 0 si no tenía fama, si no `max(1, city)`. Tras migrar se muestra un aviso de partida actualizada.
- **Saneamiento** (`SanitizeSave`, se aplica siempre tras cargar, sin alterar partidas legítimas): doubles no finitos -> 0; `money/run/total/time` negativos -> 0; `heat` en [0,100]; `city` fuera de 0..3 -> 0; `owned[i]` en [0, 4000]; `partner[i]` a 0/1; `fame` en [0, 1e8]; `laps` en [0, 1000]; contadores negativos -> 0; `buyMode` y `lang` fuera de rango -> 0; `vol` NaN -> 0.6, si no [0,1]; `music, noShake, full, ended` a 0/1.
- **Robustez de disco** (`save_file.h`): se escribe `path.tmp` y se reemplaza; al leer se prueba el principal, luego `.tmp`, luego rutas legadas (solo si el principal no existía). Un principal inválido sin alternativa válida se renombra a `path.bad` (reemplazando uno previo) para que el autoguardado no lo pise.

## 6. Controles

| Entrada | Acción |
|---|---|
| Espacio / clic en "DAR UN GOLPE" / gamepad A (`RIGHT_FACE_DOWN`) | Golpe |
| M / clic en el maletín / gamepad X (`RIGHT_FACE_LEFT`) | Agarrar maletín |
| 1-9, 0 | Comprar mejora 0-9 (cantidad según x1/x10/MÁX) |
| B / botones x1, x10, MÁX | Cambiar cantidad por compra (cicla 0 -> 1 -> 2) |
| Clic en filas | Comprar mejoras, contratar socios, elegir opción de misión, mudarse, comprar la ciudad |
| L (Esc para cerrar) | Panel de logros |
| I / selector de idioma | Cambiar idioma es/en |
| N | Música on/off |
| Flechas arriba/abajo | Volumen (0.5 por segundo mantenido) |
| T | Temblor de pantalla on/off (`noShake`) |
| F11 / Alt+Enter | Pantalla completa (ventana sin bordes; en web lo maneja la página) |
| F12 | Captura de pantalla (solo en escritorio y sin Steam; con Steam lo maneja el overlay) |
| Enter | En los créditos: "Seguir jugando" |
| `--lang en` / `--lang es` | Argumento de línea de comandos que fuerza el idioma |

Las teclas de golpe y compra no actúan mientras hay una misión abierta o el panel de logros/créditos (capa de interfaz >= 3). La pantalla web muestra la misma lista de controles (`web/shell.html`: Espacio, 1-0, B, M, L, I, T, N, flechas, F11).

## 7. Música

Generada por código (`MusicSynth`, estéreo 44.1 kHz, sin archivos de audio). 7 temas, cada uno con BPM, acordes, patrones de bajo/stab/percusión/arpegio y timbre propios: Costa Neon (126 BPM), Medianoche (122), Autopista (130), Palmeras (118), Lluvia Acida (128; así, sin tilde, en el código), Amanecer (124), Neon Turbo (132). Cada tema dura 8 secciones x 8 compases = 64 compases (intro, groove, build, full, breakdown, drop, groove, full) y al terminar pasa al siguiente en bucle. El juego avisa "Suena: ..." al cambiar de tema. Volumen y estado on/off se guardan.

## 8. Notas de balance

- **Tope de ritmo:** la fama usa raíz cúbica de lo ganado en la ciudad (código: "cada punto cuesta más"); mudarse siempre reinicia dinero y mejoras, así que el prestigio compensa solo si el +10% por punto supera lo perdido (inferido).
- **Socios:** se conservan al mudarse (comentario del código); son la progresión permanente barata en comparación con la fama.
- **Combo:** premia golpear sin pausa con hasta x2 (tope en 101 golpes); la búsqueda y la redada son el contrapeso del spam de golpes (inferido).
- **Búsqueda:** el decaimiento crece con la cantidad total de mejoras (hasta 100 unidades), por lo que el castigo por golpear se alivia al progresar; Rosa, Bahía Sombra y Tito mitigan el sistema.
- **Misiones:** la opción B es la "segura" (prob. alta, premio chico) o directamente sin riesgo; las de riesgo pagan más en promedio solo si el castigo del 8% del dinero es menor al premio esperado (inferido). El premio escala con $/s, así que se mantiene relevante a cualquier etapa.
- **Maletín:** equivale a 60 s de $/s más 40 clics, escalado por ciudad y Luna; sirve de bonus activo.
- **Offline:** 50% del $/s con tope de 8 h y umbral de 60 s; recompensa volver sin hacer inútil jugar activo (inferido).
- **Vueltas:** x1.5 por vuelta es el único multiplicador exponencial; la fama es lineal (comentario del código: "cada vuelta completa de las 4 da x1.5 permanente").
- **Final:** la ciudad cuesta 1e10 y se compra con dinero actual, no con `total`; la barra de progreso hacia la meta es logarítmica (`log10(money)/log10(1e10)`).
- **Bug/rareza conocida:** `MaxAffordable` puede devolver k cuando el dinero cubre exactamente k+1 unidades (ver 3.4).
