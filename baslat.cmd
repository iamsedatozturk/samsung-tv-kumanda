@echo off
cd /d "%~dp0"
start "" http://localhost:8190
node server.js
