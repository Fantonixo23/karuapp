@echo off
chcp 65001 >nul
title Pipperfood - Instalador Nativo
setlocal enabledelayedexpansion

echo ============================================
echo    Pipperfood POS - Instalador Nativo
echo ============================================
echo.
echo Instalador sin Docker. Requiere Python 3.12+.
echo.

:: --- 1. Verificar Python ---
echo [1/7] Verificando Python 3.12+...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Python no encontrado. Descargando Python 3.12...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe' -OutFile '%TEMP%\python-install.exe'}"
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo descargar Python.
        echo         Descargalo manualmente de: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo Instalando Python...
    start /wait "" "%TEMP%\python-install.exe" /quiet InstallAllUsers=1 PrependPath=1
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar Python.
        pause
        exit /b 1
    )
    echo [OK] Python 3.12 instalado.
) else (
    for /f "tokens=2 delims=. " %%a in ('python --version 2^>^&1') do set PY_MAJOR=%%a
    for /f "tokens=3 delims=. " %%a in ('python --version 2^>^&1') do set PY_MINOR=%%a
    if !PY_MAJOR! lss 3 (
        echo [ERROR] Se requiere Python 3.12 o superior.
        pause
        exit /b 1
    )
    if !PY_MAJOR! equ 3 if !PY_MINOR! lss 12 (
        echo [ERROR] Se requiere Python 3.12 o superior.
        pause
        exit /b 1
    )
    echo [OK] Python !PY_MAJOR!.!PY_MINOR! detectado.
)

:: --- 2. Crear virtualenv ---
echo.
echo [2/7] Creando entorno virtual...
if exist "backend\venv" (
    echo [INFO] Entorno virtual ya existe.
) else (
    python -m venv backend\venv
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo crear el entorno virtual.
        pause
        exit /b 1
    )
    echo [OK] Entorno virtual creado.
)

:: --- 3. Instalar dependencias ---
echo.
echo [3/7] Instalando dependencias...
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] No se pudieron instalar las dependencias.
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas.

:: --- 4. Configurar cliente ---
echo.
echo [4/7] Configuracion del cliente
echo.
set /p NOMBRE="Nombre del restaurante: "
if "%NOMBRE%"=="" set NOMBRE=Mi Restaurante

for /f "delims=" %%i in ('python -c "import secrets, string; print(secrets.token_hex(25))"') do set SECRET_KEY=%%i

(
    echo DB_ENGINE=django.db.backends.sqlite3
    echo DB_NAME=datos.db
    echo LICENSE_SERVER_URL=https://KaruAPP.pythonanywhere.com
    echo SECRET_KEY=%SECRET_KEY%
    echo DEBUG=False
    echo LICENCIA_NOMBRE=%NOMBRE%
    echo PRINT_API_TOKEN=pipper-print-token-default
) > backend\config.env

echo [OK] Configuracion guardada.

:: --- 5. Migrar y crear usuarios ---
echo.
echo [5/7] Ejecutando migraciones...
cd backend
python manage.py migrate --noinput
if %errorlevel% neq 0 (
    echo [ERROR] Fallaron las migraciones.
    cd ..
    pause
    exit /b 1
)
echo [OK] Migraciones ejecutadas.

echo.
echo Creando usuarios por defecto...
python manage.py crear_usuarios
echo [OK] Usuarios creados.
cd ..

:: --- 6. Verificar frontend ---
echo.
echo [6/7] Verificando frontend...
if not exist "backend\frontend\index.html" (
    echo [WARN] No se encontro el frontend compilado.
    echo.
    where node >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Node.js detectado. Reconstruyendo frontend...
        cd frontend-react
        call npm install
        if !errorlevel! equ 0 (
            call npm run build
        )
        cd ..
        if exist "backend\frontend\index.html" (
            echo [OK] Frontend reconstruido.
        ) else (
            echo [WARN] No se pudo reconstruir el frontend.
        )
    ) else (
        echo [INFO] Node.js no detectado. Para reconstruir el frontend:
        echo         Instala Node.js desde https://nodejs.org/
        echo         Luego ejecuta en frontend-react:
        echo           npm install ^&^& npm run build
        echo.
    )
) else (
    echo [OK] Frontend encontrado.
)

:: --- 7. Iniciar servidor ---
echo.
echo [7/7] Iniciando servidor...
echo.
echo ============================================
echo    Instalacion completada con exito
echo ============================================
echo.
echo  Sistema:  karuAPP POS
echo  Cliente:  %NOMBRE%
echo.
echo  Para iniciar los servidores:
echo    - Con ventanas:   iniciar.bat
echo    - Sin ventanas:   iniciar-silencioso.vbs
echo.
echo  Abriendo http://localhost:8000 ...
echo.
start http://localhost:8000
cd backend
call venv\Scripts\activate
python socket_server.py
pause
