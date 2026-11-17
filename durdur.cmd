@echo off
rem 8190 portunu dinleyen kumanda sunucusunu kapatır.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8190 .*LISTENING"') do taskkill /pid %%p /f >nul 2>&1
echo Kumanda sunucusu durduruldu.
