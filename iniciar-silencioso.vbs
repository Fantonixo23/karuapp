' karuAPP - Iniciar servidores en segundo plano (sin ventanas)
' Ejecuta Django + Print Service con pythonw.exe

Dim fso, shell, basePath, venvPython, logDir
Set fso = CreateObject("Scripting.FileSystemObject")
basePath = fso.GetParentFolderName(WScript.ScriptFullName) & "\backend"
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = basePath

' Asegurar que existe la carpeta de logs
logDir = basePath & "\logs"
If Not fso.FolderExists(logDir) Then
    fso.CreateFolder(logDir)
End If

venvPython = basePath & "\venv\Scripts\pythonw.exe"

' Verificar que el venv existe
If Not fso.FileExists(venvPython) Then
    shell.Popup "No se encontro el entorno virtual." & vbCrLf & _
                "Ejecute primero instalar-nativo.bat", 5, "karuAPP - Error", 16
    WScript.Quit 1
End If

' Iniciar ambos servidores (ventana oculta = 0, asincrono = False)
' Django + Socket.IO
shell.Run """" & venvPython & """ socket_server.py", 0, False

' Print Service (esperar 2 segundos para evitar race condition)
WScript.Sleep 2000
shell.Run """" & venvPython & """ print_service\print_server.py", 0, False

WScript.Sleep 1000
shell.Run "http://localhost:8000", 1, False
