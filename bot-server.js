// Persistent Discord Bot Server
// This runs as a standalone server for better performance
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { updateAllMemberRoles } = require('./role-manager');

const app = express();
app.use(express.json());
app.use(cors());

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = process.env.PORT || 3001;
const LINKWIZARD_CHANNEL_NAME = 'linkwizard'; // Channel name to post reports to
const MEMBERSHIP_CHANNEL_NAME = 'membership'; // Channel name for subscribe/unsubscribe commands
const MEMBER_API_BASE_URL =
  process.env.MEMBER_API_BASE_URL ||
  process.env.API_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
const STRIPE_DEFAULT_PRICE_ID = process.env.STRIPE_DEFAULT_PRICE_ID; // fallback for slash commands

// Initialize Supabase client
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized');
  } else {
    console.warn('⚠️ Supabase credentials not found - subscription tracking will not work');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
}

// Create persistent Discord client with message intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // REQUIRED to read message content
    ]
});

// Verify messageCreate event is registered
console.log('📋 Registered event listeners:', client.eventNames());

// Bot ready event - use 'ready' for Discord.js v14
client.once('ready', async () => {
    console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    
    const commands = [
        new SlashCommandBuilder()
            .setName('subscribe')
            .setDescription('Get the latest membership subscription link'),
        new SlashCommandBuilder()
            .setName('unsubscribe')
            .setDescription('Get the link to manage or cancel your membership subscription')
    ];

    // Log all servers and register commands
    for (const guild of client.guilds.cache.values()) {
        console.log(`   - ${guild.name} (${guild.id})`);
        try {
            await guild.commands.set(commands.map(cmd => cmd.setDMPermission(false).toJSON()));
            console.log(`✅ Slash commands registered in ${guild.name}`);
        } catch (error) {
            console.error(`❌ Failed to register commands in ${guild.name}:`, error);
        }
    }

    // Set up subscription checks every 30 minutes
    setupRecurringSubscriptionCheck();
    
    // Kick off an initial check shortly after startup
    setTimeout(() => {
        checkSubscriptions();
    }, 5000);
});

// Bot error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', info => {
    console.warn('⚠️ Discord client warning:', info);
});

client.on('guildCreate', async guild => {
    console.log(`➕ Joined new guild: ${guild.name} (${guild.id}) - registering slash commands`);
    try {
        const commands = [
            new SlashCommandBuilder()
                .setName('subscribe')
                .setDescription('Get the latest membership subscription link')
                .setDMPermission(false)
                .toJSON(),
            new SlashCommandBuilder()
                .setName('unsubscribe')
                .setDescription('Get the link to manage or cancel your membership subscription')
                .setDMPermission(false)
                .toJSON()
        ];
        await guild.commands.set(commands);
        console.log(`✅ Slash commands registered in ${guild.name}`);
    } catch (error) {
        console.error(`❌ Failed to register commands for ${guild.name}:`, error);
    }
});

// Store active role selection conversations
const activeRoleSelections = new Map();

