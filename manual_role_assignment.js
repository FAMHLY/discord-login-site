// Manual script to trigger role assignment for all members
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { updateAllMemberRoles } = require('./role-manager');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN environment variable is required');
  process.exit(1);
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

async function assignRolesForAllServers() {
  try {
    console.log('🔌 Logging in to Discord...');
    await client.login(BOT_TOKEN);

    // Wait for ready event
    await new Promise((resolve) => {
      client.once('ready', () => {
        console.log(`✅ Bot logged in as ${client.user.tag}`);
        resolve();
      });
    });

    // Wait a bit for guilds to cache
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`📊 Found ${client.guilds.cache.size} server(s)`);

    // Get all servers with active subscriptions
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get all unique server IDs that have active subscriptions
    const { data: activeSubscriptions, error } = await supabase
      .from('subscriptions')
      .select('discord_server_id')
      .eq('status', 'active');

    if (error) {
      console.error('⚠️ Error fetching servers:', error);
    }

    const serverIds = [...new Set((activeSubscriptions || []).map(sub => sub.discord_server_id))];
    console.log(`🔄 Found ${serverIds.length} server(s) with active subscriptions\n`);

    let totalUpdated = 0;
    let totalErrors = 0;

    for (const serverId of serverIds) {
      try {
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
          console.log(`⚠️ Server ${serverId} not found in bot's guilds`);
          continue;
        }

        console.log(`🔄 Updating roles in ${guild.name}...`);
        const result = await updateAllMemberRoles(guild, serverId);
        
        if (result.success) {
          totalUpdated += result.updatedCount || 0;
          totalErrors += result.errorCount || 0;
          console.log(`✅ Updated ${result.updatedCount || 0} roles in ${guild.name} (${result.errorCount || 0} errors)\n`);
        } else {
          console.error(`❌ Failed to update roles in ${guild.name}:`, result.error);
          totalErrors++;
        }

        // Small delay between servers
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error updating roles for server ${serverId}:`, error);
        totalErrors++;
      }
    }

    console.log(`\n✅ Role assignment complete!`);
    console.log(`   Total members updated: ${totalUpdated}`);
    console.log(`   Total errors: ${totalErrors}`);

    // Wait a bit before closing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Script complete');
    process.exit(0);

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

assignRolesForAllServers();


