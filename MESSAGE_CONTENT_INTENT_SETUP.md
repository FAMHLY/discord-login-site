# Message Content Intent Setup

## Why This Is Required

The bot needs to read message content to respond to user role selections. Discord requires explicit permission for bots to read message content for privacy reasons.

## Setup Steps

### 1. Enable Message Content Intent in Discord Developer Portal

1. Go to https://discord.com/developers/applications
2. Select your bot application (LinkWizard)
3. Click on **"Bot"** in the left sidebar
4. Scroll down to **"Privileged Gateway Intents"**
5. Enable **"MESSAGE CONTENT INTENT"** (toggle it ON)
6. Click **"Save Changes"** at the bottom

### 2. Re-invite the Bot

After enabling the intent, you need to re-invite the bot to your server so it has the new permissions:

1. In the Discord Developer Portal, go to **"OAuth2" > "URL Generator"**
2. Select these **Scopes**:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select these **Bot Permissions**:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Manage Roles
   - ✅ Use Slash Commands
4. Copy the generated URL at the bottom
5. Open the URL in your browser
6. Select your Discord server
7. Click **"Authorize"**

### 3. Restart the Bot

After re-inviting:
- If using Railway: The bot should automatically restart, or trigger a redeploy
- If running locally: Restart the bot server

### 4. Verify It's Working

After restarting, check the logs. You should see:
```
✅ messageCreate event handler registered
📋 Registered event listeners: [ 'ready', 'messageCreate', ... ]
```

When someone sends a message in the #membership channel, you should see:
```
📬 [MESSAGE EVENT] Raw message event received!
```

If you still don't see message events after enabling the intent and re-inviting, the bot may need to be restarted or redeployed.

