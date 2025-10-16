// Start the Discord bot
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

console.log('🤖 Starting LinkWizard Discord Bot...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot is online! Logged in as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers:`);
  client.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (${guild.id})`);
  });
});

client.on('guildMemberAdd', async (member) => {
  console.log(`👤 New member joined: ${member.user.tag} in ${member.guild.name}`);
  // Here you could add affiliate tracking logic
});

client.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

client.on('disconnect', () => {
  console.log('🔌 Bot disconnected');
});

client.on('reconnecting', () => {
  console.log('🔄 Bot reconnecting...');
});

// Keep the bot running
process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  client.destroy();
  process.exit(0);
});

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);
