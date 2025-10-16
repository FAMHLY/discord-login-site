# 🚀 Railway Deployment for Discord Bot Join Tracking

## Why Railway?

The current system only tracks **clicks** via serverless functions, but **join tracking** requires a persistent bot connection. Railway provides:

- ✅ **24/7 Persistent Connection**: Bot stays online to detect joins
- ✅ **Free Tier**: No cost for basic usage
- ✅ **Auto-Deploy**: Deploys from GitHub automatically
- ✅ **Environment Variables**: Easy configuration

## 🚀 Quick Deployment Steps

### 1. Deploy to Railway

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up/Login** with GitHub
3. **Create New Project** → **Deploy from GitHub repo**
4. **Select your repository**: `discord-login-site`
5. **Choose the root directory**

### 2. Configure Deployment

Railway will auto-detect the deployment, but you need to:

1. **Set the Start Command**: `node railway-deploy-bot.js`
2. **Set Environment Variables**:
   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

### 3. Get Your Railway URL

After deployment, Railway will give you a URL like:
```
https://your-project-name.up.railway.app
```

### 4. Test the Deployment

Visit: `https://your-project-name.up.railway.app/health`

You should see:
```json
{
  "status": "healthy",
  "bot_online": true,
  "uptime": 123.456,
  "timestamp": "2025-01-16T04:00:00.000Z"
}
```

## 🔧 Environment Variables Needed

In Railway dashboard, add these environment variables:

```bash
DISCORD_BOT_TOKEN=your_discord_bot_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PORT=3001
```

## 📊 What This Enables

Once deployed, your bot will:

1. **Stay Online 24/7**: Persistent connection to Discord
2. **Detect Joins**: Automatically track when people join your server
3. **Update Database**: Increment join counts and conversion rates
4. **Affiliate Attribution**: Link joins to recent clicks

## 🧪 Testing Join Tracking

1. **Click an invite link** (creates "clicked" record)
2. **Join the Discord server** (bot detects join)
3. **Check your dashboard** (should show join count updated)

## 🎯 Expected Results

Before Railway deployment:
```
✅ Clicks: 2
❌ Joins: 0 (bot not running)
❌ Conversion Rate: 0%
```

After Railway deployment:
```
✅ Clicks: 2
✅ Joins: 1 (bot detected your join)
✅ Conversion Rate: 50%
```

## 💰 Cost

- **Railway Free Tier**: $0/month for basic usage
- **Railway Pro**: $5/month if you need more resources

## 🔄 Alternative: Quick Local Test

If you want to test locally first:

```bash
# Install dependencies
npm install discord.js @supabase/supabase-js express dotenv

# Set environment variables in .env
DISCORD_BOT_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key

# Run the bot
node railway-deploy-bot.js
```

## 🚨 Important Notes

1. **Bot Permissions**: Make sure your bot has "View Server Members" permission
2. **Server Access**: Bot must be in your Discord server
3. **Intent Settings**: Bot needs "Server Members Intent" enabled in Discord Developer Portal

## 📈 Monitoring

After deployment, you can:

- **Check Railway logs**: See bot activity in real-time
- **Monitor health endpoint**: `https://your-railway-url/health`
- **View Discord bot status**: Bot should show as "Online" in Discord

This will complete your affiliate tracking system with both click and join tracking! 🎉
