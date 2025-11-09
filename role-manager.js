// Role management for Discord servers with standardized 🟢 (paid) and 🔴 (free) roles
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Standardized role names and colors
const PAID_ROLE_NAME = '🟢';
const FREE_ROLE_NAME = '🔴';
const PAID_ROLE_COLOR = '#00FF00'; // Green
const FREE_ROLE_COLOR = '#FF0000'; // Red

/**
 * Ensure standardized roles exist in a Discord server
 */
async function ensureStandardizedRoles(guild) {
  try {
    console.log(`🔧 Ensuring standardized roles exist in ${guild.name}`);
    
    // Check if bot has permission to manage roles
    const botMember = guild.members.cache.get(guild.client.user.id);
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.error(`❌ Bot lacks permission to manage roles in ${guild.name}`);
      return { success: false, error: 'Missing ManageRoles permission' };
    }
    
    let paidRole = guild.roles.cache.find(role => role.name === PAID_ROLE_NAME);
    let freeRole = guild.roles.cache.find(role => role.name === FREE_ROLE_NAME);
    
    // Create paid role if it doesn't exist
    if (!paidRole) {
      console.log(`Creating ${PAID_ROLE_NAME} role...`);
      paidRole = await guild.roles.create({
        name: PAID_ROLE_NAME,
        color: PAID_ROLE_COLOR,
        hoist: true, // Show members with this role separately
        mentionable: false,
        reason: 'Created standardized paid member role'
      });
      console.log(`✅ Created ${PAID_ROLE_NAME} role`);
    } else {
      console.log(`✅ ${PAID_ROLE_NAME} role already exists`);
    }
    
    // Create free role if it doesn't exist
    if (!freeRole) {
      console.log(`Creating ${FREE_ROLE_NAME} role...`);
      freeRole = await guild.roles.create({
        name: FREE_ROLE_NAME,
        color: FREE_ROLE_COLOR,
        hoist: true, // Show members with this role separately
        mentionable: false,
        reason: 'Created standardized free member role'
      });
      console.log(`✅ Created ${FREE_ROLE_NAME} role`);
    } else {
      console.log(`✅ ${FREE_ROLE_NAME} role already exists`);
    }
    
    // Set role hierarchy (paid role above free role)
    if (paidRole.position <= freeRole.position) {
      console.log(`Setting role hierarchy: ${PAID_ROLE_NAME} above ${FREE_ROLE_NAME}`);
      await paidRole.setPosition(freeRole.position + 1, 'Set standardized role hierarchy');
    }
    
    return {
      success: true,
      paidRole,
      freeRole
    };
    
  } catch (error) {
    console.error(`Error ensuring standardized roles in ${guild.name}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Assign the appropriate role to a member based on their subscription status
 */
async function assignMemberRole(member, serverId) {
  try {
    console.log(`🎭 Assigning role to ${member.user.tag} in ${member.guild.name}`);
    
    // Ensure roles exist first
    const roleResult = await ensureStandardizedRoles(member.guild);
    if (!roleResult.success) {
      return roleResult;
    }
    
    const { paidRole, freeRole } = roleResult;
    
    // Check if user has active subscription for this server
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('discord_server_id', serverId)
      .eq('discord_user_id', member.user.id) // Use Discord user ID for role assignment
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking subscription:', error);
      return { success: false, error: error.message };
    }
    
    const hasActiveSubscription = !!subscription;
    
    // Remove both roles first to avoid conflicts
    if (member.roles.cache.has(paidRole.id)) {
      await member.roles.remove(paidRole, 'Updating standardized role assignment');
      console.log(`Removed ${PAID_ROLE_NAME} role from ${member.user.tag}`);
    }
    
    if (member.roles.cache.has(freeRole.id)) {
      await member.roles.remove(freeRole, 'Updating standardized role assignment');
      console.log(`Removed ${FREE_ROLE_NAME} role from ${member.user.tag}`);
    }
    
    // Assign appropriate role
    if (hasActiveSubscription) {
      await member.roles.add(paidRole, 'Active subscription - assigned paid role');
      console.log(`✅ Assigned ${PAID_ROLE_NAME} role to ${member.user.tag}`);
      return { success: true, role: 'paid', roleName: PAID_ROLE_NAME };
    } else {
      await member.roles.add(freeRole, 'No active subscription - assigned free role');
      console.log(`✅ Assigned ${FREE_ROLE_NAME} role to ${member.user.tag}`);
      return { success: true, role: 'free', roleName: FREE_ROLE_NAME };
    }
    
  } catch (error) {
    console.error(`Error assigning role to ${member.user.tag}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Update all member roles in a server based on subscription status
 */
async function updateAllMemberRoles(guild, serverId) {
  try {
    console.log(`🔄 Updating all member roles in ${guild.name}`);
    
    // Ensure roles exist first
    const roleResult = await ensureStandardizedRoles(guild);
    if (!roleResult.success) {
      return roleResult;
    }
    
    const { paidRole, freeRole } = roleResult;
    
    // Get all members (this might be slow for large servers)
    await guild.members.fetch();
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const [memberId, member] of guild.members.cache) {
      try {
        // Skip bots
        if (member.user.bot) continue;
        
        const result = await assignMemberRole(member, serverId);
        if (result.success) {
          updatedCount++;
        } else {
          errorCount++;
          console.error(`Failed to update role for ${member.user.tag}:`, result.error);
        }
        
        // Add small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        console.error(`Error updating role for member ${memberId}:`, error);
      }
    }
    
    console.log(`✅ Updated ${updatedCount} member roles (${errorCount} errors)`);
    return {
      success: true,
      updatedCount,
      errorCount
    };
    
  } catch (error) {
    console.error(`Error updating all member roles in ${guild.name}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle subscription status changes and update roles accordingly
 * @param {string} discordUserId - Discord user ID (not Stripe customer ID)
 * @param {string} serverId - Discord server ID
 * @param {string} status - Subscription status
 * @param {Client} client - Optional Discord client (if not provided, will try to create one)
 */
async function handleSubscriptionChange(discordUserId, serverId, status, client = null) {
  try {
    console.log(`📊 Handling subscription change: ${discordUserId} in ${serverId} -> ${status}`);
    
    // Get or create Discord client
    let discordClient = client;
    if (!discordClient) {
      // Try to use the client from bot-server.js if available
      try {
        // Check if we can access the client from bot-server
        // Note: This will only work if bot-server.js has already been loaded/started
        const path = require('path');
        const botServerPath = path.join(__dirname, 'bot-server.js');
        delete require.cache[require.resolve(botServerPath)];
        const botServer = require('../bot-server');
        discordClient = botServer?.client;
      } catch (e) {
        // If bot-server isn't loaded, create a temporary client
        console.log('Creating temporary Discord client for role assignment...');
        const { Client, GatewayIntentBits } = require('discord.js');
        discordClient = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers
          ]
        });
        await discordClient.login(process.env.DISCORD_BOT_TOKEN);
        // Wait for ready
        await new Promise((resolve) => {
          discordClient.once('clientReady', resolve);
        });
      }
    }
    
    if (!discordClient || !discordClient.isReady()) {
      console.error('Discord client not available for role assignment');
      return { success: false, error: 'Discord client not available' };
    }
    
    // Find the guild
    const guild = discordClient.guilds.cache.get(serverId);
    if (!guild) {
      console.error(`Guild ${serverId} not found`);
      return { success: false, error: 'Guild not found' };
    }
    
    // Fetch the member (might not be in cache)
    let member;
    try {
      member = guild.members.cache.get(discordUserId);
      if (!member) {
        console.log(`Member not in cache, fetching ${discordUserId}...`);
        member = await guild.members.fetch(discordUserId);
      }
    } catch (fetchError) {
      console.error(`Member ${discordUserId} not found in guild ${serverId}:`, fetchError.message);
      return { success: false, error: 'Member not found in guild' };
    }
    
    // Assign appropriate role based on subscription status
    const result = await assignMemberRole(member, serverId);
    
    if (result.success) {
      console.log(`✅ Updated role for ${member.user.tag} based on subscription status: ${status}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Error handling subscription change:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  ensureStandardizedRoles,
  assignMemberRole,
  updateAllMemberRoles,
  handleSubscriptionChange,
  PAID_ROLE_NAME,
  FREE_ROLE_NAME,
  PAID_ROLE_COLOR,
  FREE_ROLE_COLOR
};
