@echo off
title karuAPP Backup
echo ========================================
echo   karuAPP Backup de Base de Datos
echo ========================================
echo.

cd /d "%~dp0"

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python no encontrado.
    pause
    exit /b 1
)

if "%1"=="--rclone" (
    echo [*] Backup local + rclone (Google Drive)
    python backup_db.py --rclone
) else if "%1"=="--upload" (
    echo [*] Backup local + Google Drive API
    python backup_db.py --upload
) else if "%1"=="--status" (
    python backup_db.py --status
    pause
    exit /b 0
) else if "%1"=="--cleanup" (
    python backup_db.py --cleanup %2
) else (
    echo [*] Backup local solamente
    echo [*] Usa --rclone o --upload para subir a la nube
    echo.
    python backup_db.py
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo [OK] Backup completado
) else (
    echo.
    echo [ERROR] Fallo el backup
)

echo.
pause
