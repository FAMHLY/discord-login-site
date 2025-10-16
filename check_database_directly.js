// Check database directly to see what's there
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkDatabaseDirectly() {
  console.log('🗄️ Checking Database Directly...\n');
  
  console.log('Using Supabase URL:', process.env.SUPABASE_URL);
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Check if affiliate_tracking table exists
    console.log('1. Checking if affiliate_tracking table exists...');
    const { data: trackingData, error: trackingError } = await supabase
      .from('affiliate_tracking')
      .select('count')
      .limit(1);
    
    if (trackingError) {
      console.log('❌ affiliate_tracking table does not exist or has errors');
      console.log('Error:', trackingError.message);
    } else {
      console.log('✅ affiliate_tracking table exists and is accessible');
    }
    
    // Check discord_servers table
    console.log('\n2. Checking discord_servers table...');
    const { data: serversData, error: serversError } = await supabase
      .from('discord_servers')
      .select('*');
    
    if (serversError) {
      console.log('❌ discord_servers table error:', serversError.message);
    } else {
      console.log('✅ discord_servers table is accessible');
      console.log(`📊 Found ${serversData.length} servers:`);
      
      serversData.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.server_name}`);
        console.log(`      - ID: ${server.discord_server_id}`);
        console.log(`      - Invite Code: ${server.invite_code || 'None'}`);
        console.log(`      - Owner ID: ${server.owner_discord_id || 'None'}`);
        console.log('');
      });
      
      // Check if our specific invite code exists
      const targetInviteCode = 'e04f5002e99e3397';
      const serverWithInvite = serversData.find(s => s.invite_code === targetInviteCode);
      
      if (serverWithInvite) {
        console.log(`✅ Found server with invite code ${targetInviteCode}:`);
        console.log(`   - Server: ${serverWithInvite.server_name}`);
        console.log(`   - Owner: ${serverWithInvite.owner_discord_id}`);
      } else {
        console.log(`❌ No server found with invite code ${targetInviteCode}`);
        console.log('Available invite codes:');
        serversData.forEach(s => {
          if (s.invite_code) {
            console.log(`   - ${s.invite_code}`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  }
}

checkDatabaseDirectly();
