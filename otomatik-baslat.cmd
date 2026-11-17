@echo off
rem Windows açılınca sunucuyu gizli başlatır (Başlangıç klasörüne kısayol koyar) ve hemen başlatır.
rem Kaldırmak için: otomatik-baslat.cmd kaldir
set "KISAYOL=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\TV Kumanda.lnk"
if /i "%~1"=="kaldir" (del "%KISAYOL%" 2>nul & echo Otomatik baslatma kaldirildi. & exit /b)
powershell -NoProfile -Command "$k=(New-Object -ComObject WScript.Shell).CreateShortcut('%KISAYOL%'); $k.TargetPath='wscript.exe'; $k.Arguments='\"%~dp0arkaplan.vbs\"'; $k.WorkingDirectory='%~dp0'; $k.Save()"
wscript "%~dp0arkaplan.vbs"
echo Tamam. Kumanda arka planda calisiyor: http://localhost:8190
