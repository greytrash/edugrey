# Spanish Road Anomaly

> **OPERACIÓN EUSKADI NORTE.** Montes verdes ahogados en niebla. Ni un pueblo
> en kilómetros: un caserío perdido, un dolmen, un cementerio sin lápidas.
> Te llamas **Gorka**. Esta noche recoges un paquete envuelto en papel marrón
> en una gasolinera de carretera. No debes abrirlo. En el soporte del
> salpicadero, un teléfono que suena cuando la carretera está más vacía:
> **Amaia**, tu mujer, nerviosa. Y después **él**. Él te dirá dónde parar.

Prototipo jugable en el navegador (ref. *Pacific Drive* × *Kentucky Route
Zero* × *Art of Rally*): un coche clásico modificado por las comarcales
despobladas del norte, tres cámaras, realismo estilizado (6 bandas toon,
contornos mínimos), curvas de montaña, tráfico escaso, faros reales, clima y
ciclo día/noche — y un **horizonte donde todo existe de verdad**: nada
aparece de repente.

![Prototipo — día](docs/preview.png)
![Prototipo — noche + lluvia](docs/preview-night-rain.png)

## Cómo ejecutar

- **Doble clic**: `dist/dalinian-standalone.html` (un solo archivo, Three.js
  embebido, sin servidor).
- **Desarrollo**: `python3 -m http.server 8099` en la raíz y abre
  `http://127.0.0.1:8099/` (los módulos ES necesitan HTTP).

## Controles

| Tecla | Acción |
|------|--------|
| `W` / `S` | gas / freno |
| `A` / `D` | volante (muerde con velocidad; menos agarre con lluvia o en la grava) |
| `C` | cámara ×3: **interior** → **chase** exterior → **isométrica** (estilo *Art of Rally*) |
| `R` | radio: 8 emisoras con síntesis en vivo + apagada |
| `+` / `-` | volumen de la radio |
| `H` | claxon (mantener) |
| `F` / `G` | teléfono: contestar / colgar |
| `L` | faros (foco real que ilumina la carretera) |
| `V` | lluvia + limpiaparabrisas animado |
| `Espacio` | freno de mano (bloquea las ruedas, la trasera se suelta) |
| `ratón` | arrastrar para mirar la cabina o por la ventanilla |
| `N` | hora del día · `P` | pausa |
| **mando** | stick izq. volante, gatillos gas/freno, stick der. mirar, `A`/`B` contestar/colgar, `X` claxon, `Y` cámara |
| **móvil** | botonera táctil automática: ◀ ▶ ▲ ▼, ✋ freno de mano, fila CAM · RADIO · LUZ · LLUVIA · HORA y 📢 claxon · ☎ contestar · ✕ colgar; arrastra el dedo para mirar |

## La misión — Gorka

1. **Recogida.** El aviso te guía 0,7 km hasta una gasolinera. Aparca junto
   al surtidor y una **cinemática orbital** te enseña la recogida: el motor
   calla, una puerta, el paquete de papel marrón aparece en el asiento.
2. **Amaia.** A los pocos minutos suena el teléfono. Tu mujer, nerviosa,
   con frases que **nunca se repiten** entre partidas (se barajan de un
   fondo de líneas). Si no contestas, insiste una vez… y luego no vuelve a
   llamar esa noche.
3. **Él.** «Gorka… ¿lo tienes?». Seis encargos, cada uno más pesado que el
   anterior, contados por insinuación, sin detalle operativo. Cuélgale y
   volverá a llamar: *«No vuelvas a hacer eso.»* La radio se agacha cuando
   suena el teléfono, y el aviso de **ENTREGA** te guía hasta un coche gris
   parado en el arcén. Frena a su lado y el paquete desaparece del
   asiento… hasta la siguiente llamada. La verdad, en el último encargo.

Además, **paradas de contemplación**: detente junto al dolmen, el cementerio
o la trinchera de roca y la carretera te dirá algo.

## Qué hay dentro

