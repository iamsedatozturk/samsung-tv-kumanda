@echo off
rem Sunucu calismiyorsa gizli baslatir, sonra sayfayi acar. Konsol penceresi kalmaz.
cd /d "%~dp0"
netstat -ano | findstr /r /c:":8190 .*LISTENING" >nul || (wscript "%~dp0arkaplan.vbs" & timeout /t 2 /nobreak >nul)
start "" http://localhost:8190
