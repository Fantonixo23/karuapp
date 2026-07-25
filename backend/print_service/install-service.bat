@echo off
title Instalar karuAPP Auto-Start
echo ========================================
echo   Instalar arranque automatico
echo ========================================
echo.
echo Este script configura todo para que karuAPP
echo arranque automaticamente al iniciar Windows.
echo.
echo Requisitos:
echo   1. Docker Desktop instalado
echo   2. Configurar Docker > Settings > General
echo      > "Start Docker Desktop when you log in"
echo.

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python no encontrado. Instale Python 3.8+
    pause
    exit /b 1
)

echo [1/4] Instalando dependencias...
pip install pywin32

echo [2/4] Verificando instalacion...
python -c "import win32print; print('[OK] pywin32 instalado')"

echo [3/4] Copiando a inicio de Windows...
set PROYECTO_DIR=%~dp0..\..
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

copy "%PROYECTO_DIR%\scripts\inicio-automatico.bat" "%STARTUP_DIR%\karuAPP-AutoStart.bat" >nul

if errorlevel 1 (
    echo [ERROR] No se pudo copiar a Startup
) else (
    echo [OK] Acceso directo creado en inicio de Windows
)

echo [4/4] Creando acceso en escritorio...
echo @echo off > "%TEMP%\pipper-print-only.bat"
echo cd /d "%~dp0" >> "%TEMP%\pipper-print-only.bat"
echo start /MIN python "%~dp0print_server.py" >> "%TEMP%\pipper-print-only.bat"
copy "%TEMP%\pipper-print-only.bat" "%USERPROFILE%\Desktop\Pipper-IniciarImpresora.bat" >nul

echo.
echo ========================================
echo   INSTALACION COMPLETADA
echo ========================================
echo.
echo  Ya esta todo configurado.
echo.
echo  Proximo reinicio de Windows:
echo    1. Docker Desktop arranca solo
echo    2. karuAPP-AutoStart espera Docker
echo    3. Inicia todo (app + impresora)
echo.
echo  Para arrancar ahora sin reiniciar:
echo    Ejecutar: start.bat
echo.
pause
