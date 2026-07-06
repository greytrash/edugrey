# Spanish Road Anomaly

> **OPERACIÓN EUSKADI NORTE.** Montes verdes ahogados en niebla. Ni un pueblo
> en kilómetros: un caserío perdido, un dolmen, un cementerio sin lápidas. En
> el asiento, un paquete envuelto en papel marrón que no debes abrir. Y en el
> soporte, un teléfono que suena cuando la carretera está más vacía. **Él** te
> dirá dónde parar.

Prototipo jugable en el navegador (ref. *Pacific Drive* × *Kentucky Route
Zero*): un coche clásico modificado por las comarcales despobladas del norte,
con cámara interior y exterior, realismo estilizado (6 bandas toon, contornos
mínimos), curvas de montaña, tráfico escaso casi todo de frente, faros
reales, clima y ciclo día/noche — y un **horizonte donde todo existe de
verdad**: nada aparece de repente.

**La Llamada** es el eje: seis encargos de un hombre sin nombre, cada uno más
pesado que el anterior — puntos de encuentro que huelen a vigilancia,
"objetivos necesarios", "operativos de seguridad" — contados con ambigüedad e
insinuación, sin detalle operativo. Suena el teléfono ([VOZ ACTIVA] con forma
de onda), la radio se agacha, los subtítulos hablan frío e imperativo, y el
aviso de ENTREGA te guía hasta un coche gris en el arcén. Para a su lado y el
paquete desaparece del asiento… hasta la siguiente llamada. La verdad, en el
último encargo. Además: **paradas de contemplación** — detente junto al
dolmen, el cementerio o la trinchera de roca y la carretera te dirá algo.

> La versión anterior (estética litografía/grabado con dithering Bayer) está en
> el historial de git; el diseño técnico original sigue en `docs/DESIGN.md`.

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
| `C` | cámara: interior ⇄ exterior (taxi visible, con su franja roja y cartel) |
| `R` | radio: **LOFI**, **SYNTHWAVE**, **AUDIOLIBRO**, **CRIMEN** (síntesis en vivo, libre de derechos), apagada |
| `L` | faros (foco real que ilumina la carretera) |
| `V` | lluvia + limpiaparabrisas animado |
| `Espacio` | freno de mano (bloquea las ruedas, la trasera se suelta) |
| `ratón` | arrastrar para mirar la cabina, el asiento o por la ventanilla |
| **móvil** | botonera táctil automática: ◀ ▶ volante, ▲ gas, ▼ freno, ✋ freno de mano, y fila CAM · RADIO · LUZ · LLUVIA · HORA · REC; arrastra el dedo por la escena para mirar |
| `T` | grabar (● REC en la CB del asiento) |
| `N` | hora del día (día → atardecer → noche) |
| `P` | pausa |

## Qué hay dentro

**Cámara libre:** arrastra el ratón para mirar la radio, el asiento con el
macuto, por las ventanillas o hacia atrás; al soltar, la vista vuelve sola a la
carretera. La cabina está montada en un rig estable (tu cabeza gira dentro del
coche, no el coche contigo).

**Sonido (WebAudio, 100% procedural, sin assets):** el motor ronronea siguiendo
el acelerador, y la radio **suena de verdad**: cada emisora genera su programa
en vivo — tertulia (RNE 1), rock (Radio 3), synth-pop (Los 40), tertulia
nerviosa (Cadena SER) y copla en onda media — a través de una cadena AM con
siseo y ráfaga de estática al girar el dial. La sexta posición la apaga.

**Cabina del taxi** (montada en el rig, todo cel shading):
- Volante que gira con la dirección y cuadro con **velocímetro de aguja viva**.
- **Radio de época** en el salpicadero: dial con banda de frecuencias, aguja
  que se mueve al cambiar de emisora y display verde con el nombre.
- **Taxímetro** ("OCUPADO · 085").
- **Macuto** verde oliva en el lado del copiloto con una **emisora CB de
  camionero** encima: micro de mano con cable rizado y LED rojo de grabación
  (`T`) — la semilla del sistema de podcasts/monólogos de la Fase 4.
- Retrovisor, pilares A y B, techo, puertas con manilla, suelo con túnel de
  transmisión y palanca de cambios, asiento del copiloto, banqueta trasera y
  bandeja — una cabina completa para mirar alrededor.

**Mundo — País Vasco, años 80** (todo procedural, cero assets externos):
- Comarcal de montaña **muy revirada** (tres senos superpuestos, deriva
  centrífuga real), asfalto desgastado con línea blanca discontinua y arcenes
  de grava.
- **Caseríos** con entramado de madera en el hastial, alero grande y tejado a
  dos aguas; **pueblos** con iglesia de torre cuadrada, **frontón** con su
  raya verde o **herriko taberna** con su rótulo y su ikurriña.
- **Murales y pintadas de época** en fachadas y tapias: ikurriñas, "EUSKAL
  PRESOAK — ETXERA" con siluetas de estarcido (caras genéricas, ninguna
  persona real), "GORA EUSKADI", "INDEPENDENTZIA", "AMNISTIA" con goterones
  de spray. Sin simbología de organizaciones armadas.
