@echo off
echo ==========================================
echo   DSK - Start All Services
echo ==========================================
echo.

echo [1/5] Checking PostgreSQL connection...
"C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h localhost -p 5432 >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: PostgreSQL is not running on localhost:5432
    echo   Please start PostgreSQL and try again.
    pause
    exit /b 1
)
echo   PostgreSQL is running.
echo.

echo [2/5] Checking Redis connection...
powershell -Command "try { (New-Object Net.Sockets.TcpClient).Connect('localhost',6379); Write-Host '  Redis is running.' } catch { Write-Host '  WARNING: Redis is not reachable on localhost:6379'; Write-Host '  The worker may have issues, but web will still work.' }"
echo.

echo [3/5] Syncing .env to apps/web...
copy /Y .env apps\web\.env >nul
echo   Done.
echo.

echo [4/5] Syncing database schema...
call pnpm db:push
if %errorlevel% neq 0 (
    echo   WARNING: Database schema sync had issues. Continuing anyway...
)
echo.

echo [5/5] Starting all services (web + worker + realtime)...
echo   Web:      http://localhost:3000
echo   Realtime: http://localhost:3001
echo.
call pnpm dev
pause
