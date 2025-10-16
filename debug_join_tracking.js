// Debug script to check why join tracking isn't working
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debugJoinTracking() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );

    console.log('🔍 Debugging join tracking issues...');
    
    const testServerId = '831000377863176233';
    
    try {
        // Step 1: Check current tracking records
        console.log('\n📊 Step 1: Current tracking records...');
        
        const { data: allTracking, error: trackingError } = await supabase
            .from('affiliate_tracking')
            .select('*')
            .eq('discord_server_id', testServerId)
            .order('click_timestamp', { ascending: false });
            
        if (trackingError) {
            console.error('❌ Error fetching tracking data:', trackingError);
            return;
        }
        
        console.log(`✅ Found ${allTracking.length} tracking records`);
        
        const pendingClicks = allTracking.filter(r => r.conversion_status === 'clicked' && !r.join_timestamp);
        const completedJoins = allTracking.filter(r => r.conversion_status === 'joined');
        
        console.log(`   - Pending clicks (awaiting joins): ${pendingClicks.length}`);
        console.log(`   - Completed joins: ${completedJoins.length}`);
        
        if (pendingClicks.length > 0) {
            console.log('\n📋 Recent pending clicks:');
            pendingClicks.slice(0, 3).forEach((record, index) => {
                console.log(`  ${index + 1}. ID: ${record.id}`);
                console.log(`     - Affiliate: ${record.affiliate_id || 'None'}`);
                console.log(`     - Click time: ${record.click_timestamp}`);
                console.log(`     - Invite code: ${record.invite_code}`);
            });
        }
        
        // Step 2: Check server statistics
        console.log('\n📈 Step 2: Server statistics...');
        
        const { data: server, error: serverError } = await supabase
            .from('discord_servers')
            .select('server_name, total_invite_clicks, total_joins, conversion_rate')
            .eq('discord_server_id', testServerId)
            .single();
            
        if (serverError) {
            console.error('❌ Error fetching server data:', serverError);
            return;
        }
        
        console.log(`✅ Server: ${server.server_name}`);
        console.log(`   - Total Invite Clicks: ${server.total_invite_clicks || 0}`);
        console.log(`   - Total Joins: ${server.total_joins || 0}`);
        console.log(`   - Conversion Rate: ${server.conversion_rate || 0}%`);
        
        // Step 3: Check if bot has the right permissions
        console.log('\n🤖 Step 3: Bot permission checklist...');
        console.log('❓ Does your bot have these permissions in Discord?');
        console.log('   ✅ View Server Members (GUILD_MEMBERS intent)');
        console.log('   ✅ Read Message History');
        console.log('   ✅ Send Messages');
        console.log('   ✅ Create Instant Invite');
        console.log('');
        console.log('❓ Is "Server Members Intent" enabled in Discord Developer Portal?');
        console.log('   Go to: https://discord.com/developers/applications');
        console.log('   → Your App → Bot → Privileged Gateway Intents');
        console.log('   → Enable "Server Members Intent"');
        
        // Step 4: Check Railway bot logs
        console.log('\n📡 Step 4: Railway bot status...');
        console.log('❓ Check your Railway deployment logs for:');
        console.log('   - "Bot logged in as [username]"');
        console.log('   - "Connected to X servers"');
        console.log('   - "New member joined" messages');
        console.log('   - Any error messages');
        
        // Step 5: Test scenario
        console.log('\n🧪 Step 5: Test scenario...');
        console.log('To test join tracking:');
        console.log('1. Click your invite link (creates "clicked" record)');
        console.log('2. Join the Discord server with the same account');
        console.log('3. Check Railway logs for "New member joined" message');
        console.log('4. Run this debug script again');
        
        if (pendingClicks.length > 0) {
            console.log('\n⚠️ ISSUE IDENTIFIED:');
            console.log(`You have ${pendingClicks.length} pending clicks that should have been converted to joins.`);
            console.log('This suggests the bot is not detecting member joins.');
            console.log('');
            console.log('🔧 POSSIBLE SOLUTIONS:');
            console.log('1. Enable "Server Members Intent" in Discord Developer Portal');
            console.log('2. Re-invite bot with proper permissions');
            console.log('3. Check Railway logs for error messages');
            console.log('4. Verify bot is actually in your Discord server');
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

debugJoinTracking().catch(console.error);
