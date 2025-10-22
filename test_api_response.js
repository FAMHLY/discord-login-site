// Test what the API is actually returning to the frontend
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAPIResponse() {
  try {
    console.log('🔍 Testing API response data...\n');
    
    // Simulate what the /api/servers endpoint returns
    console.log('📊 Simulating /api/servers endpoint response:');
    
    // Get servers from database (this is what the API does)
    const { data: dbServers, error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('discord_server_id', '831000377863176233');
    
    if (error) {
      console.error('❌ Error fetching server data:', error);
      return;
    }
    
    console.log(`Found ${dbServers.length} server records:`);
    dbServers.forEach((server, index) => {
      console.log(`\n${index + 1}. Server Record:`);
      console.log(`   Discord Server ID: ${server.discord_server_id}`);
      console.log(`   Owner Discord ID: ${server.owner_discord_id}`);
      console.log(`   Server Name: ${server.server_name}`);
      console.log(`   Invite Code: ${server.invite_code}`);
      console.log(`   User Role: ${server.user_role}`);
      console.log(`   --- OLD TRACKING DATA ---`);
      console.log(`   Total Invite Clicks: ${server.total_invite_clicks || 0}`);
      console.log(`   Total Joins: ${server.total_joins || 0}`);
      console.log(`   Conversion Rate: ${server.conversion_rate || 0}%`);
      console.log(`   Monthly Revenue: $${server.monthly_revenue || '0.00'}`);
      console.log(`   --- NEW USER-SPECIFIC TRACKING DATA ---`);
      console.log(`   User Total Invite Clicks: ${server.user_total_invite_clicks || 0}`);
      console.log(`   User Total Joins: ${server.user_total_joins || 0}`);
      console.log(`   User Conversion Rate: ${server.user_conversion_rate || 0}%`);
      console.log(`   User Paid Conversion Rate: ${server.user_paid_conversion_rate || 0}%`);
      console.log(`   User Monthly Revenue: $${server.user_monthly_revenue || '0.00'}`);
    });
    
    // Test what the frontend receives
    console.log('\n🎯 What the frontend receives:');
    console.log('The frontend JavaScript expects these properties:');
    console.log('- server.user_total_invite_clicks');
    console.log('- server.user_total_joins');
    console.log('- server.user_conversion_rate');
    console.log('- server.user_paid_conversion_rate');
    console.log('- server.user_monthly_revenue');
    
    // Check if the frontend is getting the right data
    const user1Server = dbServers.find(s => s.owner_discord_id === '210250076281372673');
    const user2Server = dbServers.find(s => s.owner_discord_id === '1428239995763822592');
    
    console.log('\n📱 Frontend data for User 1 (should show 26 clicks, 2 joins):');
    if (user1Server) {
      console.log(`   user_total_invite_clicks: ${user1Server.user_total_invite_clicks}`);
      console.log(`   user_total_joins: ${user1Server.user_total_joins}`);
      console.log(`   user_conversion_rate: ${user1Server.user_conversion_rate}`);
      console.log(`   user_monthly_revenue: ${user1Server.user_monthly_revenue}`);
    } else {
      console.log('   ❌ User 1 server record not found');
    }
    
    console.log('\n📱 Frontend data for User 2 (should show 0 clicks, 0 joins):');
    if (user2Server) {
      console.log(`   user_total_invite_clicks: ${user2Server.user_total_invite_clicks}`);
      console.log(`   user_total_joins: ${user2Server.user_total_joins}`);
      console.log(`   user_conversion_rate: ${user2Server.user_conversion_rate}`);
      console.log(`   user_monthly_revenue: ${user2Server.user_monthly_revenue}`);
    } else {
      console.log('   ❌ User 2 server record not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPIResponse();
