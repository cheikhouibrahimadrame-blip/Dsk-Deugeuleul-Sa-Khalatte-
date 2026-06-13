@echo off
echo ==========================================
echo   DSK Project Local Setup for Windows
echo ==========================================
echo.

echo [1/6] Enabling corepack and configuring pnpm...
call corepack enable
call corepack prepare pnpm@9.15.0 --activate
echo.

echo [2/6] Installing project dependencies...
call pnpm install
echo.

echo [3/6] Starting Docker containers (Postgres ^& Redis)...
call docker compose up -d
echo.

echo [4/6] Checking for .env file...
IF NOT EXIST ".env" (
    IF EXIST ".env.example" (
        copy .env.example .env
        echo Created .env from .env.example.
    )
) ELSE (
    echo .env already exists.
)
echo.

echo [5/6] Setting up database schema and seeding...
call pnpm db:migrate
call pnpm db:seed
echo.

echo [6/6] Setup complete! Starting the development server...
call pnpm dev
pause