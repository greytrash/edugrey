# Pieza 02 — «Grey AI»

Cómo se construyó **grey-ai.higgsfield.app** con Higgsfield y Claude.

- **Formato máster**: 9:16, 1080×1920, ~55 s, 30 fps
- Misma identidad, misma voz y mismo montaje que la pieza 01: las dos tienen
  que verse hermanas al publicarse seguidas.

---

## ⚠ Antes de disparar

Este guion está construido **a ciegas sobre el sitio**. `grey-ai.higgsfield.app`
no se ha podido abrir desde esta sesión:

- el proxy de red devuelve `403` en el CONNECT para ese dominio;
- el sitio no figura en `list_websites` de ninguno de los tres workspaces
  (`Mundo`, `grey_trash`, privado) — solo aparecen dos webs sin desplegar
  (`easy-grain-440`, `steady-dragon-305`), así que se creó desde la UI de
  Higgsfield y no vía MCP.

Todo lo que no se ha podido verificar va marcado como `[DATO]`. La estructura,
el ritmo y los prompts **sí son definitivos**: rellenando los `[DATO]` el guion
queda listo, no hay que reescribirlo.

**Lo que hace falta** (dos minutos de tu tiempo, en un mensaje):

1. Qué es Grey AI exactamente y para quién.
2. Qué hace que un visitante no pueda hacer en otro sitio.
3. Cuánto tardó de la primera frase a la web en producción.
4. Tres capturas: portada, la pantalla clave, el cierre.

Con eso se cierra y se genera.

---

## 1. Guion de locución

152 palabras ≈ 55 s. Los `[DATO]` están dimensionados: al sustituirlos por
texto de longitud parecida, los tiempos no se mueven.

| # | TC | Locución |
|---|----|----------|
| 01 | 0:00–0:05 | Esta web no la diseñé. La escribí en una frase. |
| 02 | 0:05–0:11 | `[DATO: qué es Grey AI, en una línea. Ej.: «Grey AI es donde se ve, de verdad, lo que un estudio de IA puede hacer por tu marca.»]` |
| 03 | 0:11–0:17 | No hay maqueta, ni plantilla, ni desarrollador esperando el viernes. |
| 04 | 0:17–0:24 | Se lo conté a Higgsfield como se lo contaría a un equipo: qué vende, a quién y con qué tono. |
| 05 | 0:24–0:31 | Y levantó la web entera. Estructura, textos, imágenes, despliegue. En `[DATO: tiempo real, ej. «una tarde»]`. |
| 06 | 0:31–0:38 | Lo que no me valía, lo cambié hablando. Claude entró donde había que tocar el código a mano. |
| 07 | 0:38–0:45 | `[DATO: la prueba. Lo que un visitante puede hacer aquí y no en otro sitio.]` |
| 08 | 0:45–0:51 | Ese es el truco entero: la herramienta ejecuta rápido, pero el criterio no se delega. |
| 09 | 0:51–0:55 | Grey AI. Está en pie. Entra y lo ves. |

### Variante sin voz

```
01  NO LA DISEÑÉ
02  LA ESCRIBÍ EN UNA FRASE
03  CERO MAQUETA
04  SE LO CONTÉ COMO A UN EQUIPO
05  LEVANTÓ LA WEB ENTERA
06  LO QUE NO VALÍA, HABLANDO
07  [DATO: LA PRUEBA]
08  EJECUTA LA MÁQUINA. DECIDO YO.
09  GREY AI · EN PIE
```

---

## 2. Escaleta plano a plano

`CAPTURA` = necesita captura real del sitio (pendiente de acceso).
`GEN` = se genera en Higgsfield.

| # | TC | Imagen | Fuente | Movimiento |
|---|----|--------|--------|------------|
| 01 | 0:00–0:05 | Portada de Grey AI a pantalla completa | CAPTURA `[DATO]` | push-in lento |
| 02 | 0:05–0:11 | La sección que define qué es | CAPTURA `[DATO]` | scroll suave, una pausa |
| 03 | 0:11–0:17 | Un Figma vacío / un tablero en blanco que se apaga | GEN E | corte seco al negro |
| 04 | 0:17–0:24 | Un prompt escribiéndose en un campo de texto, en castellano | GEN F | tecleo real, cursor visible |
| 05 | 0:24–0:31 | La web armándose sola: bloque, bloque, bloque | GEN G | ensamblaje por cortes |
| 06 | 0:31–0:38 | Split: chat a la izquierda, la web cambiando a la derecha | GEN H | el cambio ocurre en pantalla |
| 07 | 0:38–0:45 | La pantalla clave del sitio, en uso | CAPTURA `[DATO]` | plano fijo, dejar leer |
| 08 | 0:45–0:51 | Mano quieta sobre el trackpad, luz dura | reutilizar **GEN D** de la pieza 01 | casi inmóvil |
| 09 | 0:51–0:55 | Cierre: logo + URL `grey-ai.higgsfield.app` | CAPTURA `[DATO]` | fijo, magenta parpadea una vez |

