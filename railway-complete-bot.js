// Complete Railway bot with join tracking and database updates
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const { ensureStandardizedRoles, assignMemberRole, updateAllMemberRoles } = require('./role-manager');

console.log('🚀 Railway Complete Bot Starting...');
console.log('Environment check:');
console.log('- DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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
    intents: 'Guilds, GuildMembers, GuildPresences, GuildMessages, MessageContent'
  });
});

// Discord bot events
client.once('clientReady', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} servers`);
  
  // Ensure standardized roles exist in all servers and assign roles to existing members
  for (const [guildId, guild] of client.guilds.cache) {
    console.log(`   - ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
    
    try {
      console.log(`🔧 Setting up standardized roles for ${guild.name}...`);
      const roleResult = await ensureStandardizedRoles(guild);
      console.log(`✅ Standardized roles ready for ${guild.name}`);
      
      // Assign roles to all existing members
      console.log(`🎭 Assigning roles to all existing members in ${guild.name}...`);
      const updateResult = await updateAllMemberRoles(guild, guildId);
      console.log(`✅ Updated ${updateResult.updatedCount} member roles (${updateResult.errorCount} errors)`);
      
    } catch (error) {
      console.error(`❌ Failed to setup roles for ${guild.name}:`, error);
    }
  }
});

