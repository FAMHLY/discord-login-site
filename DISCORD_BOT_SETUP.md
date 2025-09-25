# 🤖 Discord Bot Setup Guide

This guide will help you set up a Discord bot that can generate invite links for your server monetization platform.

## 📋 Prerequisites

- Node.js (v16 or higher)
- A Discord account
- Access to Discord Developer Portal

## 🚀 Step-by-Step Setup

### 1. Create Discord Application & Bot

1. **Go to Discord Developer Portal**: https://discord.com/developers/applications
2. **Click "New Application"**
3. **Name your application** (e.g., "Discord Monetization Bot")
4. **Go to "Bot" section** in the left sidebar
5. **Click "Add Bot"**
6. **Copy the Bot Token** (keep this secret!)

### 2. Generate Bot Invite Link

1. **Open `generate_bot_invite.html`** in your browser
2. **Enter your Application Client ID** (found in the "General Information" section)
3. **Click "Generate Bot Invite Link"**
4. **Copy the generated link**

### 3. Add Bot to Your Server

1. **Click the generated invite link**
2. **Select your Discord server**
3. **Authorize the bot** with the required permissions:
   - Create Instant Invite
   - Manage Server
   - Read Message History
   - Send Messages
   - View Channels

### 4. Set Up Bot Code

1. **Install dependencies**:
   ```bash
   npm install discord.js express cors dotenv
   ```

2. **Create environment file**:
   ```bash
   cp bot.env.example .env
   ```

3. **Edit `.env` file**:
   ```
   DISCORD_BOT_TOKEN=your_actual_bot_token_here
   PORT=3001
   ```

4. **Start the bot**:
   ```bash
   node discord-bot.js
   ```

### 5. Test the Bot

The bot will start an API server on port 3001. You can test it with:

```bash
# Health check
curl http://localhost:3001/health

# List servers
curl http://localhost:3001/api/servers

# Generate invite (replace SERVER_ID with actual server ID)
curl -X POST http://localhost:3001/api/generate-invite \
  -H "Content-Type: application/json" \
  -d '{"serverId": "YOUR_SERVER_ID"}'
```

## 🔧 Integration with Your Main App

### Update Your API Endpoint

You'll need to update your main application's `/api/servers/:serverId/invite` endpoint to call the bot API:

```javascript
// In your api/index.js
app.post('/api/servers/:serverId/invite', async (req, res) => {
  try {
    const { serverId } = req.params;
    
    // Call the Discord bot API
    const botResponse = await fetch('http://localhost:3001/api/generate-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ serverId })
    });
    
    const result = await botResponse.json();
    
    if (result.success) {
      // Update your database with the invite code
      const { data, error } = await supabase
        .from('discord_servers')
        .update({ invite_code: result.invite_code })
        .eq('discord_server_id', serverId);
      
      if (error) throw error;
      
      res.json({
        success: true,
        invite_code: result.invite_code,
        invite_url: result.invite_url
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
    
  } catch (error) {
    console.error('Error generating invite:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invite' });
  }
});
```

## 🚀 Deployment Options

### Option 1: Local Development
- Run the bot locally alongside your main app
- Use `http://localhost:3001` for bot API calls

### Option 2: Separate Server
- Deploy the bot to a separate server (Heroku, Railway, etc.)
- Update the bot API URL in your main app

### Option 3: Same Server
- Deploy both apps to the same server
- Use `http://localhost:3001` or internal networking

## 🔒 Security Considerations

1. **Keep your bot token secret** - never commit it to version control
2. **Use environment variables** for all sensitive data
3. **Implement rate limiting** on your API endpoints
4. **Validate server ownership** before generating invites
5. **Monitor bot permissions** regularly

## 🐛 Troubleshooting

### Bot Not Responding
- Check if the bot is online in Discord
- Verify the bot token is correct
- Check console logs for errors

### Permission Errors
- Ensure the bot has the required permissions in your server
- Check if the bot is in the server you're trying to generate invites for

### API Connection Issues
- Verify the bot API server is running
- Check the port number and URL
- Ensure no firewall is blocking the connection

## 📞 Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure the bot has proper permissions in your Discord server
4. Test the API endpoints individually

## 🎉 Next Steps

Once your bot is set up and working:
1. Test invite generation through your dashboard
2. Set up monitoring and logging
3. Consider adding more features like invite analytics
4. Deploy to production when ready

Happy coding! 🚀