**Sonido (WebAudio, 100 % procedural, sin assets):**
- **Motor con caja de cambios**: 4 marchas, la aguja del régimen sube y cae
  con cada cambio (hueco de embrague incluido), oscilador principal + sub,
  vibración de ralentí.
- **Ruedas sobre asfalto** (ruido filtrado que se abre con la velocidad y con
  el mojado), **derrape** al frenar de mano o forzar la curva.
- **Ambiente rural**: viento con rachas, pájaros (nunca de noche ni con
  lluvia), grillos al atardecer, un cencerro lejano de vez en cuando.
- **Lluvia** con capa interior/exterior (más grave dentro del coche) y
  **truenos ocasionales**: primero el relámpago (flash real en el post),
  después el trueno, con el retardo del sonido.
- **Claxon** funcional (teclado, mando y móvil).

**Radio — 8 emisoras + apagada**, cada una con su programa sintetizado en
vivo por una cadena AM con siseo, estática de sintonía e interferencias:
**NIEBLA FM** (lofi lento), **COSTA NORTE** (pop), **DESVÍO 98.5** (tertulia),
**RADIO ARCÉN** (crónica de sucesos), **EUSKADI FANTASMA** (lofi
espectral, más siseo), **MONTE BAJO FM** (tertulia), **ÚLTIMA GASOLINERA**
(pop melancólico) y **KM CERO** (voz de madrugada). Volumen con `±`. Al
pasar junto a las trincheras de roca la **cobertura se pierde** y la emisora
se ahoga en estática.

**Tres cámaras** (`C`): interior con cabina completa y mirada libre; chase
exterior con lente larga; **isométrica** elevada tipo *Art of Rally* que
sigue la tangente de la carretera.

**Teléfono del salpicadero**: pantalla [VOZ ACTIVA] con quién llama, timbre
procedural, `F`/`G` para contestar/colgar, subtítulos con ritmo por palabras
y una voz filtrada por formantes de auricular — **placeholder honesto**: son
sílabas sintetizadas, no castellano real (ver «Qué falta»).

**Fauna y vegetación viva**: bandadas de pájaros que cruzan el valle batiendo
las alas, ovejas latxas, vacas, caballos y algún corzo junto al arcén; los
árboles **se mecen con el viento** (más cuanto más sopla).

**Mundo — norte despoblado** (todo procedural, cero assets externos):
comarcal muy revirada (suma de senos, deriva centrífuga real), caseríos
perdidos, dólmenes, cementerio, trincheras de roca, **gasolineras** de
carretera, puentes de piedra, robles y pinos, prados con fardos, montes
verdes en capas hasta el horizonte y niebla atlántica opaca **antes** del
punto de reciclado: nunca ves nacer un objeto.

**Dirección artística (estilo *Mixtape* / KRZ):** barras de película, cuatro
momentos del día con grade y lift de sombras propios, luz cálida de cabina
al anochecer, gotas de lluvia sobre el parabrisas (capa de cristal propia),
respiración sutil de cámara. Cabina con **CRT verde de COMPONENT ANALYSIS**,
cuadro de agujas vivas, radio de época con dial, y las manos de Gorka al
volante.

**Post-proceso cel:** un único pase GLSL3 — contornos por discontinuidad de
profundidad + sobel de luminancia, grano de película, viñeta, grade por hora
del día, estrías de lluvia, pulso de impacto y **flash de relámpago**.

## Estructura

```
index.html                    prototipo completo (sim + cabina + narrativa + post)
dist/dalinian-standalone.html un solo archivo — doble clic, sin servidor
vendor/three.module.js        Three.js r160 vendorizado (offline)
docs/preview*.png             capturas
docs/DESIGN.md                diseño técnico del informe original
```

## Qué falta

- **Voces reales en castellano**: imposible sin assets grabados o un backend
  TTS (esto corre 100 % offline en el navegador). La estructura ya está —
  subtítulos con ritmo, formantes de auricular, cola de llamadas — lista
  para enchufar audio real.
- Música/locución real por emisora (ahora es síntesis procedural en vivo).
- Fail state real en colisiones (daño, reintento de entrega).
- El interior del último encargo: qué hay dentro del paquete.
