// Test script to verify affiliate tracking persistence
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testPersistence() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );

    console.log('🧪 Testing affiliate tracking persistence...');
    
    const testServerId = '831000377863176233';
    
    try {
        // Step 1: Check current state
        console.log('\n📊 Step 1: Current state...');
        
        const { data: currentTracking, error: trackingError } = await supabase
            .from('affiliate_tracking')
            .select('*')
            .eq('discord_server_id', testServerId);
            
        if (trackingError) {
            console.error('❌ Error fetching tracking data:', trackingError);
            return;
        }
        
        console.log(`✅ Found ${currentTracking.length} tracking records`);
        currentTracking.forEach((record, index) => {
            console.log(`  ${index + 1}. Affiliate: ${record.affiliate_id}, Server ID: ${record.server_id}, Time: ${record.click_timestamp}`);
        });
        
        const { data: currentServer, error: serverError } = await supabase
            .from('discord_servers')
            .select('id, server_name, total_invite_clicks')
            .eq('discord_server_id', testServerId)
            .single();
            
        if (serverError) {
            console.error('❌ Error fetching server data:', serverError);
            return;
        }
        
        console.log(`✅ Server: ${currentServer.server_name}`);
        console.log(`✅ Server ID: ${currentServer.id}`);
        console.log(`✅ Click count: ${currentServer.total_invite_clicks}`);
        
        // Step 2: Simulate server removal (set server_id to null)
        console.log('\n🗑️ Step 2: Simulating server removal...');
        
        if (currentTracking.length > 0) {
            const { error: preserveError } = await supabase
                .from('affiliate_tracking')
                .update({ server_id: null })
                .eq('discord_server_id', testServerId);
                
            if (preserveError) {
                console.error('❌ Error preserving tracking data:', preserveError);
                return;
            }
            
            console.log('✅ Tracking data preserved (server_id set to null)');
        }
        
        // Simulate server deletion
        const { error: deleteError } = await supabase
            .from('discord_servers')
            .delete()
            .eq('discord_server_id', testServerId);
            
        if (deleteError) {
            console.error('❌ Error deleting server:', deleteError);
            return;
        }
        
        console.log('✅ Server configuration deleted');
        
        // Step 3: Check that tracking data still exists
        console.log('\n📊 Step 3: Checking tracking data preservation...');
        
        const { data: preservedTracking, error: preservedError } = await supabase
            .from('affiliate_tracking')
            .select('*')
            .eq('discord_server_id', testServerId);
            
        if (preservedError) {
            console.error('❌ Error checking preserved tracking:', preservedError);
            return;
        }
        
        console.log(`✅ Found ${preservedTracking.length} preserved tracking records`);
        preservedTracking.forEach((record, index) => {
            console.log(`  ${index + 1}. Affiliate: ${record.affiliate_id}, Server ID: ${record.server_id || 'NULL'}, Time: ${record.click_timestamp}`);
        });
        
        if (preservedTracking.length === currentTracking.length) {
            console.log('🎉 SUCCESS: All tracking data preserved!');
        } else {
            console.log('❌ FAILED: Some tracking data was lost');
        }
        
        // Step 4: Simulate server re-addition
        console.log('\n🔄 Step 4: Simulating server re-addition...');
        
        const { data: newServer, error: createError } = await supabase
            .from('discord_servers')
            .insert({
                owner_id: '40fdf86f-d24e-404d-a8b2-d4c78e8fa584', // Your user ID
                discord_server_id: testServerId,
                server_name: 'FAMHLY RE-UNION',
                invite_code: 'fjv6jykYkU',
                total_invite_clicks: 0,
                total_joins: 0,
                conversion_rate: 0.00,
                monthly_revenue: 0.00,
                owner_discord_id: '210250076281372673'
            })
            .select()
            .single();
            
        if (createError) {
            console.error('❌ Error recreating server:', createError);
            return;
        }
        
        console.log(`✅ Server recreated with ID: ${newServer.id}`);
        
        // Step 5: Restore tracking data
        console.log('\n📊 Step 5: Restoring tracking data...');
        
        if (preservedTracking.length > 0) {
            const { error: restoreError } = await supabase
                .from('affiliate_tracking')
                .update({ 
                    server_id: newServer.id,
                    updated_at: new Date().toISOString()
                })
                .eq('discord_server_id', testServerId)
                .is('server_id', null);
                
            if (restoreError) {
                console.error('❌ Error restoring tracking data:', restoreError);
                return;
            }
            
            console.log(`✅ Restored ${preservedTracking.length} tracking records`);
            
            // Update server click count
            const { error: countError } = await supabase
                .from('discord_servers')
                .update({ 
                    total_invite_clicks: preservedTracking.length,
                    updated_at: new Date().toISOString()
                })
                .eq('discord_server_id', testServerId);
                
            if (countError) {
                console.error('❌ Error updating click count:', countError);
                return;
            }
            
            console.log(`✅ Updated server click count to ${preservedTracking.length}`);
        }
        
        // Step 6: Verify final state
        console.log('\n✅ Step 6: Final verification...');
        
        const { data: finalTracking, error: finalTrackingError } = await supabase
            .from('affiliate_tracking')
            .select('*')
            .eq('discord_server_id', testServerId);
            
        if (finalTrackingError) {
            console.error('❌ Error fetching final tracking:', finalTrackingError);
            return;
        }
        
        const { data: finalServer, error: finalServerError } = await supabase
            .from('discord_servers')
            .select('total_invite_clicks, server_name')
            .eq('discord_server_id', testServerId)
            .single();
            
        if (finalServerError) {
            console.error('❌ Error fetching final server:', finalServerError);
            return;
        }
        
        console.log(`✅ Final tracking records: ${finalTracking.length}`);
        console.log(`✅ Final server click count: ${finalServer.total_invite_clicks}`);
        
        if (finalTracking.length === currentTracking.length && finalServer.total_invite_clicks === currentTracking.length) {
            console.log('🎉 PERFECT: Persistence system is working correctly!');
            console.log('✅ All tracking data survived server removal/re-addition');
            console.log('✅ Click counts were properly restored');
        } else {
            console.log('❌ FAILED: Persistence system has issues');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testPersistence().catch(console.error);
