@echo off
cd /d "%~dp0"
git add . && git commit -m "update %date% %time%" && git push
echo.
echo === push complete. Netlify will redeploy in ~30s ===
pause
