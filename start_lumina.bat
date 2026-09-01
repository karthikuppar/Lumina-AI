@echo off
echo Starting Lumina AI Stack...

:: Start Backend
start cmd /k "cd backend && python main.py"

:: Start Frontend
start cmd /k "cd frontend && npm run dev"

echo Lumina AI is warming up. Check the new windows for status!