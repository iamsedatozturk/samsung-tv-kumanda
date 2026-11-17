' Sunucuyu pencere açmadan başlatır. Çıktı sunucu.log dosyasına yazılır. Durdurmak: durdur.cmd
Set k = CreateObject("WScript.Shell")
klasor = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
k.CurrentDirectory = klasor
k.Run "cmd /c node server.js > sunucu.log 2>&1", 0, False
