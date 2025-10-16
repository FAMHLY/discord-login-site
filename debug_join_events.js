// Debug script to test join event detection
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function debugJoinEvents() {
    console.log('🔍 Debugging join event detection...');
    
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences
        ]
    });

    // Add comprehensive event logging
    client.once('clientReady', () => {
        console.log(`✅ Bot logged in as ${client.user.tag}`);
        console.log(`📊 Connected to ${client.guilds.cache.size} servers`);
        
        client.guilds.cache.forEach(guild => {
            console.log(`   - ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
        });
    });

    // Log all member-related events
    client.on('guildMemberAdd', (member) => {
        console.log(`🎉 MEMBER JOIN DETECTED: ${member.user.tag} joined ${member.guild.name}`);
        console.log(`   - User ID: ${member.user.id}`);
        console.log(`   - Guild ID: ${member.guild.id}`);
        console.log(`   - Account Created: ${member.user.createdAt}`);
        console.log(`   - Bot can see member: ${member.guild.members.cache.has(member.id)}`);
    });

    client.on('guildMemberRemove', (member) => {
        console.log(`👋 MEMBER LEFT: ${member.user.tag} left ${member.guild.name}`);
    });

    client.on('guildMemberUpdate', (oldMember, newMember) => {
        console.log(`🔄 MEMBER UPDATED: ${newMember.user.tag} in ${newMember.guild.name}`);
    });

    // Log any errors
    client.on('error', (error) => {
        console.error('❌ Bot error:', error);
    });

    client.on('warn', (warning) => {
        console.warn('⚠️ Bot warning:', warning);
    });

    // Log gateway events
    client.on('debug', (info) => {
        if (info.includes('GUILD_MEMBER') || info.includes('MEMBER')) {
            console.log('🔍 Gateway debug:', info);
        }
    });

    try {
        console.log('🔌 Attempting to login...');
        await client.login(process.env.DISCORD_BOT_TOKEN);
        
        // Keep the bot running for 30 seconds to test
        console.log('⏰ Bot will run for 30 seconds to test join detection...');
        console.log('👥 Have someone join your Discord server now!');
        
        setTimeout(() => {
            console.log('⏰ Test period ended. Shutting down...');
            client.destroy();
            process.exit(0);
        }, 30000);
        
    } catch (error) {
        console.error('❌ Failed to login:', error.message);
        process.exit(1);
    }
}

debugJoinEvents().catch(console.error);
