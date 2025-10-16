// Simple Railway test bot to verify join detection
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

console.log('🚀 Railway Test Bot Starting...');
console.log('Environment check:');
console.log('- DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

const app = express();
const PORT = process.env.PORT || 3001;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot_online: client.isReady(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    guilds: client.guilds.cache.size,
    intents: 'Guilds, GuildMembers, GuildPresences'
  });
});

// Discord bot events
client.once('clientReady', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} servers`);
  
  client.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
  });
});

client.on('guildMemberAdd', async (member) => {
  console.log(`🎉 MEMBER JOIN DETECTED: ${member.user.tag} joined ${member.guild.name}`);
  console.log(`   - User ID: ${member.user.id}`);
  console.log(`   - Guild ID: ${member.guild.id}`);
  console.log(`   - Timestamp: ${new Date().toISOString()}`);
  
  // This is the key test - if you see this message in Railway logs, join detection works
  console.log('✅ JOIN TRACKING IS WORKING! Railway bot detected the join.');
});

client.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

// Start the server
async function startServer() {
  try {
    if (!process.env.DISCORD_BOT_TOKEN) {
      throw new Error('DISCORD_BOT_TOKEN environment variable is required');
    }
    
    // Login to Discord
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Railway Test Bot running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log('👥 Ready to detect member joins!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start bot server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  client.destroy();
  process.exit(0);
});

startServer();
