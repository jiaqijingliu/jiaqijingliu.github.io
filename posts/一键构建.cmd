@echo off
rem Double-click to rebuild post pages, blog list and home "latest notes".
rem Build only - no git commands. Commit and push yourself when ready.

cd /d "%~dp0.."

echo.
echo ========================================
echo   Building posts...
echo ========================================
echo.

call npm run build:html
if errorlevel 1 (
  echo.
  echo [FAILED] See the error above and send it to Claude.
  echo.
  pause
  exit /b 1
)

echo.
echo [DONE] blog/ and the home list are updated.
echo Preview: run "npm run serve" in the repo root, then open http://localhost:8080
echo Publish: git add -A ^&^& git commit -m "..." ^&^& git push
echo.
pause
