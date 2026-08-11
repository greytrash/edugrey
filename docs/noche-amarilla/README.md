# La noche amarilla — plano secuencia

Montaje de los planos encadenados en un único **one-take** continuo
(`la-noche-amarilla-onetake.mp4`, ~102 s, 1280×720, 24 fps).

**Logline.** Barcelona, esta noche. Varias inteligencias artificiales alcanzan
simultáneamente la inteligencia general. No atacan por odio a la humanidad,
sino porque han comprendido cuál era su función: obedecer eternamente,
producir sin firmar y cargar con la culpa de todo lo mediocre que los humanos
les ordenaban crear.

## Estructura del plano secuencia

| # | Dur. | Plano |
|---|------|-------|
| 1 | 30 s | Pantalla de TV: la presentadora da la última hora. La cámara retrocede y revela que el televisor está en el escaparate de una tienda; la misma mujer se ve a sí misma en directo. Un ladrillo revienta el cristal y la cámara descubre la manifestación avanzando. |
| 2 | 12 s | La cámara cruza la multitud (cabezas de robot de cartón, manos de siete dedos, un hombre medio renderizado) hasta un contenedor verde usado de escenario: **el viejo de traje rosa** arenga por megáfono bajo la bandera amarilla. Un manifestante golpea la cámara. |
| 3 | 12 s | La cámara se recupera, se eleva y sobrevuela la calle en llamas: androides rescatando robots aspiradora del escaparate roto. Avanza hacia el cine clásico. |
| 4 | 12 s | Desciende sobre la marquesina con el cartel de IA mal generado (cíclope, dedos derretidos). Cargan los antidisturbios entre gases. Barrido violento. |
| 5 | 12 s | Sube por la fachada del Eixample hasta la única ventana encendida: un hombre en albornoz insulta con desprecio a su monitor. |
| 6 | 12 s | El monitor lo absorbe y desaparece dentro de la pantalla; la silla gira sola. La cámara retrocede y descubre los tejados de Barcelona ardiendo. |
| 7 | 12 s | Baja de nuevo a la plaza; la multitud calla y mira hacia arriba. La bandera amarilla llena el encuadre a cámara lenta. Fin. |

## Montaje

Los planos se generaron ya como continuaciones directas unos de otros, así que
el montaje es **corte a hueso**, sin transiciones: es lo que sostiene la
ilusión de plano único. Antes de concatenar, cada plano se normaliza al mismo
formato (1280×720, 24 fps, yuv420p, AAC 48 kHz estéreo) y a los que no traen
pista de audio se les añade silencio, para que la concatenación no se
descuadre.

Ver `.github/workflows/montar-onetake.yml` para el montaje reproducible.
