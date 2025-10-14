// Script to check what servers are configured in your database
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkServers() {
  console.log('🔍 Checking configured servers...\n');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.log('Please update your .env file with:');
    console.log('- SUPABASE_URL=your_supabase_url');
    console.log('- SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
    return;
  }
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Check if affiliate_tracking table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'affiliate_tracking');
    
    if (tableError || !tables || tables.length === 0) {
      console.log('⚠️  affiliate_tracking table not found. Run the database fix first!');
      return;
    }
    
    // Get configured servers
    const { data: servers, error: serverError } = await supabase
      .from('discord_servers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (serverError) {
      console.error('❌ Error fetching servers:', serverError);
      return;
    }
    
    if (!servers || servers.length === 0) {
      console.log('📭 No servers found in database');
      console.log('Configure a server first through your dashboard');
      return;
    }
    
    console.log(`📊 Found ${servers.length} server(s):\n`);
    
    servers.forEach((server, index) => {
      console.log(`${index + 1}. ${server.server_name}`);
      console.log(`   Server ID: ${server.discord_server_id}`);
      console.log(`   Invite Code: ${server.invite_code || 'Not set'}`);
      console.log(`   Owner Discord ID: ${server.owner_discord_id || 'Not set'}`);
      console.log(`   Total Clicks: ${server.total_invite_clicks || 0}`);
      console.log(`   Total Joins: ${server.total_joins || 0}`);
      console.log('');
    });
    
    // Check affiliate tracking records
    const { data: tracking, error: trackingError } = await supabase
      .from('affiliate_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!trackingError && tracking && tracking.length > 0) {
      console.log(`📈 Recent tracking records (last 5):\n`);
      tracking.forEach((record, index) => {
        console.log(`${index + 1}. Invite: ${record.invite_code}`);
        console.log(`   Affiliate: ${record.affiliate_id || 'Direct'}`);
        console.log(`   Status: ${record.conversion_status}`);
        console.log(`   Clicked: ${record.click_timestamp}`);
        console.log(`   Joined: ${record.join_timestamp || 'Not yet'}`);
        console.log('');
      });
    } else {
      console.log('📭 No affiliate tracking records found yet');
    }
    
    // Show test URLs
    if (servers.length > 0) {
      console.log('🧪 Test URLs for click tracking:\n');
      servers.forEach((server, index) => {
        if (server.invite_code && server.owner_discord_id) {
          const testUrl = `http://localhost:3000/invite/${server.invite_code}?affiliate=${server.owner_discord_id}`;
          console.log(`${index + 1}. ${testUrl}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkServers();