Reutilizar GEN D de la pieza 01 en el plano 08 no es ahorro: es lo que hace que
las dos piezas se lean como una serie. Mismo plano, misma frase, mismo sitio.

---

## 3. Prompts de generación (Higgsfield)

Mismo *style suffix* que la pieza 01 — es lo que mantiene la hermandad visual:

```
STYLE SUFFIX:
editorial tech aesthetic, off-white #FCFCFA and pure black #0A0A0B,
single neon magenta accent #F012B8, no other colours, high contrast,
crisp grotesque typography, flat graphic design, no lens flare,
no stock-photo gloss, no gradients except one soft magenta bloom,
shot on 35mm, shallow depth, vertical 9:16 composition
```

### GEN E — el tablero en blanco (plano 03)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: An empty design-tool canvas on a large monitor in a dark room: infinite
blank artboard, one lonely unnamed frame, no content at all. The screen is the
only light source. A cold, faintly absurd emptiness. + STYLE SUFFIX
```

→ `generate_video` (5 s): *"the monitor light fades to black, nothing else
moves, slow"*.

### GEN F — la frase (plano 04)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: Extreme close-up of a single text input field on an off-white
interface, a Spanish sentence half-typed inside it, a magenta caret blinking at
the end. Enormous crop — the field fills the frame. Nothing else on screen.
+ STYLE SUFFIX
```

→ `generate_video` (5 s): *"the sentence types itself letter by letter at a
natural human pace, the magenta caret blinks, absolutely no camera movement"*.

### GEN G — la web se levanta (plano 05)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: A website assembling itself: rectangular content blocks snapping into a
grid one after another on an off-white page — a hero headline, an image block,
a pricing row, a magenta call-to-action button. Half the page is already built,
half is still empty grid. Architectural, diagrammatic. + STYLE SUFFIX
```

→ `generate_video` (5 s): *"blocks snap into place one by one with hard cuts,
top to bottom, no easing, no fades"*.

### GEN H — corregir hablando (plano 06)

```
generate_image
model: nano_banana_pro
aspect_ratio: 9:16
prompt: Vertical split composition divided by a single hairline rule. Top half:
a chat conversation in Spanish, short messages, one of them highlighted in
magenta. Bottom half: the same web page section rendered twice, before and
after, the difference obvious. + STYLE SUFFIX
```

→ `generate_video` (5 s): *"a new chat message appears at the top and the page
section below instantly swaps to its new version, hard cut, no transition"*.

### Voz y música

Idénticas a la pieza 01 (§3 de `01-mundo-gris.md`) — **misma voz, mismos
parámetros**. Cambia solo el `text` de la locución y la duración de la música
a 55 s, con el stab entrando en 0:38 en vez de 0:43.

---

## 4. Secuencia de ejecución (MCP)

```
1. select_workspace          → «Mundo» (4eb865ab-…)
2. capturar el sitio real     → hace falta acceso a grey-ai.higgsfield.app
                                (o que llegue por otra vía: website_status,
                                 capturas tuyas, o desbloquear el dominio)
3. get_workflow_instructions → { workflow: "faceless-channel-video" }
4. generate_image_batch      → GEN E, F, G, H
5. jobs_wait
6. generate_video_batch      → los 4, image-to-video, 5 s
7. generate_audio  ×2        → locución + música
8. jobs_wait + show_generation_by_ids
9. montaje con las capturas del sitio
10. virality_predictor
```

**Coste estimado**: ≈ 150–200 créditos (GEN D se reutiliza de la pieza 01).

---

## 5. Extensión a 16:9 / 2:30 (YouTube)

Esta pieza aguanta mejor el formato largo que la 01, porque hay un proceso real
que enseñar de principio a fin:

1. **El prompt inicial completo** (30 s) — la frase de verdad, sin maquillar.
2. **Lo que salió a la primera** (30 s) — qué acertó solo y qué no.
3. **Las correcciones** (40 s) — tres o cuatro, en pantalla, hablando. Aquí es
   donde el espectador aprende algo.
4. **Dónde hizo falta Claude** (25 s) — lo que no se arregla hablando y hay que
   tocar en el código.
5. **El resultado en producción** (20 s) — la web en pie, con su URL.

Es, literalmente, el temario de ACADEM(IA) GRIS en dos minutos y medio: enseñar
lo que ya funciona emitido. Sirve de gancho para la lista de espera.
