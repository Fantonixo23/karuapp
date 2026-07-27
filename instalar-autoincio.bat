@echo off
cd /d "%~dp0"
title karuAPP - Instalar AutoInicio

echo ============================================
echo   karuAPP - AutoInicio en Windows
echo ============================================
echo.
echo Este script agrega karuAPP al inicio de Windows.
echo Los servidores se iniciaran en segundo plano
echo al iniciar sesion (sin ventanas visibles).
echo.

set "VBS=%CD%\iniciar-silencioso.vbs"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\karuAPP.lnk"

if not exist "%VBS%" (
    echo [ERROR] No se encuentra %VBS%
    pause
    exit /b 1
)

powershell -Command "$ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut('%LNK%'); $lnk.TargetPath='%VBS%'; $lnk.WorkingDirectory='%CD%'; $lnk.Description='karuAPP POS - Servidores'; $lnk.WindowStyle=7; $lnk.Save(); if(Test-Path('%LNK%')){exit 0}else{exit 1}"

if errorlevel 1 (
    echo [ERROR] No se pudo instalar el autoinicio.
    pause
    exit /b 1
)

echo.
echo ============================================
echo    LISTO!
echo ============================================
echo.
echo  karuAPP se iniciara automaticamente al
echo  iniciar sesion, sin ventanas visibles.
echo.
echo  Los logs se guardan en backend\logs\
echo.
echo  Para ver los servidores en ejecucion:
echo    Task Manager ^> Detalles ^> pythonw.exe
echo.
echo  Para ver los logs:
echo    Ejecutar ver-logs.bat
echo.
echo  Para detener los servidores:
echo    Ejecutar detener.bat
echo.
echo  Para desinstalar el autoinicio:
echo    Elimina %LNK%
echo.
pause
