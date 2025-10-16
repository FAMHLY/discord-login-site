@echo off
echo Testing LinkWizard Bot Setup...
echo.

echo 1. Testing Discord credentials...
node test_discord_credentials.js

echo.
echo 2. Checking server configuration...
node check_servers.js

echo.
echo 3. If everything looks good, start your server with:
echo    npm start

pause
