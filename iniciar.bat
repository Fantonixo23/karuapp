@echo off
chcp 65001 >nul
title karuAPP - Servidores
cd /d "%~dp0backend"

if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] No se encontro el entorno virtual.
    echo         Ejecute primero instalar-nativo.bat
    pause
    exit /b 1
)

call venv\Scripts\activate

echo ============================================
echo    Iniciando servidores...
echo ============================================
echo   Django:  http://localhost:8000
echo   Print:   http://localhost:5123
echo.

:: Verificar pywin32 antes de lanzar print server
echo [*] Verificando dependencia de impresion...
python -c "import win32print" 2>nul
if errorlevel 1 (
    echo [WARN] pywin32 no instalado. Instalando...
    pip install pywin32
    python -c "import win32print" 2>nul
    if errorlevel 1 (
        echo [ERROR] No se pudo instalar pywin32.
        echo         La impresion termica no funcionara.
        echo.
    ) else (
        echo [OK] pywin32 instalado.
    )
) else (
    echo [OK] pywin32 disponible.
)

echo.
start "karuAPP - Django" /D "%~dp0backend" cmd /k "venv\Scripts\activate && python socket_server.py"
start "karuAPP - Print"  /D "%~dp0backend" cmd /k "venv\Scripts\activate && python print_service\print_server.py"

timeout /t 3 >nul
start http://localhost:8000

echo [OK] Servidores iniciados en ventanas separadas.
echo.
echo  Para iniciar sin ventanas visibles:
echo    Ejecutar iniciar-silencioso.vbs
echo.
pause
