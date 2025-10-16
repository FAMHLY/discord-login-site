// Start the Discord bot
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

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
  
  // Track affiliate join
  try {
    await trackMemberJoin(member);
  } catch (error) {
    console.error('Error tracking member join:', error);
  }
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

// Function to track member joins for affiliate analytics
async function trackMemberJoin(member) {
  try {
    console.log(`📊 Tracking join for ${member.user.tag} in ${member.guild.name}`);
    
    // Check if there are any pending tracking records for this server
    // We'll look for records where someone clicked an invite but hasn't joined yet
    const { data: pendingRecords, error: pendingError } = await supabase
      .from('affiliate_tracking')
      .select('*')
      .eq('discord_server_id', member.guild.id)
      .eq('conversion_status', 'clicked')
      .is('join_timestamp', null)
      .order('click_timestamp', { ascending: false })
      .limit(10); // Get recent clicks
    
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
          invite_code: 'ORGANIC', // Special code for organic joins
          affiliate_id: null, // No affiliate for organic joins
          conversion_status: 'joined',
          user_discord_id: member.user.id,
          join_timestamp: new Date().toISOString(),
          click_timestamp: new Date().toISOString() // Same as join for organic
        });
        
      if (createError) {
        console.error('Error creating organic join record:', createError);
      } else {
        console.log('✅ Created organic join tracking record');
        await updateServerJoinCount(member.guild.id);
      }
      return;
    }
    
    // Find the most recent click that could be associated with this join
    // For now, we'll associate with the most recent click
    // In a more sophisticated system, you might use invite codes or timing
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
    
    // Update server join count
    await updateServerJoinCount(member.guild.id);
    
  } catch (error) {
    console.error('Error in trackMemberJoin:', error);
  }
}

// Function to update server join count
async function updateServerJoinCount(guildId) {
  try {
    console.log(`📊 Updating join count for server: ${guildId}`);
    
    // Get current join count
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
    
    // Update the join count
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
    
    // Update conversion rate
    await updateConversionRate(guildId);
    
  } catch (error) {
    console.error('Error updating server join count:', error);
  }
}

// Function to update conversion rate
async function updateConversionRate(guildId) {
  try {
    // Get total clicks and joins
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
    
    // Update conversion rate
    const { error: updateError } = await supabase
      .from('discord_servers')
      .update({ 
        conversion_rate: Math.round(conversionRate * 100) / 100, // Round to 2 decimal places
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

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);
