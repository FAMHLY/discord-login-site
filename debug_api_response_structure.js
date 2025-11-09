// Debug what the API is actually returning to understand the structure
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAPIResponseStructure() {
  try {
    console.log('🔍 Debugging API response structure...\n');
    
    // Simulate what the API does exactly
    console.log('📊 Simulating the exact API query...\n');
    
    // This is what the API does:
    // 1. Gets user from auth (we'll simulate with User 1's ID)
    // 2. Queries discord_servers by owner_id
    
    const user1SupabaseId = '40fdf86f-d24e-404d-a8b2-d4c78e8fa584';
    
    console.log(`Querying for User 1 (Supabase ID: ${user1SupabaseId})...`);
    
    const { data: dbServers, error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('owner_id', user1SupabaseId);
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    console.log(`Found ${dbServers.length} servers in database:`);
    
    if (dbServers.length > 0) {
      const server = dbServers[0];
      console.log('\n📱 Server data structure:');
      console.log('Available properties:');
      Object.keys(server).forEach(key => {
        const value = server[key];
        console.log(`   ${key}: ${value} (type: ${typeof value})`);
      });
      
      // Check the specific user tracking columns
      console.log('\n🎯 User-specific tracking columns:');
      const userColumns = [
        'user_total_invite_clicks',
        'user_total_joins', 
        'user_conversion_rate',
        'user_paid_conversion_rate',
        'user_monthly_revenue'
      ];
      
      userColumns.forEach(column => {
        const value = server[column];
        const exists = column in server;
        console.log(`   ${column}: ${exists ? `✅ ${value}` : '❌ Missing'}`);
      });
      
      // This is what the API returns
      console.log('\n📤 API Response Structure:');
      const apiResponse = {
        message: 'Discord server fetching requires additional OAuth setup. Please configure your Discord servers manually.',
        discord_user_id: '210250076281372673', // This would come from user metadata
        configured_servers: dbServers || [],
        setup_required: true
      };
      
      console.log('API Response:');
      console.log(JSON.stringify(apiResponse, null, 2));
      
      // Check if the frontend is looking at the right data
      console.log('\n🔍 Frontend Data Access:');
      console.log('The frontend calls loadServers() which calls /api/servers');
      console.log('The response has configured_servers array');
      console.log('Each server in configured_servers should have the user tracking columns');
      
      if (apiResponse.configured_servers.length > 0) {
        const firstServer = apiResponse.configured_servers[0];
        console.log('\nFirst server in configured_servers:');
        console.log(`   user_total_invite_clicks: ${firstServer.user_total_invite_clicks || 'undefined'}`);
        console.log(`   user_total_joins: ${firstServer.user_total_joins || 'undefined'}`);
        console.log(`   user_conversion_rate: ${firstServer.user_conversion_rate || 'undefined'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugAPIResponseStructure();

