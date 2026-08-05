# Vídeos «cómo lo hice» — Mundo Gris + Grey AI

Preproducción completa de las dos piezas que explican cómo se construyeron los
proyectos **con Higgsfield y Claude**. Todo lo que hay aquí está listo para
disparar: guion cronometrado, escaleta plano a plano, prompts literales para
Higgsfield y la secuencia de llamadas MCP.

| Pieza | Proyecto | Doc |
|---|---|---|
| 01 | `MUNDO GRIS — el ecosistema` (artifact de Claude) | [`01-mundo-gris.md`](01-mundo-gris.md) |
| 02 | `grey-ai.higgsfield.app` (web en Higgsfield) | [`02-grey-ai.md`](02-grey-ai.md) |
| 03 | Plano Seedance 2.5 · gente corriendo hacia cámara (b-roll de impacto) | [`03-seedance-shot.md`](03-seedance-shot.md) |

## Estado

**No se han gastado créditos todavía.** Falta cerrar una decisión (abajo) antes
de generar: disparar con el estilo equivocado son ~150-250 créditos tirados por
pieza y un remontaje entero.

### Bloqueante: la referencia de estilo

El encargo decía «ESTILO ESTO:» y el vídeo de referencia **no llegó** — el
mensaje se cortó ahí. Sin esa referencia no se puede clonar ritmo, tipo de
plano, tipografía ni tono de voz.

Los guiones están escritos contra la identidad real de Mundo Gris (extraída del
propio artifact, ver más abajo), que es la opción segura. Si la referencia era
otra cosa, cambia la capa visual pero **el guion y la escaleta se mantienen**:
están escritos para ser reestilables.

### Hueco de datos: Grey AI

`grey-ai.higgsfield.app` no se ha podido inspeccionar: el proxy de red de la
sesión bloquea ese dominio (403 en el CONNECT) y el sitio tampoco aparece en las
webs creadas vía MCP en ninguno de los tres workspaces, así que se hizo desde la
UI de Higgsfield. El guion 02 está montado con la estructura correcta y los
datos concretos marcados como `[DATO]`.

## La identidad visual (extraída del artifact, no inventada)

Tokens CSS reales de `MUNDO GRIS — el ecosistema`:

```
--blanco      #FCFCFA      --negro       #0A0A0B
--magenta     #F012B8      --rosa-claro  #FF3DD1
--rosa-tinta  #B60D8C      --velo        #FDEBF8
```

Tipografías (incrustadas en base64 dentro del HTML, sin CDN):

- **Archivo** — titulares, peso 900, ancho variable 62%–125%. El «MUNDO GRIS.» gigante.
- **Instrument Sans** — texto corrido.
- **Space Mono** — etiquetas, cintillos, kickers, el ticker.

Ritmo de secciones: blanco roto → negro → velo rosa → blanco. El magenta es
acento, nunca fondo grande.

> Nota: no es rojo sello ni prensa en blanco y negro. Es **magenta neón sobre
> papel casi blanco**, con bloques en negro puro. Cualquier b-roll generado tiene
> que respetar eso o el corte cantará.

## Material real ya capturado

`frames/` tiene 16 capturas reales del artifact renderizado en Chromium, listas
para montaje — no son mockups:

- `frames/v/*.jpg` — 1080×1920 (9:16, para reel)
- `frames/d/*.jpg` — 1920×1080 (16:9, para YouTube)

Secciones: `top`, `ecosistema`, `medio`, `academia`, `estudio`, `firma`,
`parte`, `manifiesto`.

Para regenerarlas o sacar más (scroll continuo, hover, el reproductor de música):

```bash
# el artifact es autocontenido: se sirve en local y se captura
python3 -m http.server 8123     # en la carpeta que tenga el index.html
node docs/video/capture.mjs     # ver el bloque de código en 01-mundo-gris.md
```

## Decisiones asumidas (cambiables en un mensaje)

1. **Formato**: vertical 9:16, 55–60 s, para `@grey_trash` y `@nuestromundogris`.
   Cada guion lleva además la extensión a 16:9 / 2:30 para YouTube.
2. **Voz**: locución IA en castellano generada en Higgsfield, tono de redacción
   —seco, sin entusiasmo de vendedor—. Alternativa sin voz (solo tipografía +
   música) anotada en cada guion.
3. **Captura real por delante de b-roll generado**: la web existe y se ve bien;
   enseñarla de verdad es más creíble que ilustrarla. El b-roll de Higgsfield
   entra solo donde no hay nada que grabar (las metáforas del proceso).
