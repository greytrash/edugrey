#!/bin/bash
# Script para ejecutar el servidor HTTP local del juego (Mac/Linux)

echo ""
echo "🚀 Iniciando servidor HTTP para Dalinian Roads..."
echo "📍 Abre tu navegador en: http://127.0.0.1:8099/"
echo "⏹️  Presiona Ctrl+C para detener el servidor"
echo ""

cd "$(dirname "$0")"
python3 -m http.server 8099
