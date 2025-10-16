// Test script to verify join tracking system
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testJoinTracking() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );

    console.log('🧪 Testing join tracking system...');
    
    const testServerId = '831000377863176233';
    
    try {
        // Step 1: Check current state
        console.log('\n📊 Step 1: Current tracking state...');
        
        const { data: allTracking, error: trackingError } = await supabase
            .from('affiliate_tracking')
            .select('*')
            .eq('discord_server_id', testServerId);
            
        if (trackingError) {
            console.error('❌ Error fetching tracking data:', trackingError);
            return;
        }
        
        console.log(`✅ Found ${allTracking.length} total tracking records`);
        
        const clicks = allTracking.filter(r => r.conversion_status === 'clicked');
        const joins = allTracking.filter(r => r.conversion_status === 'joined');
        
        console.log(`   - Clicks: ${clicks.length}`);
        console.log(`   - Joins: ${joins.length}`);
        
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
        
        // Step 3: Verify consistency
        console.log('\n🔍 Step 3: Verifying consistency...');
        
        const trackingClicks = allTracking.length;
        const trackingJoins = joins.length;
        
        console.log(`📊 Tracking records: ${trackingClicks} clicks, ${trackingJoins} joins`);
        console.log(`📊 Server stats: ${server.total_invite_clicks || 0} clicks, ${server.total_joins || 0} joins`);
        
        if (trackingClicks === (server.total_invite_clicks || 0) && trackingJoins === (server.total_joins || 0)) {
            console.log('✅ PERFECT: Tracking records and server stats match!');
        } else {
            console.log('⚠️ MISMATCH: Tracking records and server stats do not match');
            console.log(`   Click mismatch: ${trackingClicks} vs ${server.total_invite_clicks || 0}`);
            console.log(`   Join mismatch: ${trackingJoins} vs ${server.total_joins || 0}`);
        }
        
        // Step 4: Show detailed tracking records
        console.log('\n📋 Step 4: Detailed tracking records...');
        
        allTracking.forEach((record, index) => {
            console.log(`  ${index + 1}. Status: ${record.conversion_status}`);
            console.log(`     - Affiliate: ${record.affiliate_id || 'None'}`);
            console.log(`     - User: ${record.user_discord_id || 'N/A'}`);
            console.log(`     - Click: ${record.click_timestamp}`);
            console.log(`     - Join: ${record.join_timestamp || 'N/A'}`);
            console.log(`     - Invite: ${record.invite_code}`);
        });
        
        // Step 5: Calculate expected conversion rate
        console.log('\n📊 Step 5: Conversion rate analysis...');
        
        if (trackingClicks > 0) {
            const expectedRate = ((trackingJoins / trackingClicks) * 100).toFixed(2);
            const actualRate = server.conversion_rate || 0;
            
            console.log(`Expected conversion rate: ${expectedRate}%`);
            console.log(`Actual conversion rate: ${actualRate}%`);
            
            if (Math.abs(expectedRate - actualRate) < 0.01) {
                console.log('✅ Conversion rate is accurate!');
            } else {
                console.log('⚠️ Conversion rate mismatch');
            }
        } else {
            console.log('No clicks recorded yet');
        }
        
        console.log('\n🎯 Join tracking system analysis complete!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testJoinTracking().catch(console.error);
