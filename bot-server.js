// Persistent Discord Bot Server
// This runs as a standalone server for better performance
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
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
const MEMBER_API_BASE_URL = process.env.MEMBER_API_BASE_URL || process.env.API_BASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
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
        GatewayIntentBits.MessageContent
    ]
});

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

client.on('interactionCreate', async interaction => {
    try {
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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const linkResult = await requestMembershipLink(interaction.commandName, interaction);

        if (!linkResult.success) {
            await interaction.editReply(linkResult.content);
            return;
        }

        let dmSent = false;
        try {
            await interaction.user.send(linkResult.content);
            dmSent = true;
        } catch (dmError) {
            console.warn('⚠️ Unable to DM user:', dmError.message);
        }

        if (dmSent) {
            await interaction.editReply('📬 Check your DMs for the link.');
        } else {
            await interaction.editReply(`❕ I couldn't DM you, so here's the link instead:\n${linkResult.content}`);
        }
        }
    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: '❌ Something went wrong while processing that command. Please try again later.'
            });
        } else {
            await interaction.reply({
                content: '❌ Something went wrong while processing that command. Please try again later.',
                ephemeral: true
            });
        }
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

        // Get unique server IDs
        const serverIds = [...new Set(activeSubscriptions.map(sub => sub.discord_server_id))];
        console.log(`🔄 Updating roles for ${serverIds.length} server(s) with active subscriptions`);

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
        // Find the channel in all guilds
        let targetChannel = null;
        
        for (const guild of client.guilds.cache.values()) {
            const channel = guild.channels.cache.find(
                ch => ch.type === 0 && ch.name === LINKWIZARD_CHANNEL_NAME
            );
            
            if (channel) {
                targetChannel = channel;
                break;
            }
        }

        if (!targetChannel) {
            console.error(`❌ Could not find #${LINKWIZARD_CHANNEL_NAME} channel in any server`);
            return;
        }

        // Check if bot has permission to send messages
        const botMember = targetChannel.guild.members.cache.get(client.user.id);
        if (!botMember?.permissionsIn(targetChannel).has(PermissionFlagsBits.SendMessages)) {
            console.error(`❌ Bot does not have permission to send messages in #${LINKWIZARD_CHANNEL_NAME}`);
            return;
        }

        // Try to remove the most recent bot message before posting an update
        try {
            const recentMessages = await targetChannel.messages.fetch({ limit: 50 });
            const lastBotMessage = recentMessages.find(msg => msg.author.id === client.user.id);
            if (lastBotMessage) {
                await lastBotMessage.delete();
                console.log('🧹 Removed previous subscription report message');
            }
        } catch (fetchError) {
            console.warn('⚠️ Unable to remove previous subscription report message:', fetchError.message);
        }

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

        // Create formatted message
        const message = `📊 **Subscription Snapshot** - ${dateString} at ${timeString} EST (updates every 30 min)

✅ **Status:** System is operational

📈 **Current Paid Members:** ${currentCount}
${newSubscriptions > 0 ? `🆕 **New Subscriptions Today:** +${newSubscriptions}` : ''}
${cancelledSubscriptions > 0 ? `❌ **Cancelled Subscriptions Today:** -${cancelledSubscriptions}` : ''}
${newSubscriptions === 0 && cancelledSubscriptions === 0 ? '📊 **Change:** No changes since yesterday' : ''}

${newSubscriptions > 0 || cancelledSubscriptions > 0 ? `\n**Net Change Today:** ${newSubscriptions - cancelledSubscriptions > 0 ? '+' : ''}${newSubscriptions - cancelledSubscriptions}` : ''}
\n🕒 Next automatic update in ~30 minutes.`;

        await targetChannel.send(message);
        console.log(`✅ Sent subscription report to #${LINKWIZARD_CHANNEL_NAME}`);

    } catch (error) {
        console.error('❌ Error sending subscription report:', error);
    }
}

/**
 * Generate membership links via API
 */
async function requestMembershipLink(action, interaction) {
    if (!BOT_API_TOKEN) {
        return {
            success: false,
            content: '❌ Membership service is not configured. Please contact an administrator.'
        };
    }

    const endpoint =
        action === 'subscribe'
            ? '/api/stripe/member/checkout'
            : '/api/stripe/member/portal';

    const url = `${MEMBER_API_BASE_URL}${endpoint}`;

    try {
        const response = await axios.post(
            url,
            {
                discordUserId: interaction.user.id,
                discordUsername: interaction.user.tag,
                serverId: interaction.guild.id,
                serverName: interaction.guild.name,
                priceId: STRIPE_DEFAULT_PRICE_ID
            },
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
            return {
                success: true,
                content: `🔗 Subscribe here: ${response.data.url}`
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
