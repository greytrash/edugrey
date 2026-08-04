# Pieza 01 — «Una redacción entera en un solo archivo»

Cómo se construyó **MUNDO GRIS — el ecosistema** con Claude y Higgsfield.

- **Formato máster**: 9:16, 1080×1920, 58 s, 30 fps
- **Voz**: locución en castellano, tono redacción
- **Música**: cama tensa mínima, sube en el plano 08
- **Subtítulos**: quemados, Archivo 900, magenta sobre negro, 2–4 palabras por golpe

---

## 1. Guion de locución

Cronometrado a ~2,6 palabras/segundo (ritmo de locutor español sin prisa).
Total: 152 palabras ≈ 58 s.

| # | TC | Locución |
|---|----|----------|
| 01 | 0:00–0:04 | Esto no es una web. Es una redacción, una escuela y un estudio. |
| 02 | 0:04–0:09 | Y es un solo archivo. Uno. |
| 03 | 0:09–0:15 | Sin WordPress. Sin plantilla. Sin CDN. Doscientos treinta y seis kilobytes que se abren sin internet. |
| 04 | 0:15–0:22 | Las tipografías van dentro, incrustadas. Y la música no es un mp3: la fabrica tu navegador mientras lees. |
| 05 | 0:22–0:29 | No abrí Figma. Le conté a Claude qué quería —prensa, magenta, cero humo— y escribió el código. |
| 06 | 0:29–0:36 | Iteración a iteración: portada, ticker, editorial, hemeroteca. Las tres puertas. |
| 07 | 0:36–0:43 | Higgsfield puso lo que se ve moverse: imagen, voz, música. Cuarenta y cinco piezas. |
| 08 | 0:43–0:50 | Dieciséis marcas. Medio millón de visualizaciones en un solo reel. Cero rodajes. |
| 09 | 0:50–0:55 | La máquina ejecuta. La decisión sigue siendo mía. |
| 10 | 0:55–0:58 | Mundo Gris. Comenta, comparte, construye. |

### Variante sin voz

Si se va a kinético puro, la misma escaleta con estos rótulos (Archivo 900,
un golpe por plano, entrada por corte seco, nunca fade):

```
01  NO ES UNA WEB
02  ES UN ARCHIVO
03  236 KB · SIN INTERNET
04  LA MÚSICA LA HACE TU NAVEGADOR
05  CERO FIGMA
06  SE LO CONTÉ. LO ESCRIBIÓ.
07  45 PIEZAS
08  16 MARCAS · 500K · 0 RODAJES
09  LA MÁQUINA EJECUTA. YO DECIDO.
10  MUNDO GRIS
```

---

## 2. Escaleta plano a plano

`CAPTURA` = material real ya disponible en `frames/`.
`GEN` = hay que generarlo en Higgsfield.

| # | TC | Imagen | Fuente | Movimiento |
|---|----|--------|--------|------------|
| 01 | 0:00–0:04 | Portada: «MUNDO GRIS.» a sangre | CAPTURA `v/top.jpg` | push-in lento 100→108% |
| 02 | 0:04–0:09 | El HTML en el editor, scroll vertiginoso de 8.000 líneas | GEN A | scroll de código, sin cámara |
| 03 | 0:09–0:15 | Cifra «236 KB» sobre negro; cae el wifi (icono tachado) | GEN B | corte seco a mitad |
| 04 | 0:15–0:22 | Detalle de la tipografía gigante + el botón «MÚSICA» pulsando | CAPTURA `v/top.jpg` recortado + `v/manifiesto.jpg` | pan lateral sobre el titular |
| 05 | 0:22–0:29 | Terminal de Claude Code escribiendo; la web se arma al lado | GEN C | split vertical: código arriba, render abajo |
| 06 | 0:29–0:36 | Las tres puertas, una tras otra | CAPTURA `v/ecosistema.jpg`, `v/medio.jpg`, `v/academia.jpg` | tres cortes de 2,3 s, whip entre ellos |
| 07 | 0:36–0:43 | Mosaico de las piezas del estudio | CAPTURA `v/estudio.jpg` | zoom-out desde un caso al grid |
| 08 | 0:43–0:50 | La fila de cifras: +45 / 16 / 500K / 0 | CAPTURA `v/top.jpg` (parte baja) | los números entran uno a uno, snap |
| 09 | 0:50–0:55 | Retrato editorial de autor / mano sobre el trackpad, alto contraste | GEN D | plano fijo, casi quieto |
| 10 | 0:55–0:58 | Cierre: «MG.» + COMENTA / COMPARTE / CONSTRUYE | CAPTURA `v/manifiesto.jpg` | fijo, el magenta parpadea una vez |

**Regla de montaje**: nada dura más de 4 s excepto el 09. El plano 09 es el
único respiro y por eso funciona el remate.

---

## 3. Prompts de generación (Higgsfield)

Prompts en inglés —los modelos responden mejor— pero el contenido en pantalla
en castellano. Todos comparten el mismo *style suffix* para que los cuatro
planos generados casen entre sí y con la web:

```
STYLE SUFFIX (pegar al final de los cuatro prompts):
editorial tech aesthetic, off-white #FCFCFA and pure black #0A0A0B,
single neon magenta accent #F012B8, no other colours, high contrast,
crisp grotesque typography, flat graphic design, no lens flare,
no stock-photo gloss, no gradients except one soft magenta bloom,
shot on 35mm, shallow depth, vertical 9:16 composition
```

