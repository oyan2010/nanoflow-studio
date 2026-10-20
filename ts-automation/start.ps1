$Host.UI.RawUI.WindowTitle = "NanoFlow PC Server"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "NanoFlow PC Server (ts-automation)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Installing dependencies if needed..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Starting server..." -ForegroundColor Green
npm start

Write-Host ""
Read-Host -Prompt "Press Enter to exit"
