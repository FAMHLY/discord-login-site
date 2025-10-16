# Discord Bot Server Deployment Guide

This guide will help you deploy the Discord bot to a persistent server for better performance and reliability.

## Why Deploy to a Persistent Server?

- **No Cold Starts**: Instant response times
- **Persistent Connection**: Bot stays online 24/7
- **Better Performance**: No connection delays
- **More Reliable**: No serverless timeout issues

## Deployment Options

### Option 1: Railway (Recommended)

Railway offers persistent hosting with automatic deployments.

1. **Sign up at [Railway.app](https://railway.app)**

2. **Create a new project**:
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository

3. **Configure the deployment**:
   - Railway will automatically detect the bot-server.js
   - Set environment variables:
     ```
     DISCORD_BOT_TOKEN=your_bot_token_here
     PORT=3001
     ```

4. **Deploy**:
   - Railway will automatically build and deploy
   - Your bot will be available at: `https://your-project-name.up.railway.app`

### Option 2: Render

1. **Sign up at [Render.com](https://render.com)**

2. **Create a new Web Service**:
   - Connect your GitHub repository
   - Choose "Web Service"

3. **Configure**:
   - **Build Command**: `npm install`
   - **Start Command**: `node bot-server.js`
   - **Environment**: `Node`
   - **Plan**: Free tier available

4. **Set Environment Variables**:
   ```
   DISCORD_BOT_TOKEN=your_bot_token_here
   ```

### Option 3: VPS/Cloud Server

For maximum control, deploy to a VPS:

1. **Set up a server** (DigitalOcean, AWS, etc.)
2. **Install Node.js** (version 18+)
3. **Clone your repository**
4. **Install dependencies**: `npm install`
5. **Set environment variables**
6. **Run with PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start bot-server.js --name discord-bot
   pm2 startup
   pm2 save
   ```

## Update Your Main Application

After deploying the bot server, update your main Vercel application to use the new bot server URL instead of the local bot utilities.

### Update api/index.js

Replace the bot utility imports with HTTP calls to your deployed bot server:

```javascript
// Replace this:
const { generateDiscordInvite } = require('./bot-utils');

// With this:
async function callBotServer(endpoint, data) {
    const response = await fetch(`https://your-bot-server-url.com${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}
```

## Environment Variables

Make sure to set these environment variables in your bot server deployment:

- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `PORT`: Server port (Railway/Render will set this automatically)

## Testing

After deployment, test your bot server:

1. **Health Check**: `https://your-bot-server-url.com/api/bot/health`
2. **Generate Invite**: Test the invite generation endpoint
3. **Monitor Logs**: Check the deployment logs for any errors

## Benefits

- ⚡ **Instant Response**: No more 7-10 second delays
- 🔄 **Always Online**: Bot stays connected 24/7
- 📊 **Better Monitoring**: Persistent logs and metrics
- 🛡️ **More Reliable**: No serverless timeouts or cold starts

## Cost

- **Railway**: Free tier available, $5/month for production
- **Render**: Free tier available, $7/month for production
- **VPS**: $5-10/month depending on provider

The persistent server approach will give you much better performance and reliability compared to serverless functions for Discord bots.
