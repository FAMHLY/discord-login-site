// Manual test script for subscription check
// This allows you to test the subscription check function without waiting for the 30-minute schedule

require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const LINKWIZARD_CHANNEL_NAME = 'linkwizard';

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
    console.error('❌ Supabase credentials not found');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
  process.exit(1);
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
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

        // Send report to Discord channel
        await sendSubscriptionReport(currentCount, actualNew, actualCancelled);

    } catch (error) {
        console.error('❌ Error in subscription check:', error);
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
        const message = `📊 **Daily Subscription Report** - ${dateString} at ${timeString} EST

✅ **Status:** System is operational

📈 **Current Paid Members:** ${currentCount}
${newSubscriptions > 0 ? `🆕 **New Subscriptions Today:** +${newSubscriptions}` : ''}
${cancelledSubscriptions > 0 ? `❌ **Cancelled Subscriptions Today:** -${cancelledSubscriptions}` : ''}
${newSubscriptions === 0 && cancelledSubscriptions === 0 ? '📊 **Change:** No changes since yesterday' : ''}

${newSubscriptions > 0 || cancelledSubscriptions > 0 ? `\n**Net Change:** ${newSubscriptions - cancelledSubscriptions > 0 ? '+' : ''}${newSubscriptions - cancelledSubscriptions}` : ''}
`;

        await targetChannel.send(message);
        console.log(`✅ Sent subscription report to #${LINKWIZARD_CHANNEL_NAME}`);

    } catch (error) {
        console.error('❌ Error sending subscription report:', error);
    }
}

// Run the test
async function runTest() {
    try {
        if (!BOT_TOKEN) {
            console.error('❌ DISCORD_BOT_TOKEN environment variable is required');
            process.exit(1);
        }

        console.log('🔌 Logging in to Discord...');
        await client.login(BOT_TOKEN);

        // Wait for ready event
        await new Promise((resolve) => {
            client.once('clientReady', () => {
                console.log(`✅ Bot logged in as ${client.user.tag}`);
                resolve();
            });
        });

        // Wait a bit for guilds to cache
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Run the check
        await checkSubscriptions();

        // Wait a bit before closing
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('✅ Test complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

runTest();

