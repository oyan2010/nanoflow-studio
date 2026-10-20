@echo off
title NanoFlow PC Server

echo ==============================================
echo NanoFlow PC Server (ts-automation)
echo ==============================================
echo.
echo Installing dependencies if needed...
call npm install

echo.
echo Starting server...
npm start

pause
