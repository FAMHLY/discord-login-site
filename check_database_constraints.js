// Check current database constraints to understand the structure
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseConstraints() {
  try {
    console.log('🔍 Checking current database constraints...\n');
    
    // Check constraints on discord_servers table
    console.log('📋 Constraints on discord_servers table:');
    const { data: serverConstraints, error: serverError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            conname as constraint_name,
            contype as constraint_type,
            confrelid::regclass as referenced_table
          FROM pg_constraint 
          WHERE conrelid = 'discord_servers'::regclass
          ORDER BY conname;
        `
      });
    
    if (serverError) {
      console.error('❌ Error checking server constraints:', serverError);
    } else {
      console.log('Server constraints:', serverConstraints);
    }
    
    // Check constraints on subscriptions table
    console.log('\n📋 Constraints on subscriptions table:');
    const { data: subConstraints, error: subError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            conname as constraint_name,
            contype as constraint_type,
            confrelid::regclass as referenced_table
          FROM pg_constraint 
          WHERE conrelid = 'subscriptions'::regclass
          ORDER BY conname;
        `
      });
    
    if (subError) {
      console.error('❌ Error checking subscription constraints:', subError);
    } else {
      console.log('Subscription constraints:', subConstraints);
    }
    
    // Check indexes
    console.log('\n📋 Indexes on discord_servers table:');
    const { data: indexes, error: indexError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes 
          WHERE tablename = 'discord_servers'
          ORDER BY indexname;
        `
      });
    
    if (indexError) {
      console.error('❌ Error checking indexes:', indexError);
    } else {
      console.log('Indexes:', indexes);
    }
    
    // Check current data
    console.log('\n📊 Current data in discord_servers:');
    const { data: servers, error: dataError } = await supabase
      .from('discord_servers')
      .select('*');
    
    if (dataError) {
      console.error('❌ Error fetching server data:', dataError);
    } else {
      console.log(`Found ${servers.length} servers:`);
      servers.forEach(server => {
        console.log(`  - ${server.discord_server_id} (owner: ${server.owner_id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Alternative: You can run this SQL directly in your Supabase SQL Editor:');
    console.log(`
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  confrelid::regclass as referenced_table
FROM pg_constraint 
WHERE conrelid = 'discord_servers'::regclass
ORDER BY conname;
    `);
  }
}

checkDatabaseConstraints();
