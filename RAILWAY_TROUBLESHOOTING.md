# 🚨 Railway Repository Not Found - Troubleshooting Guide

## Common Issues & Solutions

### 1. Repository Visibility
**Problem**: Railway can't see private repositories
**Solution**: 
- Make sure your repository is **public** (temporarily for deployment)
- Or upgrade to Railway Pro plan for private repo access

### 2. GitHub Permissions
**Problem**: Railway doesn't have access to your repositories
**Solution**:
1. Go to [GitHub Settings](https://github.com/settings/applications)
2. Find "Railway" in authorized apps
3. Click "Configure" → "Repository access"
4. Select "All repositories" or add your specific repo

### 3. Repository Not Showing
**Problem**: Repository doesn't appear in Railway's list
**Solution**:
1. **Refresh Railway page** (Ctrl+F5)
2. **Check repository name** - make sure it's exactly `discord-login-site`
3. **Try different approach** (see alternative methods below)

## 🚀 Alternative Deployment Methods

### Method 1: Direct File Upload to Railway

If GitHub linking isn't working, you can deploy directly:

1. **Create New Project** in Railway
2. **Choose "Empty Project"**
3. **Upload these files directly**:
   - `railway-deploy-bot.js`
   - `railway-package.json`
   - `.env` (with your environment variables)

### Method 2: Railway CLI

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Initialize project**:
   ```bash
   railway init
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

### Method 3: Manual Repository Push

1. **Create a new repository** specifically for the bot:
   ```bash
   # Create new repo on GitHub called "discord-bot-railway"
   ```

2. **Copy the bot files** to the new repo:
   ```bash
   git clone https://github.com/FAMHLY/discord-bot-railway.git
   cp railway-deploy-bot.js discord-bot-railway/
   cp railway-package.json discord-bot-railway/package.json
   cd discord-bot-railway
   git add .
   git commit -m "Add Discord bot for join tracking"
   git push origin main
   ```

3. **Deploy from the new repo** in Railway

## 🔧 Quick Manual Setup (No GitHub Required)

If all else fails, you can create the bot files directly in Railway:

### Step 1: Create Empty Project
1. Go to Railway.app
2. Click "New Project"
3. Choose "Empty Project"

### Step 2: Add Files
In Railway's file editor, create:

**File 1: `package.json`**
```json
{
  "name": "discord-bot-railway",
  "version": "1.0.0",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "@supabase/supabase-js": "^2.39.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  }
}
```

**File 2: `bot.js`**
```javascript
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

console.log('🚀 Starting Railway Discord Bot with Join Tracking...');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3001;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot_online: client.isReady(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

client.once('clientReady', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} servers`);
});

client.on('guildMemberAdd', async (member) => {
  console.log(`👤 New member joined: ${member.user.tag} in ${member.guild.name}`);
  
  try {
    await trackMemberJoin(member);
  } catch (error) {
    console.error('Error tracking member join:', error);
  }
});

async function trackMemberJoin(member) {
  try {
    console.log(`📊 Tracking join for ${member.user.tag} in ${member.guild.name}`);
    
    const { data: pendingRecords, error: pendingError } = await supabase
      .from('affiliate_tracking')
      .select('*')
      .eq('discord_server_id', member.guild.id)
      .eq('conversion_status', 'clicked')
      .is('join_timestamp', null)
      .order('click_timestamp', { ascending: false })
      .limit(10);
    
    if (pendingError) {
      console.error('Error fetching pending tracking records:', pendingError);
      return;
    }
    
    if (!pendingRecords || pendingRecords.length === 0) {
      console.log('No pending tracking records found - this might be an organic join');
      
      const { error: createError } = await supabase
        .from('affiliate_tracking')
        .insert({
          discord_server_id: member.guild.id,
          invite_code: 'ORGANIC',
          affiliate_id: null,
          conversion_status: 'joined',
          user_discord_id: member.user.id,
          join_timestamp: new Date().toISOString(),
          click_timestamp: new Date().toISOString()
        });
        
      if (createError) {
        console.error('Error creating organic join record:', createError);
      } else {
        console.log('✅ Created organic join tracking record');
        await updateServerJoinCount(member.guild.id);
      }
      return;
    }
    
    const mostRecentClick = pendingRecords[0];
    
    console.log(`📈 Associating join with tracking record: ${mostRecentClick.id}`);
    
    const { error: updateError } = await supabase
      .from('affiliate_tracking')
      .update({
        conversion_status: 'joined',
        user_discord_id: member.user.id,
        join_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', mostRecentClick.id);
      
    if (updateError) {
      console.error('Error updating tracking record:', updateError);
      return;
    }
    
    console.log('✅ Updated tracking record to joined status');
    await updateServerJoinCount(member.guild.id);
    
  } catch (error) {
    console.error('Error in trackMemberJoin:', error);
  }
}

async function updateServerJoinCount(guildId) {
  try {
    console.log(`📊 Updating join count for server: ${guildId}`);
    
    const { data: currentServer, error: currentError } = await supabase
      .from('discord_servers')
      .select('total_joins')
      .eq('discord_server_id', guildId)
      .single();
      
    if (currentError) {
      console.error('Error fetching current server stats:', currentError);
      return;
    }
    
    const currentJoins = currentServer?.total_joins || 0;
    const newJoinCount = currentJoins + 1;
    
    const { error: updateError } = await supabase
      .from('discord_servers')
      .update({ 
        total_joins: newJoinCount,
        updated_at: new Date().toISOString()
      })
      .eq('discord_server_id', guildId);
      
    if (updateError) {
      console.error('Error updating server join count:', updateError);
      return;
    }
    
    console.log(`✅ Updated server join count from ${currentJoins} to ${newJoinCount}`);
    
  } catch (error) {
    console.error('Error updating server join count:', error);
  }
}

async function startServer() {
  try {
    if (!process.env.DISCORD_BOT_TOKEN) {
      throw new Error('DISCORD_BOT_TOKEN environment variable is required');
    }
    
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    app.listen(PORT, () => {
      console.log(`🚀 Railway Bot server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start bot server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  client.destroy();
  process.exit(0);
});

startServer();
```

### Step 3: Set Environment Variables
In Railway dashboard:
```
DISCORD_BOT_TOKEN=your_discord_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 4: Deploy
Railway will automatically deploy and your bot will be online!

## 🎯 Quick Test

Once deployed, visit your Railway URL + `/health` to confirm the bot is running.

## 📞 Still Having Issues?

If Railway still isn't working, we can try:
1. **Heroku** (alternative platform)
2. **Render** (alternative platform)  
3. **Local deployment** with ngrok for testing
4. **VPS deployment** (DigitalOcean, etc.)

Let me know which method you'd like to try next!