client.on('interactionCreate', async interaction => {
    try {
        // Handle SelectMenu interactions (role selection)
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;
            
            // Check if this is a role selection menu
            if (customId.startsWith('role_selection_')) {
                const parts = customId.split('_');
                if (parts.length >= 5) {
                    const action = parts[2]; // 'subscribe' or 'unsubscribe'
                    const userId = parts[3];
                    const serverId = parts[4];
                    
                    // Verify this interaction belongs to the user
                    if (interaction.user.id !== userId) {
                        await interaction.reply({
                            content: '❌ This menu is not for you.',
                            ephemeral: true
                        });
                        return;
                    }
                    
                    const selectedValue = interaction.values[0]; // Get the selected role
                    const [stripePriceId, roleName] = selectedValue.split(':');
                    
                    console.log(`✅ Role selected: ${roleName} (${action}) by ${interaction.user.tag}`);
                    console.log(`   Price ID: ${stripePriceId}`);
                    
                    // Acknowledge the selection
                    await interaction.deferUpdate();
                    
                    // Get the subscription link
                    const linkResult = await requestMembershipLink(
                        action,
                        {
                            user: interaction.user,
                            guild: interaction.guild
                        },
                        stripePriceId,
                        roleName
                    );

                    if (!linkResult.success) {
                        await interaction.followUp({
                            content: linkResult.content,
                            ephemeral: true
                        });
                        return;
                    }

                    // Try to DM the user
                    let dmSent = false;
                    try {
                        await interaction.user.send(linkResult.content);
                        dmSent = true;
                        await interaction.followUp({
                            content: '📬 Check your DMs for the subscription link!',
                            ephemeral: true
                        });
                    } catch (dmError) {
                        console.warn('⚠️ Unable to DM user:', dmError.message);
                        await interaction.followUp({
                            content: `❕ I couldn't DM you, so here's the link instead:\n${linkResult.content}`,
                            ephemeral: true
                        });
                    }
                }
            }
            return;
        }
        
        // Handle slash command interactions
        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (!interaction.channel || interaction.channel.name !== MEMBERSHIP_CHANNEL_NAME) {
            await interaction.reply({
                content: `⚠️ Please use the #${MEMBERSHIP_CHANNEL_NAME} channel for this command.`,
                ephemeral: true
            });
            return;
        }

        if (interaction.commandName === 'subscribe' || interaction.commandName === 'unsubscribe') {
            const action = interaction.commandName;
            const serverId = interaction.guild.id;
            const userId = interaction.user.id;

            // Get available roles for this server
            if (!supabase) {
                await interaction.reply({
                    content: '❌ Subscription service is not available. Please contact an administrator.',
                    ephemeral: true
                });
                return;
            }

            const { data: serverRoles, error: rolesError } = await supabase
                .from('server_roles')
                .select('role_name, stripe_price_id')
                .eq('discord_server_id', serverId);

            if (rolesError) {
                console.error('Error fetching server roles:', rolesError);
                await interaction.reply({
                    content: '❌ Failed to fetch available roles. Please try again later.',
                    ephemeral: true
                });
                return;
            }

            if (!serverRoles || serverRoles.length === 0) {
                await interaction.reply({
                    content: `❌ No subscription roles are configured for this server. ${action === 'subscribe' ? 'Contact a server administrator to set up roles.' : 'You have no active subscriptions to manage.'}`,
                    ephemeral: true
                });
                return;
            }

            // If unsubscribe, filter to only roles they're subscribed to
            let availableRoles = serverRoles;
            if (action === 'unsubscribe') {
                const { data: userSubscriptions, error: subError } = await supabase
                    .from('subscriptions')
                    .select('role_name')
                    .eq('discord_server_id', serverId)
                    .eq('discord_user_id', userId)
                    .eq('status', 'active');

                if (subError) {
                    console.error('Error fetching user subscriptions:', subError);
                    await interaction.reply({
                        content: '❌ Failed to fetch your subscriptions. Please try again later.',
                        ephemeral: true
                    });
                    return;
                }

                const subscribedRoleNames = new Set((userSubscriptions || [])
                    .map(sub => sub.role_name)
                    .filter(Boolean));

                availableRoles = serverRoles.filter(role => subscribedRoleNames.has(role.role_name));

                if (availableRoles.length === 0) {
                    await interaction.reply({
                        content: '❌ You have no active subscriptions to manage.',
                        ephemeral: true
                    });
                    return;
                }
            }

            // Create a SelectMenu (dropdown) with available roles
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`role_selection_${action}_${userId}_${serverId}`)
                .setPlaceholder(`Select a role to ${action}...`)
                .addOptions(
                    availableRoles.map(role => ({
                        label: role.role_name,
                        description: `${action === 'subscribe' ? 'Subscribe to' : 'Unsubscribe from'} ${role.role_name}`,
                        value: `${role.stripe_price_id}:${role.role_name}`
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const promptMessage = action === 'subscribe'
                ? `📋 **Select which role you'd like to subscribe to:**`
                : `📋 **Select which role you'd like to unsubscribe from:**`;

            await interaction.reply({
                content: promptMessage,
                components: [row],
                ephemeral: true
            });

            console.log(`✅ Sent role selection menu to ${userId} in server ${serverId}`);
            console.log(`📋 Available roles:`, availableRoles.map(r => r.role_name));
        }
    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: '❌ Something went wrong while processing that command. Please try again later.'
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: '❌ Something went wrong while processing that command. Please try again later.',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// Handle message replies for role selection
console.log('🎯 Registering messageCreate event handler...');
client.on('messageCreate', async message => {
    // Log ALL messages for debugging - this should fire for EVERY message
    console.log(`📬 [MESSAGE EVENT] Raw message event received!`);
    console.log(`   Author: ${message.author?.tag || 'unknown'} (${message.author?.id || 'unknown'})`);
    console.log(`   Bot: ${message.author?.bot || 'unknown'}`);
    console.log(`   Guild: ${message.guild?.name || 'none'} (${message.guild?.id || 'none'})`);
    console.log(`   Channel: ${message.channel?.name || 'unknown'} (${message.channel?.id || 'unknown'})`);
    console.log(`   Content: "${message.content || '(no content)'}"`);
    
    try {
        // Ignore bot messages
        if (message.author.bot) {
            console.log(`🤖 Ignoring bot message`);
            return;
        }

        // Must have a guild
        if (!message.guild) {
            console.log(`❌ Message has no guild, skipping`);
            return;
        }

        // Only handle messages in membership channel
        if (!message.channel) {
            console.log(`❌ Message has no channel, skipping`);
            return;
        }
        
        // Handle both regular channels and threads - check channel name (case-insensitive)
        let channelName = null;
        if (message.channel.name) {
            channelName = message.channel.name.toLowerCase();
        } else if (message.channel.parent && message.channel.parent.name) {
            channelName = message.channel.parent.name.toLowerCase();
        }
        
        console.log(`📝 Message in channel: "${channelName}" (looking for: "${MEMBERSHIP_CHANNEL_NAME.toLowerCase()}")`);
        
        if (channelName !== MEMBERSHIP_CHANNEL_NAME.toLowerCase()) {
            // Not in membership channel, skip
            console.log(`⏭️ Skipping - not in membership channel`);
            return;
        }
        
        console.log(`✅ Message is in membership channel!`);

        const userId = message.author.id;
        const serverId = message.guild.id;
        const selectionKey = `${userId}-${serverId}`;
        
        console.log(`📨 Message received from ${message.author.tag} (${userId}) in channel "${message.channel.name}" of server ${message.guild.name} (${serverId}): "${message.content}"`);
        console.log(`🔑 Looking for selection with key: ${selectionKey}`);
        console.log(`📋 Total active selections: ${activeRoleSelections.size}`);
        if (activeRoleSelections.size > 0) {
            console.log(`📋 Active selection keys:`, Array.from(activeRoleSelections.keys()));
        }

        const selection = activeRoleSelections.get(selectionKey);

        if (!selection) {
            console.log(`❌ No active selection found for key: ${selectionKey}`);
            // Don't respond if there's no active selection - user might just be chatting
            return;
        }

        console.log(`✅ Found active selection: action=${selection.action}, roles=${selection.availableRoles.length}`);

        // Check if message is too old (more than 60 seconds)
        if (Date.now() - selection.timestamp > 60000) {
            activeRoleSelections.delete(selectionKey);
            return;
        }

        const userResponse = message.content.trim();
        console.log(`🔍 Processing user response: "${userResponse}"`);
        console.log(`📝 Available roles:`, selection.availableRoles.map(r => r.role_name));
        
        let selectedRole = null;

        // Try to match by number
        const numberMatch = parseInt(userResponse);
        if (!isNaN(numberMatch) && numberMatch >= 1 && numberMatch <= selection.availableRoles.length) {
            selectedRole = selection.availableRoles[numberMatch - 1];
            console.log(`✅ Matched role by number ${numberMatch}: ${selectedRole.role_name}`);
        } else {
            // Try to match by role name (case insensitive, partial match)
            selectedRole = selection.availableRoles.find(role =>
                role.role_name.toLowerCase() === userResponse.toLowerCase() ||
                role.role_name.toLowerCase().includes(userResponse.toLowerCase()) ||
                userResponse.toLowerCase().includes(role.role_name.toLowerCase())
            );
            
            if (selectedRole) {
                console.log(`✅ Matched role by name: ${selectedRole.role_name}`);
            }
        }

        if (!selectedRole) {
            console.log(`❌ Could not match role from response: "${userResponse}"`);
            await message.reply({
                content: `❌ I couldn't find that role. Please reply with the **number** (1, 2, etc.) or **exact name** from the list above.`
            });
            return;
        }

        // Remove from active selections
        activeRoleSelections.delete(selectionKey);

        // Delete the user's selection message
        try {
            await message.delete();
        } catch (deleteError) {
            console.warn('Could not delete user message:', deleteError);
        }

        // Get the subscription link
        console.log(`🔗 Requesting ${selection.action} link for role: ${selectedRole.role_name} (price: ${selectedRole.stripe_price_id})`);
        const linkResult = await requestMembershipLink(
            selection.action,
            {
                user: message.author,
                guild: message.guild
            },
            selectedRole.stripe_price_id,
            selectedRole.role_name
        );

        console.log(`📊 Link result:`, linkResult.success ? 'Success' : `Failed: ${linkResult.content}`);

        if (!linkResult.success) {
            await message.channel.send({
                content: `${message.author} ${linkResult.content}`,
                allowedMentions: { users: [userId] }
            });
            return;
        }

        // Try to DM the user
        let dmSent = false;
        try {
            await message.author.send(linkResult.content);
            dmSent = true;
            await message.channel.send({
                content: `${message.author} 📬 Check your DMs for the subscription link!`,
                allowedMentions: { users: [userId] }
            });
        } catch (dmError) {
            console.warn('⚠️ Unable to DM user:', dmError.message);
            await message.channel.send({
                content: `${message.author} ❕ I couldn't DM you, so here's the link instead:\n${linkResult.content}`,
                allowedMentions: { users: [userId] }
            });
        }

    } catch (error) {
        console.error('❌ Error handling role selection message:', error);
    }
});

/**
 * Check current subscriptions and compare with previous day
 */
async function checkSubscriptions() {
    try {
        if (!supabase) {
            console.error('❌ Cannot check subscriptions: Supabase client not initialized');
            return;
        }

        if (!client.isReady()) {
            console.error('❌ Cannot check subscriptions: Discord client not ready');
            return;
        }

        console.log('📊 Starting daily subscription check...');
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Get all active subscriptions
        const { data: activeSubscriptions, error: subscriptionsError } = await supabase
            .from('subscriptions')
            .select('id, discord_user_id, discord_server_id, status, created_at, cancelled_at')
            .eq('status', 'active');

        if (subscriptionsError) {
            console.error('❌ Error fetching subscriptions:', subscriptionsError);
            return;
        }

        const currentCount = activeSubscriptions.length;
        console.log(`✅ Found ${currentCount} active subscriptions`);

        // Get previous day's snapshot for comparison
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: previousSnapshot } = await supabase
            .from('daily_subscription_snapshots')
            .select('total_active_subscriptions')
            .eq('snapshot_date', yesterdayStr)
            .single();

        const previousCount = previousSnapshot?.total_active_subscriptions || 0;

        // Calculate new subscriptions (created today and currently active)
        const todayStart = new Date(todayStr + 'T00:00:00.000Z');
        const todayEnd = new Date(todayStr + 'T23:59:59.999Z');
        
        const { data: newSubscriptions, error: newSubError } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('status', 'active')
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString());

        // Calculate cancelled subscriptions (cancelled today)
        const { data: cancelledToday, error: cancelledError } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('status', 'cancelled')
            .gte('cancelled_at', todayStart.toISOString())
            .lte('cancelled_at', todayEnd.toISOString());

        if (newSubError) {
            console.error('⚠️ Error fetching new subscriptions:', newSubError);
        }
        if (cancelledError) {
            console.error('⚠️ Error fetching cancelled subscriptions:', cancelledError);
        }

        const actualNew = newSubscriptions?.length || 0;
        const actualCancelled = cancelledToday?.length || 0;

        // Save today's snapshot
        const { error: snapshotError } = await supabase
            .from('daily_subscription_snapshots')
            .upsert({
                snapshot_date: todayStr,
                total_active_subscriptions: currentCount,
                subscriptions_created: actualNew,
                subscriptions_cancelled: actualCancelled,
                created_at: now.toISOString()
            }, {
                onConflict: 'snapshot_date'
            });

        if (snapshotError) {
            console.error('⚠️ Error saving snapshot:', snapshotError);
        } else {
            console.log('✅ Saved daily snapshot');
        }

        // Update all member roles in all servers to match subscription status
        console.log('🎭 Updating member roles based on subscription status...');
        await updateAllMemberRolesForActiveServers();

        // Send report to Discord channel
        await sendSubscriptionReport(currentCount, actualNew, actualCancelled);

    } catch (error) {
        console.error('❌ Error in subscription check:', error);
    }
}

/**
 * Update all member roles for servers that have active subscriptions
 */
async function updateAllMemberRolesForActiveServers() {
    try {
        if (!supabase || !client.isReady()) {
            console.warn('⚠️ Skipping role updates: bot or database not ready');
            return;
        }

        // Get all unique server IDs that have active subscriptions
        const { data: activeSubscriptions, error } = await supabase
            .from('subscriptions')
            .select('discord_server_id')
            .eq('status', 'active');

        if (error) {
            console.error('⚠️ Error fetching servers for role updates:', error);
            return;
        }

        // Collect target servers from active subscriptions and configured server settings
        const serverIdSet = new Set(
            (activeSubscriptions || [])
                .map(sub => sub.discord_server_id)
                .filter(Boolean)
        );

        try {
            const { data: configuredServers, error: settingsError } = await supabase
                .from('server_settings')
                .select('discord_server_id');

            if (settingsError) {
                console.warn('⚠️ Error fetching configured servers for role updates:', settingsError);
            } else {
                for (const entry of configuredServers || []) {
                    if (entry?.discord_server_id) {
                        serverIdSet.add(entry.discord_server_id);
                    }
                }
            }
        } catch (settingsException) {
            console.warn('⚠️ Failed to merge configured servers for role updates:', settingsException);
        }

        const serverIds = [...serverIdSet];
        if (serverIds.length === 0) {
            console.log('ℹ️ No servers found for role synchronization.');
            return;
        }

        console.log(`🔄 Updating roles for ${serverIds.length} configured server(s)`);

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
                    console.log(`✅ Updated ${result.updatedCount || 0} roles in ${guild.name}`);
                } else {
                    console.error(`❌ Failed to update roles in ${guild.name}:`, result.error);
                    totalErrors++;
                }

                // Small delay between servers to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`❌ Error updating roles for server ${serverId}:`, error);
                totalErrors++;
            }
        }

        console.log(`✅ Role update complete: ${totalUpdated} members updated, ${totalErrors} errors`);
    } catch (error) {
        console.error('❌ Error in updateAllMemberRolesForActiveServers:', error);
    }
}

