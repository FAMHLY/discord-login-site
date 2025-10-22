// Apply the multiple server owners fix using Supabase client
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMultipleOwnersFix() {
  try {
    console.log('🔧 Applying multiple server owners fix...\n');
    
    // Note: We can't directly modify database constraints using the Supabase client
    // The constraint changes need to be applied directly to the database
    // For now, let's test the current behavior and document what needs to be done
    
    console.log('📋 Database changes needed:');
    console.log('1. Remove unique constraint on discord_server_id');
    console.log('2. Add unique constraint on (owner_id, discord_server_id)');
    console.log('3. Add index for better performance');
    console.log('');
    
    console.log('⚠️  These changes must be applied directly to your Supabase database:');
    console.log('   - Go to your Supabase dashboard');
    console.log('   - Navigate to SQL Editor');
    console.log('   - Run the SQL from fix_multiple_server_owners.sql');
    console.log('');
    
    // Test current behavior
    console.log('🧪 Testing current behavior...');
    
    // Get all servers to see current state
    const { data: servers, error } = await supabase
      .from('discord_servers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching servers:', error);
      return;
    }
    
    console.log(`📊 Found ${servers.length} servers in database:`);
    
    // Group by discord_server_id to see duplicates
    const serverGroups = {};
    servers.forEach(server => {
      if (!serverGroups[server.discord_server_id]) {
        serverGroups[server.discord_server_id] = [];
      }
      serverGroups[server.discord_server_id].push(server);
    });
    
    console.log('\n👥 Servers grouped by Discord server ID:');
    Object.entries(serverGroups).forEach(([discordServerId, serverList]) => {
      console.log(`\n  Discord Server: ${discordServerId}`);
      serverList.forEach(server => {
        console.log(`    - Owner: ${server.owner_id}`);
        console.log(`      Name: ${server.server_name}`);
        console.log(`      Role: ${server.user_role}`);
        console.log(`      Created: ${new Date(server.created_at).toLocaleString()}`);
      });
    });
    
    // Check for duplicate discord_server_ids
    const duplicates = Object.entries(serverGroups).filter(([_, servers]) => servers.length > 1);
    
    if (duplicates.length > 0) {
      console.log(`\n✅ Found ${duplicates.length} servers with multiple owners (this is good!):`);
      duplicates.forEach(([discordServerId, servers]) => {
        console.log(`  - ${discordServerId}: ${servers.length} owners`);
      });
    } else {
      console.log('\n⚠️  No servers with multiple owners found.');
      console.log('   This suggests the unique constraint is still active.');
    }
    
    console.log('\n📝 Next steps:');
    console.log('1. Apply the database schema changes from fix_multiple_server_owners.sql');
    console.log('2. Test adding the same server with different users');
    console.log('3. Verify both users can see and manage the server');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyMultipleOwnersFix();
