# Dalinian Roads · España 80s — prototipo cel shading

Prototipo jugable en el navegador: conduces un **taxi blanco por una carretera
nacional de la España de los años 80**, con **cámara interior detallada**,
**cel shading** limpio con contornos de tinta, curvas, tráfico con colisión,
clima y ciclo día/noche — y un **horizonte donde todo existe de verdad**: nada
aparece de repente.

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
| `E` | cambiar emisora de radio (RNE 1, Radio 3, Los 40, Cadena SER…) |
| `T` | grabar con la emisora del macuto (● REC) |
| `N` | hora del día (día → atardecer → noche) |
| `R` | lluvia on/off |
| `P` | pausa |

## Qué hay dentro

**Cabina del taxi** (parentada a la cámara, todo cel shading):
- Volante que gira con la dirección y cuadro con **velocímetro de aguja viva**.
- **Radio de época** en el salpicadero: dial con banda de frecuencias, aguja
  que se mueve al cambiar de emisora y display verde con el nombre.
- **Taxímetro** ("OCUPADO · 085").
- **Macuto** verde oliva en el lado del copiloto con una **emisora CB de
  camionero** encima: micro de mano con cable rizado y LED rojo de grabación
  (`T`) — la semilla del sistema de podcasts/monólogos de la Fase 4.
- Retrovisor, pilares A, marco del parabrisas, capó blanco con limpiaparabrisas.

**Mundo — España interior, años 80** (todo procedural, cero assets externos):
- Nacional de asfalto desgastado con **línea central blanca discontinua**,
  líneas de borde y arcenes de grava (salirte de la carretera frena y sacude).
- Olivares, hileras de cipreses, casas blancas con teja, postes de teléfono,
  señales españolas (limite 100, curva peligrosa), hitos kilométricos con
  caperuza roja, matorral, parcelas de cultivo de colores… y el
  **toro de Osborne** en su valla.
- Montañas 3D reales en capas hasta el horizonte.
- El **sol rojo** — la única firma surrealista que queda del brief original.

**Distancia de dibujado / sin pop-in:** el campo de props abarca ~2,1 km de
carretera; la niebla se vuelve opaca antes del punto donde se recicla y
aparece la geometría nueva, así que **nunca ves nacer un objeto**. Los
contornos de tinta se desvanecen dentro de la calima para que las siluetas
lejanas queden suaves.

**Curvas y tráfico:** línea central como suma de senos (recta bajo las ruedas,
curva en el horizonte, deriva centrífuga real que obliga a contravolantear;
más allá de 500 m el trazado continúa linealmente para que la geometría lejana
no se dispare). Tráfico en ambos sentidos — coches lentos en tu carril y
coches de frente con faros — con colisión AABB: frenazo, empujón lateral,
sacudida y pulso rojo.

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

- Sonido: motor, lluvia, y las emisoras de radio con audio real.
- Grabación de voz real con `MediaRecorder` para los podcasts del walkie
  (Fase 4: sistema social asíncrono tipo Death Stranding).
- Fail state real en colisiones (daño, recaudación del taxi).
- Pasajeros y paradas (es un taxi…).
