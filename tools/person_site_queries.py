#!/usr/bin/env python3
"""Generador de consultas de búsqueda «persona × sitio».

Lee un JSON de configuración con nombres (o alias), sitios oficiales, sitios no
oficiales y, opcionalmente, palabras clave, y produce el conjunto COMPLETO y
determinista de consultas:

  * "Nombre" site:dominio            → para cada nombre × cada sitio
  * "Nombre" "palabra clave"          → para cada nombre × cada palabra clave
  * "Nombre" "término 1" "término 2"  → si la palabra clave es una lista de términos

Sin dependencias externas. Uso:

  python3 tools/person_site_queries.py tools/person_site_queries.example.json
  python3 tools/person_site_queries.py config.json --formato txt
  python3 tools/person_site_queries.py config.json --urls google --salida out.json

Las claves aceptadas en el JSON son las mismas que emite la herramienta:
  nombres, sitios_oficiales, sitios_no_oficiales, palabras_clave (opcional).
Cualquier `consultas_generadas` presente en la entrada se ignora y se recalcula.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable
from urllib.parse import quote_plus

MOTORES = {
    "google": "https://www.google.com/search?q={q}",
    "duckduckgo": "https://duckduckgo.com/?q={q}",
    "bing": "https://www.bing.com/search?q={q}",
}


def _limpiar(valores: Iterable[str] | None) -> list[str]:
    """Normaliza una lista: recorta espacios, descarta vacíos y duplicados."""
    vistos: set[str] = set()
    salida: list[str] = []
    for v in valores or []:
        v = str(v).strip()
        if not v or v in vistos:
            continue
        vistos.add(v)
        salida.append(v)
    return salida


def _palabra_clave(entrada) -> str:
    """Convierte una palabra clave (str o lista de términos) en texto entrecomillado.

    "periodista"              → '"periodista"'
    ["lista", "periodistas"]  → '"lista" "periodistas"'
    """
    terminos = entrada if isinstance(entrada, (list, tuple)) else [entrada]
    return " ".join(f'"{t}"' for t in _limpiar(terminos))


def _dominio(sitio: str) -> str:
    """Convierte «https://www.boe.es/ruta» o «boe.es» en «boe.es»."""
    s = sitio.strip()
    for prefijo in ("https://", "http://"):
        if s.lower().startswith(prefijo):
            s = s[len(prefijo):]
    s = s.split("/", 1)[0]
    if s.lower().startswith("www."):
        s = s[4:]
    return s


def generar_consultas(config: dict) -> list[str]:
    """Devuelve la lista completa de consultas, en orden estable y sin duplicados.

    Orden: sitios oficiales → sitios no oficiales → palabras clave; dentro de
    cada bloque, nombre por nombre.
    """
    nombres = _limpiar(config.get("nombres"))
    oficiales = _limpiar(_dominio(s) for s in config.get("sitios_oficiales") or [])
    no_oficiales = _limpiar(_dominio(s) for s in config.get("sitios_no_oficiales") or [])
    palabras = _limpiar(_palabra_clave(p) for p in config.get("palabras_clave") or [])

    consultas: list[str] = []
    for bloque in (oficiales, no_oficiales):
        for nombre in nombres:
            for sitio in bloque:
                consultas.append(f'"{nombre}" site:{sitio}')
    for nombre in nombres:
        for palabra in palabras:
            if palabra == f'"{nombre}"':
                continue
            consultas.append(f'"{nombre}" {palabra}')
    return _limpiar(consultas)


def construir_salida(config: dict, motor: str | None = None) -> dict:
    consultas = generar_consultas(config)
    salida = {
        "nombres": _limpiar(config.get("nombres")),
        "sitios_oficiales": _limpiar(_dominio(s) for s in config.get("sitios_oficiales") or []),
        "sitios_no_oficiales": _limpiar(_dominio(s) for s in config.get("sitios_no_oficiales") or []),
        "palabras_clave": [p for p in config.get("palabras_clave") or [] if _palabra_clave(p)],
        "consultas_generadas": consultas,
    }
    if motor:
        plantilla = MOTORES[motor]
        salida["urls"] = [plantilla.format(q=quote_plus(c)) for c in consultas]
    return salida


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("config", type=Path, help="JSON con nombres y sitios")
    parser.add_argument("--formato", choices=("json", "txt"), default="json",
                        help="json (objeto completo) o txt (una consulta por línea)")
    parser.add_argument("--urls", choices=sorted(MOTORES), default=None,
                        help="añade URLs listas para abrir en el buscador indicado")
    parser.add_argument("--salida", type=Path, default=None,
                        help="fichero de salida; por defecto se imprime en stdout")
    args = parser.parse_args(argv)

    try:
        config = json.loads(args.config.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: no se pudo leer {args.config}: {exc}", file=sys.stderr)
        return 1
    if not isinstance(config, dict):
        print("error: el JSON debe ser un objeto con claves nombres/sitios_*", file=sys.stderr)
        return 1

    salida = construir_salida(config, args.urls)
    if not salida["consultas_generadas"]:
        print("aviso: no se generó ninguna consulta (¿faltan nombres o sitios?)", file=sys.stderr)

    if args.formato == "txt":
        lineas = salida.get("urls") if args.urls else salida["consultas_generadas"]
        texto = "\n".join(lineas) + "\n"
    else:
        texto = json.dumps(salida, ensure_ascii=False, indent=2) + "\n"

    if args.salida:
        args.salida.write_text(texto, encoding="utf-8")
    else:
        sys.stdout.write(texto)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