/**
 * Send subscription report to #linkwizard channel
 */
async function sendSubscriptionReport(currentCount, newSubscriptions, cancelledSubscriptions) {
    try {
        const reportTargets = [];

        // Find all valid #linkwizard channels across all guilds
        for (const guild of client.guilds.cache.values()) {
            const channel = guild.channels.cache.find(ch => 
                ch.type === 0 && // text channel
                ch.name.toLowerCase() === LINKWIZARD_CHANNEL_NAME.toLowerCase()
            );

            if (channel) {
                const botMember = guild.members.cache.get(client.user.id);
                if (botMember?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
                    reportTargets.push({ guildName: guild.name, channel });
                } else {
                    console.warn(`Missing send permission in #${LINKWIZARD_CHANNEL_NAME} on ${guild.name}`);
                }
            }
        }

        if (reportTargets.length === 0) {
            console.warn(`No accessible #${LINKWIZARD_CHANNEL_NAME} channels found in any server`);
            return;
        }

        console.log(`Sending report to ${reportTargets.length} server(s)`);

        // Build the message once (same content everywhere)
        const now = new Date();
        const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const timeString = estTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            timeZone: 'America/New_York'
        });
        const dateString = estTime.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'America/New_York'
        });

        const message = `📊 **Subscription Snapshot** - ${dateString} at ${timeString} EST (updates every 30 min)

✅ **Status:** System is operational

📈 **Current Paid Members:** ${currentCount}
${newSubscriptions > 0 ? `🆕 **New Subscriptions Today:** +${newSubscriptions}` : ''}
${cancelledSubscriptions > 0 ? `❌ **Cancelled Subscriptions Today:** -${cancelledSubscriptions}` : ''}
${newSubscriptions === 0 && cancelledSubscriptions === 0 ? '📊 **Change:** No changes since yesterday' : ''}

${newSubscriptions > 0 || cancelledSubscriptions > 0 ? `\n**Net Change Today:** ${newSubscriptions - cancelledSubscriptions > 0 ? '+' : ''}${newSubscriptions - cancelledSubscriptions}` : ''}
\n🕒 Next automatic update in ~30 minutes.`;

        // Send to every valid channel + optional cleanup of previous bot message
        for (const { guildName, channel } of reportTargets) {
            try {
                // Optional: clean up old report (nice to have)
                const recent = await channel.messages.fetch({ limit: 10 });
                const lastBotMsg = recent.find(m => m.author.id === client.user.id && m.content.includes('Subscription Snapshot'));
                if (lastBotMsg) {
                    await lastBotMsg.delete().catch(() => {});
                }

                await channel.send(message);
                console.log(`Report sent to ${guildName} #${LINKWIZARD_CHANNEL_NAME}`);
            } catch (err) {
                console.error(`Failed to send report to ${guildName}:`, err.message);
            }
        }
    } catch (error) {
        console.error('❌ Error in sendSubscriptionReport:', error);
    }
}

