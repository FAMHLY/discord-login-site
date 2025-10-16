// Test script to verify click tracking is working
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testClickTracking() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );

    console.log('🔍 Testing click tracking system...');
    
    try {
        // Check affiliate_tracking table
        console.log('\n📊 Checking affiliate_tracking table...');
        const { data: trackingData, error: trackingError } = await supabase
            .from('affiliate_tracking')
            .select('*')
            .order('click_timestamp', { ascending: false })
            .limit(5);
            
        if (trackingError) {
            console.error('❌ Error fetching tracking data:', trackingError);
        } else {
            console.log(`✅ Found ${trackingData.length} tracking records:`);
            trackingData.forEach((record, index) => {
                console.log(`  ${index + 1}. Invite: ${record.invite_code}, Affiliate: ${record.affiliate_id}, Status: ${record.conversion_status}, Time: ${record.click_timestamp}`);
            });
        }
        
        // Check discord_servers table for updated counts
        console.log('\n📈 Checking discord_servers table...');
        const { data: serversData, error: serversError } = await supabase
            .from('discord_servers')
            .select('discord_server_id, server_name, total_invite_clicks, total_joins, conversion_rate')
            .order('total_invite_clicks', { ascending: false });
            
        if (serversError) {
            console.error('❌ Error fetching servers data:', serversError);
        } else {
            console.log(`✅ Found ${serversData.length} servers with statistics:`);
            serversData.forEach((server, index) => {
                console.log(`  ${index + 1}. ${server.server_name} (${server.discord_server_id}):`);
                console.log(`     - Total Invite Clicks: ${server.total_invite_clicks || 0}`);
                console.log(`     - Total Joins: ${server.total_joins || 0}`);
                console.log(`     - Conversion Rate: ${server.conversion_rate || '0%'}`);
            });
        }
        
        // Check if there's a mismatch between tracking records and server counts
        console.log('\n🔍 Verifying click counts...');
        const totalTrackingRecords = trackingData ? trackingData.length : 0;
        const totalServerClicks = serversData ? serversData.reduce((sum, server) => sum + (server.total_invite_clicks || 0), 0) : 0;
        
        console.log(`📊 Total tracking records: ${totalTrackingRecords}`);
        console.log(`📊 Total server clicks: ${totalServerClicks}`);
        
        if (totalTrackingRecords !== totalServerClicks) {
            console.log('⚠️  Mismatch detected! This suggests the server click counts are not being updated properly.');
        } else {
            console.log('✅ Click counts match between tracking and server tables.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testClickTracking().catch(console.error);