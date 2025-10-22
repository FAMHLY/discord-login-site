// Test the API with authentication to see what it actually returns
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testAPIWithAuth() {
  try {
    console.log('🔍 Testing API with authentication...\n');
    
    // Since we can't simulate the exact authentication flow,
    // let's test what the API query would return by running it directly
    
    console.log('📊 Testing the exact query the API makes...\n');
    
    // This simulates what the API does:
    // 1. Get user from auth
    // 2. Get Discord user ID from metadata
    // 3. Query servers by owner_id
    
    // For User 1 (Supabase ID: 40fdf86f-d24e-404d-a8b2-d4c78e8fa584)
    console.log('Testing User 1 query:');
    const { data: user1Servers, error: user1Error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('owner_id', '40fdf86f-d24e-404d-a8b2-d4c78e8fa584');
    
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
        console.log(`   --- DEBUG INFO ---`);
        console.log(`   Server ID: ${server.id}`);
        console.log(`   Owner ID: ${server.owner_id}`);
        console.log(`   Owner Discord ID: ${server.owner_discord_id}`);
        console.log(`   Invite Code: ${server.invite_code}`);
      });
    }
    
    // Check if the API response structure matches what the frontend expects
    console.log('\n📱 API Response Structure:');
    if (user1Servers && user1Servers.length > 0) {
      const server = user1Servers[0];
      console.log('Available properties in API response:');
      Object.keys(server).forEach(key => {
        console.log(`   ${key}: ${server[key]}`);
      });
      
      // Check if the user-specific columns are present
      const userSpecificColumns = [
        'user_total_invite_clicks',
        'user_total_joins',
        'user_conversion_rate',
        'user_paid_conversion_rate',
        'user_monthly_revenue'
      ];
      
      console.log('\n🔍 User-specific columns check:');
      userSpecificColumns.forEach(column => {
        const exists = column in server;
        const value = server[column];
        console.log(`   ${column}: ${exists ? `✅ (${value})` : '❌ Missing'}`);
      });
    }
    
    // Test if there's a caching issue by checking the data freshness
    console.log('\n⏰ Data freshness check:');
    if (user1Servers && user1Servers.length > 0) {
      const server = user1Servers[0];
      console.log(`   Updated at: ${server.updated_at}`);
      console.log(`   Current time: ${new Date().toISOString()}`);
      
      const updatedTime = new Date(server.updated_at);
      const currentTime = new Date();
      const timeDiff = currentTime - updatedTime;
      
      console.log(`   Time difference: ${Math.round(timeDiff / 1000)} seconds ago`);
      
      if (timeDiff > 300000) { // 5 minutes
        console.log('   ⚠️  Data might be stale (older than 5 minutes)');
      } else {
        console.log('   ✅ Data is fresh');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPIWithAuth();