/**
 * Generate membership links via API
 */
async function requestMembershipLink(action, interactionOrUser, priceId = null, roleName = null) {
    if (!BOT_API_TOKEN) {
        return {
            success: false,
            content: '❌ Membership service is not configured. Please contact an administrator.'
        };
    }

    // Handle both interaction objects and user objects
    const user = interactionOrUser.user || interactionOrUser;
    const guild = interactionOrUser.guild;

    const endpoint =
        action === 'subscribe'
            ? '/api/stripe/member/checkout'
            : '/api/stripe/member/portal';

    const url = `${MEMBER_API_BASE_URL}${endpoint}`;

    try {
        const requestBody = {
            discordUserId: user.id,
            discordUsername: user.tag,
            serverId: guild.id,
            serverName: guild.name
        };

        // For subscribe, include the price ID and role name
        if (action === 'subscribe' && priceId) {
            requestBody.priceId = priceId;
            requestBody.roleName = roleName;
        }

        const response = await axios.post(
            url,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-token': BOT_API_TOKEN
                },
                timeout: 15000
            }
        );

        if (!response.data || !response.data.success) {
            console.error('Membership API responded with error:', response.data);
            return {
                success: false,
                content: '❌ Failed to generate the link. Please try again later.'
            };
        }

        if (action === 'subscribe') {
            const roleText = roleName ? ` for **${roleName}**` : '';
            return {
                success: true,
                content: `🔗 Subscribe${roleText} here: ${response.data.url}`
            };
        }

        return {
            success: true,
            content: `🔗 Manage or cancel your subscription here: ${response.data.url}\n*(Opens Stripe billing portal)*`
        };
    } catch (error) {
        console.error('❌ Membership API request failed:', error);
        return {
            success: false,
            content: '❌ Failed to connect to the membership service. Please try again later.'
        };
    }
}

