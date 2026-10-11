@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
rem Open the browser once the server answers, not before.
start "" /b powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:3939 -TimeoutSec 1 | Out-Null; Start-Process http://localhost:3939; break}catch{Start-Sleep -Milliseconds 500}}"
npm run dev
