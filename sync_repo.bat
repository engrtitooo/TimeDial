@echo off
echo Syncing changes to GitHub...
git add .
set "timestamp=%date% %time%"
git commit -m "Auto-sync: %timestamp%"
git push origin main
echo Sync complete.
pause