/**
 * Set up the recurring subscription check cron job
 * Runs every 30 minutes (top and half hour) in America/New_York timezone
 */
function setupRecurringSubscriptionCheck() {
    cron.schedule('0,30 * * * *', async () => {
        console.log('⏰ Running scheduled subscription check (every 30 minutes EST)...');
        await checkSubscriptions();
    }, {
        timezone: 'America/New_York' // Automatically handles EST/EDT conversion
    });

    console.log('📅 Subscription checks scheduled every 30 minutes (America/New_York)');
}

// Generate Discord invite function
async function generateDiscordInvite(serverId, options = {}) {
    try {
        console.log(`🔗 Generating invite for server ${serverId}`);
        
        // Find the guild (server)
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            console.log(`Guild not found. Available guilds: ${client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ')}`);
            throw new Error('Server not found or bot not in server');
        }
        
        console.log(`Found guild: ${guild.name} (${guild.id})`);
        
        // Fetch the guild members to ensure we have the bot member
        await guild.members.fetch();
        
        // Check if bot has permission to create invites
        const botMember = guild.members.cache.get(client.user.id);
        if (!botMember) {
            console.log(`Bot member not found in guild. Bot ID: ${client.user.id}`);
            throw new Error('Bot is not a member of this server. Please add the bot to the server first.');
        }
        
        console.log(`Bot member found: ${botMember.user.tag}`);
        
        if (!botMember.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
            throw new Error('Bot does not have permission to create invites');
        }
        
        // Find a suitable channel to create the invite
        const channel = guild.channels.cache.find(ch => 
            ch.type === 0 && // Text channel
            ch.permissionsFor(botMember).has(PermissionFlagsBits.CreateInstantInvite)
        );
        
        if (!channel) {
            throw new Error('No suitable channel found for creating invites');
        }
        
        // Create the invite
        const invite = await channel.createInvite({
            maxAge: options.maxAge || 0,
            maxUses: options.maxUses || 0,
            unique: true,
            reason: 'Generated via Discord Monetization Bot'
        });
        
        console.log(`✅ Created invite for ${guild.name}: ${invite.url}`);
        
        return {
            success: true,
            invite_code: invite.code,
            invite_url: invite.url,
            server_name: guild.name,
            channel_name: channel.name,
            expires_at: invite.expiresAt,
            max_uses: invite.maxUses
        };
        
    } catch (error) {
        console.error('❌ Error generating invite:', error);
        return { success: false, error: error.message };
    }
}