### GEN A — el archivo (plano 02)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: Extreme close-up of a code editor on a dark screen showing thousands of
lines of dense HTML and CSS scrolling past at high speed, motion blur on the
text, a single file tab labelled "index.html" pinned at the top, the reflection
of the code faintly visible on a black desk surface. + STYLE SUFFIX
```

→ luego `generate_video` (image-to-video, 5 s): *"the code scrolls upward at
constant high speed, the file tab stays perfectly still, no camera movement"*.

### GEN B — 236 KB sin internet (plano 03)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: A stark black poster frame. Enormous condensed grotesque numerals
"236 KB" filling the frame in off-white, and beneath them a small crossed-out
wifi glyph in neon magenta. Nothing else. Print-poster composition, generous
margins. + STYLE SUFFIX
```

→ `generate_video` (5 s): *"the crossed-out wifi glyph flickers once and dies,
the numerals stay locked, subtle film grain"*.

### GEN C — Claude escribiendo (plano 05)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: Vertical split composition. Top half: a terminal window on black,
monospaced text streaming, a blinking cursor. Bottom half: a bold editorial
web page assembling itself block by block on an off-white background, giant
black headline type, one magenta button. The two halves share the same frame,
divided by a single hairline rule. + STYLE SUFFIX
```

→ `generate_video` (5 s): *"terminal text streams downward while the web page
below snaps into place block by block, hard cuts not fades, no camera move"*.

### GEN D — quien decide (plano 09)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: A single hand resting still on a laptop trackpad, shot from above in
hard directional light, deep black shadows, the screen glow spilling neon
magenta across the knuckles. The face is not visible. Quiet, unglamorous,
documentary. + STYLE SUFFIX
```

→ `generate_video` (5 s): *"almost no motion, the hand breathes, the magenta
screen glow pulses once, locked-off camera"*.

### Voz

```
generate_audio
type: voiceover
language: es
voice: male, mid-register, dry Spanish newsroom delivery — informative,
       unhurried, zero salesman energy, no smiling tone
text: <las diez líneas de la tabla del §1, seguidas, con pausa de 300 ms
       entre líneas>
```

### Música

```
generate_audio
type: music
prompt: minimal tense electronic bed, low sub pulse, no melody for the first
40 seconds, a single bright synth stab entering at 0:43, abrupt stop at 0:55
duration: 58s
```

---

## 4. Secuencia de ejecución (MCP)

```
1. select_workspace           → «Mundo» (4eb865ab-…), 2.463 créditos
2. get_workflow_instructions  → { workflow: "faceless-channel-video" }
                                tipo Explainer, es THE flow para esto
3. generate_image_batch       → GEN A, B, C, D  (4 jobs)
4. jobs_wait                  → esperar los 4
5. generate_video_batch       → los 4, image-to-video, 5 s cada uno
6. generate_audio             → locución (§ Voz)
7. generate_audio             → música (§ Música)
8. jobs_wait  +  show_generation_by_ids
9. montaje: intercalar con las CAPTURAS de frames/v/
10. virality_predictor        → sobre el máster, antes de publicar
11. tiktok_prepare_publish    → si se publica desde aquí
```

**Coste estimado**: 4 imágenes + 4 vídeos de 5 s + 2 audios ≈ 150–200 créditos.
Sobra de largo con los 2.463 del workspace.

---

## 5. Extensión a 16:9 / 2:30 (YouTube)

Misma columna vertebral, cuatro bloques nuevos entre los planos 06 y 07. Aquí
el vídeo deja de ser un anuncio y se convierte en lo que se pide en la academia:

1. **El brief real** (25 s) — qué se le pidió a Claude exactamente. Enseñar el
   prompt de verdad, sin limpiarlo. El valor está en que se vea el desorden.
2. **Las tres decisiones de diseño** (35 s) — un archivo y no un stack; magenta
   y no rojo; Web Audio y no un mp3. Cada una con su porqué de una frase.
3. **Dónde se equivocó** (30 s) — el bloque que más engancha y el que todo el
   mundo se salta. Qué hubo que rehacer, cuántas iteraciones.
4. **Qué puso Higgsfield** (30 s) — las piezas del portfolio: imagen, voz,
   música, animación. Aquí van clips reales del portfolio, no b-roll.

Cierre idéntico al del reel.

---

## 6. Script de captura

El artifact es autocontenido (tipografías en base64, cero CDN), así que se
sirve en local y se captura con Chromium. Así se generaron los `frames/`:

```js
// docs/video/capture.mjs
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const SECTIONS = ['top','ecosistema','medio','academia','estudio','firma','parte','manifiesto'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const [dir, w, h] of [['v', 1080, 1920], ['d', 1920, 1080]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8123/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);            // deja acabar las animaciones de entrada
  for (const id of SECTIONS) {
    const el = await p.$('#' + id);
    if (!el) continue;
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
    await p.screenshot({ path: `docs/video/frames/${dir}/${id}.jpg`, type: 'jpeg', quality: 82 });
  }
  await ctx.close();
}
await b.close();
```

Para vídeo de scroll continuo en vez de fijos, cambiar el bucle por un
`page.mouse.wheel()` a velocidad constante grabando con
`context({ recordVideo: { dir, size } })`.

---

## 7. Pendiente de confirmar

- **La referencia de estilo** que no llegó en el encargo. Es lo único que puede
  invalidar la capa visual; el guion aguanta cualquier estilo.
- **Plano 07 / línea 07 de locución**: se afirma que las 45 piezas del
  portfolio se hicieron con Higgsfield. Si en realidad fue con varias
  herramientas, cambiar por «con IA de principio a fin» y mover la mención a
  Higgsfield al bloque 4 de la versión larga, donde sí se puede detallar.
