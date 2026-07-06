@echo off
REM Servidor HTTP local para Mundo Gris en Windows

echo.
echo 🚀 Iniciando servidor HTTP para Mundo Gris...
echo 📍 Abre tu navegador en: http://127.0.0.1:8099/
echo ⏹️  Presiona Ctrl+C para detener el servidor
echo.

python3 -m http.server 8099
pause
