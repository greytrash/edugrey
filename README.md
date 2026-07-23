# MUNDO GRIS — Edición nº001

Repositorio con dos proyectos independientes:

- **`MUNDO GRIS ECOSISTEMA22/`** — todas las webs del medio digital
  **Mundo Gris**: la portada (`index.html`, con el gato director) y la versión
  con el portfolio **ACADEM(IA) GRIS** de Edu Naudín (`academia-gris.html`).
- **`juego-euskadi-norte/`** — **EUSKADI NORTE**, un juego narrativo de
  conducción nocturna (thriller político, prototipo jugable en navegador).

El `index.html` de la raíz solo redirige a `MUNDO GRIS ECOSISTEMA22/index.html`.

Todos los textos son originales de redacción; las imágenes se sirven vía
Wikimedia Commons y los vídeos vía YouTube.

## Cómo verlo

Son webs estáticas autocontenidas (sin build, sin dependencias locales).
Basta con abrir el archivo en el navegador:

```bash
# opción 1: abrir directamente
xdg-open "MUNDO GRIS ECOSISTEMA22/index.html"  # Linux
open "MUNDO GRIS ECOSISTEMA22/index.html"      # macOS

# opción 2: servirlo por HTTP (recomendado, evita restricciones de origen)
python3 -m http.server 8099
# abre http://127.0.0.1:8099/
```

En Windows/macOS/Linux también puedes usar los scripts incluidos:

```bash
./run_server.sh          # Mac/Linux
run_server.bat           # Windows
```

> Las fuentes (Google Fonts), las imágenes (Wikimedia Commons) y los vídeos
> (YouTube) se cargan de la red, así que hace falta conexión para verlo
> completo. Si una imagen no carga, la página genera un sustituto con arte
> generativo en `<canvas>`.

## Detalles técnicos

- **HTML/CSS/JS puro**, sin frameworks ni dependencias.
- **Accesibilidad y movimiento**: respeta `prefers-reduced-motion` (desactiva
  animaciones, ticker y parallax).
- **Interacción**:
  - Editorial narrado por el director con la Web Speech API (síntesis de voz en
    español) y un gato SVG que mueve la boca al hablar.
  - «El Lab»: simulación de difusión ruido → imagen en `<canvas>`, sincronizada
    con el scroll.
  - Cursor personalizado, micro-tilt 3D en las tarjetas, ticker de titulares y
    reveals al hacer scroll.
- **Responsive** hasta móvil, con menú hamburguesa.

## Estructura

```
index.html                          # redirección a MUNDO GRIS ECOSISTEMA22/
MUNDO GRIS ECOSISTEMA22/
  index.html                        # MUNDO GRIS · portada (con gato director)
  academia-gris.html                # MUNDO GRIS + portfolio ACADEM(IA) GRIS
juego-euskadi-norte/
  euskadi-norte.html                # EUSKADI NORTE · juego de conducción
run_server.sh                       # servidor HTTP local (Mac/Linux)
run_server.bat                      # servidor HTTP local (Windows)
```

## Créditos

- **Redacción**: Don Cornelio Malasombra (director), Dani Kroll (Tecnología),
  Irene Valdés (Internacional), Bruno Cendra (Reportajes) y Ramón Escario
  (Opinión).
- Imágenes: Wikimedia Commons. Vídeos: YouTube.
- Instagram: [@nuestromundogris](https://instagram.com/nuestromundogris)
