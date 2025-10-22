// Check what's in the discord_servers table
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkDiscordServers() {
  try {
    console.log('🔍 Checking discord_servers table...\n');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Check discord_servers table
    const { data: servers, error: serverError } = await supabase
      .from('discord_servers')
      .select('*')
      .limit(10);
    
    if (serverError) {
      console.error('❌ Error fetching discord_servers:', serverError);
      return;
    }
    
    console.log(`📊 Found ${servers.length} servers in discord_servers table:`);
    
    if (servers.length === 0) {
      console.log('⚠️  No servers found! This is why subscriptions can\'t be created.');
      console.log('   The foreign key constraint requires a server to exist first.');
      console.log('\n💡 Solutions:');
      console.log('1. Add a test server to the discord_servers table');
      console.log('2. Remove the foreign key constraint temporarily');
      console.log('3. Make sure your Discord bot is properly adding servers');
    } else {
      servers.forEach(server => {
        console.log(`  - ${server.discord_server_id}: ${server.server_name || 'Unnamed'}`);
      });
    }
    
    // Check subscriptions table
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*');
    
    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError);
      return;
    }
    
    console.log(`\n📊 Found ${subscriptions.length} subscriptions:`);
    subscriptions.forEach(sub => {
      console.log(`  - ${sub.stripe_subscription_id}: ${sub.status} (Server: ${sub.discord_server_id})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDiscordServers();
