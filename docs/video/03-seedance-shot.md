# Pieza 03 — Plano Seedance 2.5 · gente corriendo hacia cámara

Plano de referencia generado con **Seedance 2.5** a partir de dos capturas de pantalla.
Uso previsto: b-roll de apertura o transición de impacto para los reels de la serie.

- **Modelo**: Seedance 2.5
- **Duración**: 5 s
- **Relación de aspecto**: 9:16
- **Resolución**: 720p

---

## Imágenes de referencia

| Ref | Descripción |
|-----|-------------|
| `Screenshot_20260805_161506_CapCut.jpg` | Composición / moodboard elaborado en CapCut — sirve de referencia visual para el encuadre y el look |
| `Screenshot_20260804_151349_Samsung Browser.jpg` | Captura del sitio / fuente de la imagen de la cara del capitán |

---

## Prompt de generación

> 人们跑向一台类似纪录片的手持摄像机，镜头略微染色，有时甚至模糊，然后放大那张巨大的脸庞，并担任船长，这位在场的另一位人物。

**Traducción de trabajo (castellano):**

> Personas corriendo hacia una cámara de mano de estilo documental; la lente
> ligeramente virada de color, a veces incluso desenfocada; después un zoom
> hacia ese rostro enorme que actúa como capitán — otro personaje presente en
> la escena.

---

## Parámetros de ejecución

```
model:        Seedance 2.5
duration:     5 s
aspect_ratio: 9:16
resolution:   720p
reference_1:  Screenshot_20260805_161506_CapCut.jpg      (CapCut moodboard)
reference_2:  Screenshot_20260804_151349_Samsung Browser.jpg  (cara / capitán)
prompt:       (ver arriba, en chino — usar el original para la llamada a la API)
```

---

## Notas de dirección

- **Handheld documental**: ligero temblor, sin steadicam. La inestabilidad es
  intencional y refuerza el registro de «detrás de las cámaras».
- **Lente virada y a veces borrosa**: efecto analógico / tono cinematográfico.
  No corregir en postproducción: es parte del look.
- **El zoom a la cara**: el movimiento final del plano — de la masa en
  movimiento al primer plano del «capitán». El corte llega justo cuando el
  rostro llena el encuadre.
- **Encaje en el montaje**: este plano puede abrir la pieza 01 o 02 antes del
  título, o usarse como transición entre el bloque de proceso y el bloque de
  resultado.

---

## Integración con la serie

Este plano rompe deliberadamente con el estilo editorial gráfico de las piezas
01 y 02 (fondo blanco roto, magenta, tipografía Archivo). Ese contraste es
funcional: el registro documental «humano» hace que el corte al mundo gráfico
de la web resulte más impactante. Si se usa como apertura, confirmar que el
primer plano de la pieza destino lleva el *style suffix* completo para que el
salto sea legible como elección, no como error.
