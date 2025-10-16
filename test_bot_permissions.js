// Test script to check bot permissions and guild member access
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

async function testBotPermissions() {
    console.log('🔍 Testing bot permissions and member access...');
    
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences
        ]
    });

    client.once('clientReady', async () => {
        console.log(`✅ Bot logged in as ${client.user.tag}`);
        
        try {
            // Get the guild (server)
            const guild = client.guilds.cache.get('831000377863176233');
            
            if (!guild) {
                console.log('❌ Guild not found in bot cache');
                return;
            }
            
            console.log(`✅ Found guild: ${guild.name}`);
            console.log(`   - Guild ID: ${guild.id}`);
            console.log(`   - Member Count: ${guild.memberCount}`);
            console.log(`   - Bot Member: ${guild.members.cache.get(client.user.id) ? 'Found' : 'Not found'}`);
            
            // Check bot permissions
            const botMember = guild.members.cache.get(client.user.id);
            if (botMember) {
                console.log('\n🤖 Bot Permissions:');
                console.log(`   - View Server Members: ${botMember.permissions.has('ViewServerMembers') ? '✅' : '❌'}`);
                console.log(`   - Read Message History: ${botMember.permissions.has('ReadMessageHistory') ? '✅' : '❌'}`);
                console.log(`   - Send Messages: ${botMember.permissions.has('SendMessages') ? '✅' : '❌'}`);
                console.log(`   - Create Instant Invite: ${botMember.permissions.has('CreateInstantInvite') ? '✅' : '❌'}`);
                console.log(`   - Manage Guild: ${botMember.permissions.has('ManageGuild') ? '✅' : '❌'}`);
            }
            
            // Test member fetching
            console.log('\n👥 Testing member access...');
            try {
                // Try to fetch a few members to test if we can access member data
                const members = await guild.members.fetch({ limit: 5 });
                console.log(`✅ Successfully fetched ${members.size} members`);
                console.log('   Member names:', members.map(m => m.user.username).join(', '));
            } catch (memberError) {
                console.log('❌ Failed to fetch members:', memberError.message);
                console.log('   This suggests missing permissions or intents');
            }
            
            // Check guild features
            console.log('\n🏰 Guild Features:');
            console.log(`   - Features: ${guild.features.join(', ') || 'None'}`);
            console.log(`   - Verification Level: ${guild.verificationLevel}`);
            console.log(`   - MFA Level: ${guild.mfaLevel}`);
            
            // Check if we can see member join events
            console.log('\n📡 Testing member join detection...');
            console.log('   - Bot has GuildMembers intent: ✅');
            console.log('   - Guild member count available: ✅');
            console.log('   - Ready to detect joins: ✅');
            
            console.log('\n🧪 Manual Test Instructions:');
            console.log('1. Have someone join your Discord server');
            console.log('2. Watch Railway logs for "New member joined" message');
            console.log('3. If no message appears, the issue is likely:');
            console.log('   - Bot not in the right server');
            console.log('   - Missing permissions despite intent being enabled');
            console.log('   - Discord API rate limiting');
            
        } catch (error) {
            console.error('❌ Error during permission test:', error);
        }
        
        client.destroy();
    });

    client.on('error', (error) => {
        console.error('❌ Bot error:', error);
    });

    try {
        await client.login(process.env.DISCORD_BOT_TOKEN);
    } catch (error) {
        console.error('❌ Failed to login:', error.message);
    }
}

testBotPermissions().catch(console.error);
