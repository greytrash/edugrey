# Diseño técnico condensado

Destilado del informe técnico "cómo llevar a un videojuego la fusión Dalinian
Roads + Lithograph Dream". Este documento mapea las decisiones del informe a lo
que implementa el prototipo Fase 0 y a lo que quedaría para producción.

## Principio rector

> **La carretera es real, el mundo no.** Una capa jugable legible y euclidiana
> por debajo; el espectáculo surreal fuera del corredor. El estilo gráfico se
> resuelve en post-proceso para que el look plano no compita con la iluminación
> dinámica (clima, día/noche).

## El stack de estilo (litografía / grabado)

| Componente | Técnica | En el prototipo | En producción |
|---|---|---|---|
| Sombreado plano | cel/toon con rampa escalonada | `MeshToonMaterial`, gradientMap 3 bandas | shading model custom (UE5) o lighting fn (Unity) |
| Contornos | detección de bordes por profundidad + normales + color | depth-discontinuity + sobel de luminancia en el pase post | pase por profundidad+normales (mejor calidad) |
| Sombra entintada | dither ordenado (Obra Dinn) **o** hatching TAM (SIGGRAPH 2001) | Bayer 4×4 anclado a pantalla | añadir Tonal Art Maps empaquetados en 2 texturas |
| Papel / sello | grano + halftone + overlay | grano + mottle + viñeta procedurales | textura de papel escaneada + halftone screen-space |

**Riesgo #1 del informe — "hervor" del patrón.** El dither se ancla a
`gl_FragCoord` (espacio de pantalla) y se renderiza a resolución completa, que es
justo lo que estabiliza el patrón. Pope lo resolvió unificando patrón 2D con la
cámara 3D y subiendo resolución interna; aquí evitamos el problema no bajando la
resolución del efecto.

**Riesgo #2 — la luminancia dinámica desplaza los umbrales del dither.** El pase
post recibe un `grade` (tinte) y `exposure` por hora del día, de modo que se
remapea lo que alimenta al estilo en vez de dejar que día/noche rompan el
contraste. En producción: curvas de luminancia por hora + clamp.

## Capa de simulación

- **Física**: prototipo = arcade (drag, dirección por velocidad/agarre, balanceo).
  Producción = Chaos Vehicles (UE5) o WheelCollider/RCC (Unity). Caso de estudio:
  *Pacific Drive*.
- **Mundo**: prototipo = strip euclidiano + props reciclados (scroll infinito) +
  skybox-collage plano. Producción = ensamblado semi-procedural (Houdini, como
  Pacific Drive) manteniendo el corredor legible.
- **Surrealismo navegable**: landmarks estables y legibles (arco, obelisco) como
  puntos de referencia; deformación reservada al fondo lejano. Lección de
  *Manifold Garden* / *Superliminal*: la legibilidad se diseña, no se hereda.

## Clima y ciclo día/noche

- Prototipo: 3 presets de hora del día (día/atardecer/noche) que mueven luz
  direccional, ambiente y grade; lluvia como estrías de grafito + drag húmedo.
- Producción: Ultra Dynamic Sky/Weather (UE5) o Enviro 3 (Unity), operando en la
  capa de iluminación **por debajo** del post. Aplicar niebla como bandas planas
  de color (estilo litografía), no niebla fotorrealista.

## Elección de motor (resumen del informe)

- **Unity + URP** si priorizas fidelidad del look *Sable/Obra Dinn* (ambos hechos
  en Unity) + RCC + Enviro 3.
- **UE5** si priorizas mundo semi-procedural grande, física out-of-the-box y
  post-process materials ricos (Chaos Vehicles + Ultra Dynamic Sky + Houdini).

## Referencias de arte

Sistema de render base = paleta litográfica de alto contraste (crema/negro/rojo
óxido). Color de luz por bioma/hora = paleta Dalí (crema, terracota rosado, azul
grisáceo). Referencias: Tom Haugomat y Brian Edward Miller (composición/paleta
impresa), Kilian Eng (arquitectura imposible), Tom Killion (xilografía), Dalí
(*La persistencia de la memoria*); ejecución en juego: *Lorelei and the Laser
Eyes*, *Sable*, *Mundaun*.

## Umbral de decisión (Fase 0)

Si el look **no** convence en movimiento a través de un ciclo día/noche bajo
lluvia, no escalar contenido hasta resolverlo — el estilo es el corazón del
proyecto.
