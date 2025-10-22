// Debug what the API is actually returning to the frontend
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAPIResponse() {
  try {
    console.log('🔍 Debugging API response...\n');
    
    // Simulate the API query that the frontend makes
    // The API queries by owner_id (Supabase user ID), not owner_discord_id
    
    console.log('📊 Checking what the API returns for each user...\n');
    
    // Get all server records to see the mapping
    const { data: allServers, error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('discord_server_id', '831000377863176233');
    
    if (error) {
      console.error('❌ Error fetching servers:', error);
      return;
    }
    
    console.log('All server records:');
    allServers.forEach((server, index) => {
      console.log(`\n${index + 1}. Server Record:`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Owner ID (Supabase): ${server.owner_id}`);
      console.log(`   Owner Discord ID: ${server.owner_discord_id}`);
      console.log(`   Server Name: ${server.server_name}`);
      console.log(`   User Total Invite Clicks: ${server.user_total_invite_clicks || 0}`);
      console.log(`   User Total Joins: ${server.user_total_joins || 0}`);
      console.log(`   User Conversion Rate: ${server.user_conversion_rate || 0}%`);
      console.log(`   User Monthly Revenue: $${server.user_monthly_revenue || '0.00'}`);
    });
    
    // The API queries by owner_id (Supabase user ID)
    // Let's check what happens when we query by each user's Supabase ID
    
    console.log('\n🔍 Simulating API queries by owner_id...\n');
    
    // Query for User 1's Supabase ID
    const user1SupabaseId = '40fdf86f-d24e-404d-a8b2-d4c78e8fa584'; // From the logs
    console.log(`Querying for User 1 (Supabase ID: ${user1SupabaseId}):`);
    
    const { data: user1Servers, error: user1Error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('owner_id', user1SupabaseId);
    
    if (user1Error) {
      console.error('❌ Error fetching User 1 servers:', user1Error);
    } else {
      console.log(`Found ${user1Servers.length} servers for User 1:`);
      user1Servers.forEach(server => {
        console.log(`   Server: ${server.server_name}`);
        console.log(`   User Total Invite Clicks: ${server.user_total_invite_clicks || 0}`);
        console.log(`   User Total Joins: ${server.user_total_joins || 0}`);
        console.log(`   User Conversion Rate: ${server.user_conversion_rate || 0}%`);
        console.log(`   User Monthly Revenue: $${server.user_monthly_revenue || '0.00'}`);
      });
    }
    
    // Query for User 2's Supabase ID
    const user2SupabaseId = 'd2ec29c7-ad94-49ab-b795-710499f4180b'; // From the logs
    console.log(`\nQuerying for User 2 (Supabase ID: ${user2SupabaseId}):`);
    
    const { data: user2Servers, error: user2Error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('owner_id', user2SupabaseId);
    
    if (user2Error) {
      console.error('❌ Error fetching User 2 servers:', user2Error);
    } else {
      console.log(`Found ${user2Servers.length} servers for User 2:`);
      user2Servers.forEach(server => {
        console.log(`   Server: ${server.server_name}`);
        console.log(`   User Total Invite Clicks: ${server.user_total_invite_clicks || 0}`);
        console.log(`   User Total Joins: ${server.user_total_joins || 0}`);
        console.log(`   User Conversion Rate: ${server.user_conversion_rate || 0}%`);
        console.log(`   User Monthly Revenue: $${server.user_monthly_revenue || '0.00'}`);
      });
    }
    
    // Check if the stats were updated correctly
    console.log('\n🔍 Checking if stats were updated correctly...\n');
    
    // Update stats for both users
    console.log('Updating User 1 stats...');
    const { error: update1Error } = await supabase
      .rpc('update_user_server_stats', {
        p_discord_server_id: '831000377863176233',
        p_owner_discord_id: '210250076281372673'
      });
    
    if (update1Error) {
      console.error('❌ Error updating User 1 stats:', update1Error);
    } else {
      console.log('✅ User 1 stats updated');
    }
    
    console.log('Updating User 2 stats...');
    const { error: update2Error } = await supabase
      .rpc('update_user_server_stats', {
        p_discord_server_id: '831000377863176233',
        p_owner_discord_id: '1428239995763822592'
      });
    
    if (update2Error) {
      console.error('❌ Error updating User 2 stats:', update2Error);
    } else {
      console.log('✅ User 2 stats updated');
    }
    
    // Check the updated data
    console.log('\n📊 Updated data:');
    const { data: updatedServers, error: fetchError } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('discord_server_id', '831000377863176233');
    
    if (!fetchError && updatedServers) {
      updatedServers.forEach((server, index) => {
        console.log(`\n${index + 1}. Owner Discord ID: ${server.owner_discord_id}`);
        console.log(`   Owner ID (Supabase): ${server.owner_id}`);
        console.log(`   User Total Invite Clicks: ${server.user_total_invite_clicks || 0}`);
        console.log(`   User Total Joins: ${server.user_total_joins || 0}`);
        console.log(`   User Conversion Rate: ${server.user_conversion_rate || 0}%`);
        console.log(`   User Monthly Revenue: $${server.user_monthly_revenue || '0.00'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugAPIResponse();