- **Ciclistas** en pelotón por tu carril, con maillots de colores e hitbox
  estrecha — hay que abrirse para adelantarlos.
- **Travesías de pueblo definidas**: cartel de entrada → calle de caseríos a
  ambos lados, herriko taberna, iglesia o frontón, murales… y **vecinos con
  txapela paseando** (piernas y brazos animados en péndulo, ida y vuelta).
- **Puentes de piedra** sobre regatas: pretiles con albardilla y machones, el
  agua cruzando bajo la carretera.
- **Manos del cartero al volante** (giran con él), pila de cartas y paquete
  atado con cuerda en el salpicadero, coche amarillo con rótulo CORREOS.
- **Gasolineras CAMPSA** de época: marquesina, surtidores rojos, kiosco y
  rótulo azul.
- Carteles de entrada a pueblo (Gernika, Lekeitio, Oñati, Azpeitia, Elorrio,
  Zumarraga, Tolosa, Mutriku), señales, hitos, postes.
- Robles, pinos de repoblación, helechos, prados verdes y **montes verdes** en
  capas hasta el horizonte, con la niebla atlántica más cerrada.
- Cielo encapotado (esfera envolvente con nubes) y el toro de Osborne, raro.

**Fixes técnicos** (v. cartero): buffer de profundidad a 24 bits — adiós al
bandeado de los prados, a los contornos punteados de las montañas y al
parpadeo de la cara de la radio (z-fighting) —, más separación en todos los
paneles de la cabina, textura de asfalto con parches y sellado de grietas, y
HUD reubicado en móvil para no pisar los botones.

**Distancia de dibujado / sin pop-in:** el campo de props abarca ~2,1 km de
carretera; la niebla se vuelve opaca antes del punto donde se recicla y
aparece la geometría nueva, así que **nunca ves nacer un objeto**. Los
contornos de tinta se desvanecen dentro de la calima para que las siluetas
lejanas queden suaves.

**Movimiento real:** las marcas viales fluyen hacia el conductor exactamente a
la velocidad del mundo (línea discontinua a ~3,5 m de trazo / ~9 m de hueco), el
morro cabecea al acelerar y frenar, y el rig guiña hacia el interior de la curva.

**Curvas y tráfico:** línea central como suma de senos (recta bajo las ruedas,
curva en el horizonte, deriva centrífuga real que obliga a contravolantear;
más allá de 500 m el trazado continúa linealmente para que la geometría lejana
no se dispare). Tráfico en ambos sentidos — coches lentos en tu carril y
coches de frente con faros — con colisión AABB: frenazo, empujón lateral,
sacudida y pulso rojo.

**Pasajeros (road movie):** por las comarcales hay gente haciendo **autostop**.
Pasa despacio a su lado (por debajo de ~30 km/h, en tu carril) y **sube al
coche**: se sienta a tu lado con animación sutil (respira, mira el paisaje) y
te va contando cosas en **subtítulos cinematográficos** dentro de las barras de
cine. Cuatro personajes de la Euskadi de los 70 — la **Amona** camino del
mercado, el **Estudiante** con sus "apuntes", el **Bertsolari** que paga con un
verso, el **Marinero** de Lekeitio — cada uno con su hilo y guiños a Radio
Zubato. Cuando acaba su charla te pide bajar; **párate** y se despide. El
macuto pasa atrás mientras hay pasajero. `T` sigue grabando para Zubato.

**Dirección artística (estilo *Mixtape*):** realismo estilizado y
cinematográfico — barras de película, cuatro momentos del día (amanecer, día,
atardecer, noche) con grade y **lift de sombras** propios, luz cálida de
cabina al anochecer, **reflejos y gotas de lluvia sobre el parabrisas** (capa
de cristal propia, no solo pantalla), respiración sutil de cámara, lente más
larga en la cámara exterior. El fondo lejano ya **no se dobla con la
carretera** (amortiguación del bend por distancia) y los montes son **domos
suaves con normales continuas** — pintados, no low-poly — con colinas
intermedias, ovejas latxas pastando, fardos de heno, setos, quitamiedos y
postes de teléfono **con sus cables en catenaria**.

**Post-proceso cel:** un único pase GLSL3 — contornos por discontinuidad de
profundidad + sobel de luminancia, grano fino de película, viñeta, grade por
hora del día, estrías de lluvia y pulso de impacto. La iluminación dinámica
vive debajo del pase de estilo, como prescribe el informe técnico.

## Estructura

```
index.html                    prototipo completo (sim + cabina + post)
dist/dalinian-standalone.html un solo archivo — doble clic, sin servidor
vendor/three.module.js        Three.js r160 vendorizado (offline)
docs/preview*.png             capturas
docs/DESIGN.md                diseño técnico del informe original
```

## Qué falta

- Grabación de voz real con `MediaRecorder` para los podcasts del walkie
  (Fase 4: sistema social asíncrono tipo Death Stranding).
- Música/locución real por emisora (ahora es síntesis procedural en vivo).
- Fail state real en colisiones (daño, recaudación del taxi).
- Pasajeros y paradas (es un taxi…).
