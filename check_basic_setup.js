// Basic setup check - doesn't require affiliate_tracking table
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkBasicSetup() {
  console.log('🔍 Checking Basic Setup...\n');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials');
    return;
  }
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Check if basic tables exist
    console.log('📋 Checking database tables...');
    
    // Check discord_servers table
    const { data: servers, error: serverError } = await supabase
      .from('discord_servers')
      .select('*')
      .limit(5);
    
    if (serverError) {
      console.error('❌ Error accessing discord_servers table:', serverError.message);
      console.log('You may need to run the basic database schema first');
      return;
    }
    
    console.log(`✅ discord_servers table exists`);
    console.log(`📊 Found ${servers ? servers.length : 0} configured servers`);
    
    if (servers && servers.length > 0) {
      console.log('\n📋 Configured servers:');
      servers.forEach((server, index) => {
        console.log(`${index + 1}. ${server.server_name}`);
        console.log(`   - Server ID: ${server.discord_server_id}`);
        console.log(`   - Invite Code: ${server.invite_code || 'Not set'}`);
        console.log(`   - Owner Discord ID: ${server.owner_discord_id || 'Not set'}`);
        console.log('');
      });
      
      // Check if any have valid invite codes
      const serversWithInvites = servers.filter(s => s.invite_code);
      console.log(`✅ ${serversWithInvites.length} servers have invite codes`);
      
      if (serversWithInvites.length === 0) {
        console.log('\n⚠️  No servers have invite codes configured');
        console.log('You need to configure a server through your dashboard first');
      }
      
    } else {
      console.log('\n📭 No servers configured yet');
      console.log('You need to:');
      console.log('1. Log into your dashboard');
      console.log('2. Configure a Discord server');
      console.log('3. Generate an invite code');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBasicSetup();
