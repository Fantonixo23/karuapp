@echo off
title karuAPP Print Service - COCINA
echo ========================================
echo   karuAPP Print Service
echo   Impresora de COCINA
echo ========================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python no encontrado. Instale Python 3.8+
    pause
    exit /b 1
)

echo [*] Verificando dependencias...
python -c "import win32print" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [*] Instalando pywin32...
    pip install pywin32
)

set PRINT_API_TOKEN=pipper-print-token-default

echo [*] Iniciando servidor en http://0.0.0.0:5123
echo [*] Presione Ctrl+C para detener
echo.
python print_server.py

pause
