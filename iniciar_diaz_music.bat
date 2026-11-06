@echo off
title Diaz Music - Spotify Clone Studio (Full-Stream Edition)
color 0A

echo =====================================================================
echo    DIAZ MUSIC - CLON DE SPOTIFY PRO (PWA + INTERCOM + AUDIFONOS)
echo =====================================================================
echo.
echo [1/2] Iniciando Servidor de Streaming Universal en segundo plano...
start /B python server.py
timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Aplicacion Web y PWA (Vite)...
echo.
echo =====================================================================
echo  Accede desde tu PC en:       http://localhost:5173
echo  Para el celular usa la direccion Network que Vite mostrara abajo.
echo  El celular y la computadora deben estar en la misma red Wi-Fi.
echo =====================================================================
echo.
echo Presiona Ctrl + C para detener.
npm run dev
