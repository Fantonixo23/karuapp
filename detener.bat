@echo off
chcp 65001 >nul
title karuAPP - Detener servidores
echo [*] Deteniendo servidores karuAPP...
taskkill /f /im pythonw.exe >nul 2>&1
echo [OK] Servidores detenidos.
timeout /t 2 >nul
