@echo off
title Painel de Pregoes - servidor do Wi-Fi
cd /d "%~dp0"
:inicio
node servidor\server.mjs
rem Codigo 3 = ja existe outro servidor rodando nesta porta: nao religa.
if errorlevel 3 if not errorlevel 4 goto fim
echo.
echo O servidor parou. Religando em 5 segundos... (feche esta janela para desligar de vez)
timeout /t 5 /nobreak >nul
goto inicio
:fim
pause
