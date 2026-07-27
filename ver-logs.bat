@echo off
chcp 65001 >nul
title karuAPP - Logs

set LOG_DIR=%~dp0backend\logs

if not exist "%LOG_DIR%" (
    echo [INFO] No hay logs aun. Inicia los servidores primero.
    pause
    exit /b
)

echo ========================================
echo   Registros de karuAPP
echo ========================================
echo.
echo  1 - Ver log de Django (servidor principal)
echo  2 - Ver log de Print Service (impresion)
echo  3 - Ver log de Uvicorn (servidor HTTP)
echo  4 - Abrir carpeta de logs
echo  5 - Salir
echo.
choice /c 12345 /n /m "Selecciona una opcion: "

if errorlevel 5 exit /b
if errorlevel 4 start explorer "%LOG_DIR%" & exit /b
if errorlevel 3 (
    if exist "%LOG_DIR%\uvicorn.log" (
        notepad "%LOG_DIR%\uvicorn.log"
    ) else (
        echo [INFO] No hay log de Uvicorn aun.
        pause
    )
    exit /b
)
if errorlevel 2 (
    if exist "%LOG_DIR%\print.log" (
        notepad "%LOG_DIR%\print.log"
    ) else (
        echo [INFO] No hay log de Print Service aun.
        pause
    )
    exit /b
)
if errorlevel 1 (
    if exist "%LOG_DIR%\django.log" (
        notepad "%LOG_DIR%\django.log"
    ) else (
        echo [INFO] No hay log de Django aun.
        pause
    )
    exit /b
)
