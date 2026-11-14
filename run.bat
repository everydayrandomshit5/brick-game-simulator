@echo off
title BRICK GAME 9999 in 1
cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
echo Starting Retro LCD Brick Game Simulator...
call npx electron . %*