client.on('guildMemberAdd', async (member) => {
  console.log(`🎉 MEMBER JOIN DETECTED: ${member.user.tag} joined ${member.guild.name}`);
  console.log(`   - User ID: ${member.user.id}`);
  console.log(`   - Guild ID: ${member.guild.id}`);
  console.log(`   - Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Track the join
    await trackMemberJoin(member);
    
    // Assign appropriate role based on subscription status
    console.log(`🎭 Assigning role to new member: ${member.user.tag}`);
    const roleResult = await assignMemberRole(member, member.guild.id);
    if (roleResult.success) {
      console.log(`✅ Assigned ${roleResult.roleName} role to ${member.user.tag}`);
    } else {
      console.error(`❌ Failed to assign role to ${member.user.tag}:`, roleResult.error);
    }
  } catch (error) {
    console.error('Error handling member join:', error);
  }
});

client.on('guildMemberRemove', async (member) => {
  console.log(`👋 MEMBER LEFT: ${member.user.tag} left ${member.guild.name}`);
  console.log(`   - User ID: ${member.user.id}`);
  console.log(`   - Guild ID: ${member.guild.id}`);
  console.log(`   - Timestamp: ${new Date().toISOString()}`);
  
  try {
    await trackMemberLeave(member);
  } catch (error) {
    console.error('Error tracking member leave:', error);
  }
});

// Handle message commands for manual role assignment
client.on('messageCreate', async (message) => {
  // Only respond to bot owner or server administrators
  if (message.author.bot) return;
  
  // Check if user has administrator permissions or is bot owner
  const member = message.member;
  if (!member || !member.permissions.has('Administrator')) return;
  
  if (message.content.toLowerCase() === '!assignroles') {
    try {
      console.log(`🎭 Manual role assignment requested by ${message.author.tag} in ${message.guild.name}`);
      
      await message.reply('🔄 Assigning roles to all members... This may take a moment.');
      
      const updateResult = await updateAllMemberRoles(message.guild, message.guild.id);
      
      await message.reply(`✅ Role assignment complete! Updated ${updateResult.updatedCount} members (${updateResult.errorCount} errors)`);
      
    } catch (error) {
      console.error('Error in manual role assignment:', error);
      await message.reply('❌ Error assigning roles. Check bot logs for details.');
    }
  }
});

// Function to track member leaves for affiliate analytics
async function trackMemberLeave(member) {
  try {
    console.log(`📊 Tracking leave for ${member.user.tag} in ${member.guild.name}`);
    
    // Find tracking records for this user in this server
    const { data: userRecords, error: userError } = await supabase
      .from('affiliate_tracking')
      .select('*')
      .eq('discord_server_id', member.guild.id)
      .eq('user_discord_id', member.user.id)
      .eq('conversion_status', 'joined')
      .is('leave_timestamp', null);
    
    if (userError) {
      console.error('Error fetching user tracking records:', userError);
      return;
    }
    
    if (!userRecords || userRecords.length === 0) {
      console.log('No tracked join records found for this user - may be organic or untracked');
      return;
    }
    
    // Update all tracking records for this user to mark as left
    for (const record of userRecords) {
      const { error: updateError } = await supabase
        .from('affiliate_tracking')
        .update({
          conversion_status: 'left',
          leave_timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);
        
      if (updateError) {
        console.error('Error updating tracking record for leave:', updateError);
      } else {
        console.log(`✅ Updated tracking record ${record.id} to left status`);
      }
    }
    
    // Recalculate server join count (active members only)
    await updateServerJoinCount(member.guild.id);
    
  } catch (error) {
    console.error('Error in trackMemberLeave:', error);
  }
}

// Function to track member joins for affiliate analytics
async function trackMemberJoin(member) {
  try {
    console.log(`📊 Tracking join for ${member.user.tag} in ${member.guild.name}`);
    
    // Check if there are any pending tracking records for this server
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
      
      // Create a new tracking record for organic joins
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
    
    // Associate join with most recent click
    const mostRecentClick = pendingRecords[0];
    
    console.log(`📈 Associating join with tracking record: ${mostRecentClick.id}`);
    console.log(`   Affiliate: ${mostRecentClick.affiliate_id || 'None'}`);
    console.log(`   Click time: ${mostRecentClick.click_timestamp}`);
    
    // Update the tracking record to mark as joined
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

// Function to update server join count (counts only active members)
async function updateServerJoinCount(guildId) {
  try {
    console.log(`📊 Recalculating active join count for server: ${guildId}`);
    
    // Count only members who joined via affiliate links and are still active
    const { data: activeMembers, error: countError } = await supabase
      .from('affiliate_tracking')
      .select('id')
      .eq('discord_server_id', guildId)
      .eq('conversion_status', 'joined')
      .is('leave_timestamp', null);
      
    if (countError) {
      console.error('Error counting active members:', countError);
      return;
    }
    
    const activeJoinCount = activeMembers ? activeMembers.length : 0;
    
    // Also count organic joins that are still active
    const { data: organicMembers, error: organicError } = await supabase
      .from('affiliate_tracking')
      .select('id')
      .eq('discord_server_id', guildId)
      .eq('invite_code', 'ORGANIC')
      .eq('conversion_status', 'joined')
      .is('leave_timestamp', null);
      
    if (organicError) {
      console.error('Error counting organic members:', organicError);
    }
    
    const organicCount = organicMembers ? organicMembers.length : 0;
    const totalActiveJoins = activeJoinCount + organicCount;
    
    const { error: updateError } = await supabase
      .from('discord_servers')
      .update({ 
        total_joins: totalActiveJoins,
        updated_at: new Date().toISOString()
      })
      .eq('discord_server_id', guildId);
      
    if (updateError) {
      console.error('Error updating server join count:', updateError);
      return;
    }
    
    console.log(`✅ Updated server join count to ${totalActiveJoins} (${activeJoinCount} affiliate + ${organicCount} organic)`);
    await updateConversionRate(guildId);
    
  } catch (error) {
    console.error('Error updating server join count:', error);
  }
}

// Function to update conversion rate (based on active members only)
async function updateConversionRate(guildId) {
  try {
    // Get all tracking records for this server
    const { data: trackingStats, error: trackingError } = await supabase
      .from('affiliate_tracking')
      .select('conversion_status, invite_code')
      .eq('discord_server_id', guildId);
      
    if (trackingError) {
      console.error('Error fetching tracking stats:', trackingError);
      return;
    }
    
    // Count only affiliate clicks (exclude organic joins)
    const affiliateClicks = trackingStats.filter(record => record.invite_code !== 'ORGANIC').length;
    
    // Count only active joins (not those who left)
    const activeJoins = trackingStats.filter(record => 
      record.conversion_status === 'joined'
    ).length;
    
    const conversionRate = affiliateClicks > 0 ? ((activeJoins / affiliateClicks) * 100) : 0;
    
    const { error: updateError } = await supabase
      .from('discord_servers')
      .update({ 
        conversion_rate: Math.round(conversionRate * 100) / 100,
        updated_at: new Date().toISOString()
      })
      .eq('discord_server_id', guildId);
      
    if (updateError) {
      console.error('Error updating conversion rate:', updateError);
    } else {
      console.log(`✅ Updated conversion rate to ${conversionRate.toFixed(2)}% (${activeJoins} active joins/${affiliateClicks} clicks)`);
    }
    
  } catch (error) {
    console.error('Error updating conversion rate:', error);
  }
}

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
      console.log(`🚀 Railway Complete Bot running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log('👥 Ready to detect member joins and update database!');
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
