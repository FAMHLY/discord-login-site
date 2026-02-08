// Role management for Discord servers
// Universal "visitor" role for free tier, server-specific roles from server_roles table for paid tiers
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Universal free tier role (no color)
const FREE_ROLE_NAME = 'member';

/**
 * Ensure the universal "visitor" role exists in a Discord server
 */
async function ensureVisitorRole(guild) {
  try {
    console.log(`🔧 Ensuring visitor role exists in ${guild.name}`);
    
    // Check if bot has permission to manage roles
    const botMember = guild.members.cache.get(guild.client.user.id);
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      console.error(`❌ Bot lacks permission to manage roles in ${guild.name}`);
      return { success: false, error: 'Missing ManageRoles permission' };
    }
    
    let visitorRole = guild.roles.cache.find(role => role.name === FREE_ROLE_NAME);
    
    // Create visitor role if it doesn't exist (no color)
    if (!visitorRole) {
      console.log(`Creating ${FREE_ROLE_NAME} role...`);
      visitorRole = await guild.roles.create({
        name: FREE_ROLE_NAME,
        // No color specified - Discord will use default
        mentionable: false,
        reason: 'Created universal visitor role for free tier'
      });
      console.log(`✅ Created ${FREE_ROLE_NAME} role`);
    } else {
      console.log(`✅ ${FREE_ROLE_NAME} role already exists`);
    }
    
    return {
      success: true,
      visitorRole
    };
    
  } catch (error) {
    console.error(`Error ensuring visitor role in ${guild.name}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Assign the appropriate role(s) to a member based on their subscription status
 */
async function assignMemberRole(member, serverId) {
  try {
    console.log(`🎭 Assigning role to ${member.user.tag} in ${member.guild.name}`);
    
    // Ensure visitor role exists first
    const visitorResult = await ensureVisitorRole(member.guild);
    if (!visitorResult.success) {
      return visitorResult;
    }
    
    const { visitorRole } = visitorResult;
    
    // Get all active subscriptions for this user in this server
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('role_name, price_id')
      .eq('discord_server_id', serverId)
      .eq('discord_user_id', member.user.id)
      .eq('status', 'active');
    
    if (error) {
      console.error('Error checking subscriptions:', error);
      return { success: false, error: error.message };
    }
    
    const hasActiveSubscriptions = subscriptions && subscriptions.length > 0;
    
    // Remove visitor role if they have any paid subscription
    if (hasActiveSubscriptions && member.roles.cache.has(visitorRole.id)) {
      await member.roles.remove(visitorRole, 'User has active paid subscription');
      console.log(`Removed ${FREE_ROLE_NAME} role from ${member.user.tag}`);
    }
    
    // Get all roles from server_roles table for this server (including discord_role_name mapping)
    const { data: serverRoles, error: rolesError } = await supabase
      .from('server_roles')
      .select('role_name, discord_role_name')
      .eq('discord_server_id', serverId);

    if (rolesError) {
      console.error('Error fetching server roles:', rolesError);
    }

    const validRoleNames = new Set((serverRoles || []).map(r => r.role_name));
    // Build a map from role_name to the actual Discord role name to use
    const discordRoleNameMap = {};
    for (const sr of (serverRoles || [])) {
      discordRoleNameMap[sr.role_name] = sr.discord_role_name || sr.role_name;
    }

    // Remove any old subscription roles that are no longer active
    if (serverRoles && serverRoles.length > 0) {
      // Get unique Discord role names that should still be active
      const activeDiscordRoles = new Set(
        (subscriptions || []).map(sub => discordRoleNameMap[sub.role_name] || sub.role_name)
      );

      // Get unique Discord role names from all server roles
      const allDiscordRoleNames = new Set(Object.values(discordRoleNameMap));

      for (const discordRoleName of allDiscordRoleNames) {
        const discordRole = member.guild.roles.cache.find(r => r.name === discordRoleName);

        if (discordRole && member.roles.cache.has(discordRole.id)) {
          if (!activeDiscordRoles.has(discordRoleName)) {
            await member.roles.remove(discordRole, 'Subscription expired or cancelled');
            console.log(`Removed ${discordRoleName} role from ${member.user.tag}`);
          }
        }
      }
    }

    // Assign roles based on active subscriptions
    const assignedRoles = [];
    if (hasActiveSubscriptions) {
      for (const subscription of subscriptions) {
        const roleName = subscription.role_name;

        if (!roleName) {
          console.warn(`Subscription ${subscription.price_id} has no role_name, skipping`);
          continue;
        }

        if (!validRoleNames.has(roleName)) {
          console.warn(`Role ${roleName} not found in server_roles table, skipping`);
          continue;
        }

        // Use discord_role_name if configured, otherwise fall back to role_name
        const actualRoleName = discordRoleNameMap[roleName] || roleName;

        // Find or create the role in Discord
        let discordRole = member.guild.roles.cache.find(r => r.name === actualRoleName);

        if (!discordRole) {
          // Role doesn't exist in Discord, try to create it (without color)
          try {
            discordRole = await member.guild.roles.create({
              name: actualRoleName,
              mentionable: false,
              reason: 'Created subscription role from server_roles table'
            });
            console.log(`✅ Created Discord role: ${actualRoleName}`);
          } catch (createError) {
            console.error(`Failed to create role ${actualRoleName}:`, createError);
            continue;
          }
        }

        // Assign the role if not already assigned
        if (!member.roles.cache.has(discordRole.id)) {
          await member.roles.add(discordRole, 'Active subscription - assigned role');
          console.log(`✅ Assigned ${actualRoleName} role to ${member.user.tag}`);
          assignedRoles.push(actualRoleName);
        }
      }
    } else {
      // No active subscriptions, assign visitor role
      if (!member.roles.cache.has(visitorRole.id)) {
        await member.roles.add(visitorRole, 'No active subscription - assigned visitor role');
        console.log(`✅ Assigned ${FREE_ROLE_NAME} role to ${member.user.tag}`);
        assignedRoles.push(FREE_ROLE_NAME);
      }
    }
    
    return { 
      success: true, 
      roles: assignedRoles,
      roleNames: assignedRoles
    };
    
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
    
    // Ensure visitor role exists first
    const visitorResult = await ensureVisitorRole(guild);
    if (!visitorResult.success) {
      return visitorResult;
    }
    
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
    
    if (!client || !client.isReady()) {
      console.error('Discord client not available for role assignment. Ensure the bot server calls this with its client.');
      return { success: false, error: 'Discord client not available' };
    }

    const discordClient = client;
    
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
  ensureVisitorRole,
  assignMemberRole,
  updateAllMemberRoles,
  handleSubscriptionChange,
  FREE_ROLE_NAME
};
