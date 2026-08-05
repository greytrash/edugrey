# Spots — Dalinian Roads · Lithograph Dream

Dos versiones de spot (15 s, 16:9, 1080p, con audio nativo) generadas con
Kling 3.0 Omni a partir de los fotogramas de referencia del prototipo
(`docs/preview.png` y `docs/preview-night-rain.png`), para preservar el look
litográfico real del proyecto.

## Spot A — «Dynamic» (engagement / alta energía)

- **Archivo**: `spot-a-dynamic.mp4`
- **Concepto**: montaje multi-plano cinético. Cámara de persecución pegada al
  asfalto, cortes duros, whip-pans junto al obelisco y el diamante flotante,
  salto día → atardecer → noche con lluvia, derrape final bajo el sol-sello
  rojo y congelado tipo "litografía recién estampada".
- **Audio**: motor, whooshes de corte, score electrónico percusivo, golpe de
  graves final.
- **Referencia**: `docs/preview.png` (día).

## Spot B — «Educational» (retro-futurista + psicodélico)

- **Archivo**: `spot-b-educational.mp4`
- **Concepto**: explainer calmado con dolly aéreo continuo. Voz en off:
  *"Welcome to Dalinian Roads. Here, the road is real — the world is not.
  Ink outlines. Engraved shadows. Paper grain. A living lithograph, printed
  sixty times every second."* Sobreimpresiones esquemáticas retro-futuristas
  (blueprint fino, flechas de documental científico años 70 señalando
  sol-sello, diamante y carretera) mientras el cielo se vuelve psicodélico:
  nubes-caleidoscopio, sol pulsando óxido → magenta → violeta, montañas
  derritiéndose a lo Dalí. La carretera permanece nítida y legible — la regla
  del proyecto («la carretera es real, el mundo no») convertida en recurso
  didáctico. Transición final al fotograma de noche + lluvia.
- **Audio**: arpegios de sinte retro, crujido de vinilo, motor suave bajo la
  narración.
- **Referencias**: `docs/preview.png` (día) + `docs/preview-night-rain.png`
  (noche/lluvia).

## Generación

| | Spot A | Spot B |
|---|---|---|
| Modelo | kling-video-v3_0_omni | kling-video-v3_0_omni |
| Duración | 15 s | 15 s |
| Resolución | 1080p (16:9) | 1080p (16:9) |
| Multi-shot | sí | no (plano continuo) |
| Audio nativo | sí | sí (voz en off) |

Los prompts completos de ambos spots están en `PROMPTS.md` para poder
regenerarlos o iterarlos.
