@echo off
title karuAPP Print Service
echo ========================================
echo   karuAPP Print Service
echo   Servicio de impresion termica
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

REM Configurar token si no está definido
if "%PRINT_API_TOKEN%"=="" (
    set PRINT_API_TOKEN=pipper-print-token-change-me
    echo [*] Usando PRINT_API_TOKEN por defecto
)

echo [*] Iniciando servidor en http://localhost:5123
echo [*] Presione Ctrl+C para detener
echo.
python print_server.py

pause