// Get server information
async function getServerInfo(serverId) {
    try {
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Server not found');
        }
        
        const serverInfo = {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            member_count: guild.memberCount,
            owner_id: guild.ownerId,
            created_at: guild.createdAt,
            bot_has_permissions: guild.members.cache.get(client.user.id)?.permissions.has(PermissionFlagsBits.CreateInstantInvite) || false
        };

        return {
            success: true,
            server: serverInfo
        };
        
    } catch (error) {
        console.error('Error fetching server info:', error.message);
        return { success: false, error: error.message };
    }
}

// Get all servers
async function getAllServers() {
    try {
        const servers = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            member_count: guild.memberCount,
            owner_id: guild.ownerId,
            bot_has_permissions: guild.members.cache.get(client.user.id)?.permissions.has(PermissionFlagsBits.CreateInstantInvite) || false
        }));
        
        return {
            success: true,
            servers: servers
        };
        
    } catch (error) {
        console.error('Error fetching servers:', error.message);
        return { success: false, error: error.message };
    }
}

// API Routes
app.post('/api/bot/generate-invite', async (req, res) => {
    try {
        const { serverId, maxAge = 0, maxUses = 0 } = req.body;
        
        if (!serverId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Server ID is required' 
            });
        }

        const result = await generateDiscordInvite(serverId, { maxAge, maxUses });
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in generate-invite endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/bot/server/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;
        const result = await getServerInfo(serverId);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in server info endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/bot/servers', async (req, res) => {
    try {
        const result = await getAllServers();
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in servers endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/bot/health', async (req, res) => {
    try {
        res.json({
            status: 'healthy',
            bot_online: client.isReady(),
            bot_user: client.user ? client.user.tag : 'Unknown',
            guilds_count: client.guilds.cache.size,
            message: 'Bot is operational'
        });
    } catch (error) {
        console.error('❌ Error in health endpoint:', error);
        res.json({
            status: 'error',
            message: error.message,
            bot_online: false
        });
    }
});

// Keep-alive endpoint
app.get('/api/bot/keepalive', async (req, res) => {
    try {
        res.json({
            status: 'alive',
            bot_user: client.user ? client.user.tag : 'Unknown',
            guilds_count: client.guilds.cache.size,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Keep-alive failed:', error);
        res.json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Start the server
async function startServer() {
    try {
        if (!BOT_TOKEN) {
            throw new Error('DISCORD_BOT_TOKEN environment variable is required');
        }
        
        // Login to Discord
        await client.login(BOT_TOKEN);
        
        // Start HTTP server
        app.listen(PORT, () => {
            console.log(`🚀 Bot server running on port ${PORT}`);
            console.log(`📡 Health check: http://localhost:${PORT}/api/bot/health`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start bot server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot server...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down bot server...');
    client.destroy();
    process.exit(0);
});

// Export the client and app for use in other modules
module.exports = {
  client,
  app,
  startServer
};

// Start the server
startServer();
