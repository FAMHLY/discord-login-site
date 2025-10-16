@echo off
echo Testing Discord Login Site Setup...
echo.

echo 1. Checking configured servers...
node check_servers.js

echo.
echo 2. Testing click tracking...
echo Please update test_click_tracking.js with a real invite code first!
echo Then run: node test_click_tracking.js

echo.
echo 3. Starting your server...
echo Run: npm start

pause
