// Test script to verify Discord credentials are working
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function testDiscordCredentials() {
  console.log('🤖 Testing Discord Credentials...\n');
  
  // Check if all required environment variables are set
  const required = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID', 
    'DISCORD_CLIENT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key] || process.env[key].includes('your_'));
  
  if (missing.length > 0) {
    console.error('❌ Missing or invalid Discord credentials:');
    missing.forEach(key => {
      console.error(`   - ${key}`);
    });
    console.log('\nPlease update your .env file with real Discord credentials from:');
    console.log('https://discord.com/developers/applications');
    return;
  }
  
  console.log('✅ All Discord credentials found');
  console.log(`   - Bot Token: ${process.env.DISCORD_BOT_TOKEN.substring(0, 10)}...`);
  console.log(`   - Client ID: ${process.env.DISCORD_CLIENT_ID}`);
  console.log(`   - Client Secret: ${process.env.DISCORD_CLIENT_SECRET.substring(0, 10)}...`);
  console.log('');
  
  // Test bot connection
  console.log('🔌 Testing bot connection...');
  
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });
  
  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    console.log('✅ Bot connected successfully!');
    console.log(`   - Bot Name: ${client.user.tag}`);
    console.log(`   - Bot ID: ${client.user.id}`);
    console.log(`   - Servers: ${client.guilds.cache.size}`);
    
    if (client.guilds.cache.size > 0) {
      console.log('\n📊 Connected to servers:');
      client.guilds.cache.forEach(guild => {
        console.log(`   - ${guild.name} (${guild.id})`);
      });
    } else {
      console.log('\n⚠️  Bot is not in any servers yet');
      console.log('Add your bot to a server using the OAuth2 URL generator in Discord Developer Portal');
    }
    
    await client.destroy();
    
  } catch (error) {
    console.error('❌ Bot connection failed:', error.message);
    console.log('\nPossible issues:');
    console.log('- Invalid bot token');
    console.log('- Bot token not reset after copying');
    console.log('- Network connectivity issues');
  }
}

testDiscordCredentials().catch(console.error);
