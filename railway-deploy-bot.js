// Railway deployment script for Discord bot with join tracking
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

console.log('🚀 Starting Railway Discord Bot with Join Tracking...');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3001;

// Discord bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// Express server for health checks
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot_online: client.isReady(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Discord bot events
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

// Function to update server join count
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
    await updateConversionRate(guildId);
    
  } catch (error) {
    console.error('Error updating server join count:', error);
  }
}

// Function to update conversion rate
async function updateConversionRate(guildId) {
  try {
    const { data: trackingStats, error: trackingError } = await supabase
      .from('affiliate_tracking')
      .select('conversion_status')
      .eq('discord_server_id', guildId);
      
    if (trackingError) {
      console.error('Error fetching tracking stats:', trackingError);
      return;
    }
    
    const totalClicks = trackingStats.length;
    const totalJoins = trackingStats.filter(record => record.conversion_status === 'joined').length;
    
    const conversionRate = totalClicks > 0 ? ((totalJoins / totalClicks) * 100) : 0;
    
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
      console.log(`✅ Updated conversion rate to ${conversionRate.toFixed(2)}% (${totalJoins}/${totalClicks})`);
    }
    
  } catch (error) {
    console.error('Error updating conversion rate:', error);
  }
}

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
      console.log(`🚀 Railway Bot server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
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
