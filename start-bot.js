#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Discord Monetization Platform...\n');

// Check if .env file exists for bot
const fs = require('fs');
const botEnvPath = path.join(__dirname, '.env');

if (!fs.existsSync(botEnvPath)) {
  console.log('❌ Bot .env file not found!');
  console.log('📝 Please create a .env file with your Discord bot token:');
  console.log('   DISCORD_BOT_TOKEN=your_bot_token_here');
  console.log('   PORT=3001');
  console.log('\n💡 You can copy bot.env.example to .env and fill in your token.\n');
  process.exit(1);
}

// Start the Discord bot
console.log('🤖 Starting Discord Bot...');
const bot = spawn('node', ['discord-bot.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

bot.on('error', (error) => {
  console.error('❌ Failed to start Discord bot:', error.message);
  console.log('\n💡 Make sure you have installed the bot dependencies:');
  console.log('   npm install discord.js express cors dotenv');
  process.exit(1);
});

bot.on('exit', (code) => {
  console.log(`🤖 Discord bot exited with code ${code}`);
  if (code !== 0) {
    console.log('❌ Bot crashed. Check the logs above for errors.');
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  bot.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  bot.kill('SIGTERM');
  process.exit(0);
});

console.log('✅ Discord bot started successfully!');
console.log('📡 Bot API will be available at: http://localhost:3001');
console.log('🔗 Health check: http://localhost:3001/health');
console.log('\n💡 To stop the bot, press Ctrl+C');
console.log('📖 Check DISCORD_BOT_SETUP.md for complete setup instructions\n');
