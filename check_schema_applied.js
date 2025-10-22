// Check if the user-specific tracking schema was applied
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchemaApplied() {
  try {
    console.log('🔍 Checking if user-specific tracking schema was applied...\n');
    
    // Check if the user-specific columns exist
    const { data: serverData, error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('discord_server_id', '831000377863176233')
      .limit(1)
      .single();
    
    if (error) {
      console.error('❌ Error fetching server data:', error);
      return;
    }
    
    console.log('📊 Server record columns:');
    console.log('Available columns:', Object.keys(serverData));
    
    // Check for user-specific columns
    const userSpecificColumns = [
      'user_total_invite_clicks',
      'user_total_joins', 
      'user_conversion_rate',
      'user_paid_conversion_rate',
      'user_monthly_revenue'
    ];
    
    console.log('\n🔍 Checking for user-specific columns:');
    userSpecificColumns.forEach(column => {
      const exists = column in serverData;
      const value = serverData[column];
      console.log(`  ${column}: ${exists ? `✅ (${value})` : '❌ Missing'}`);
    });
    
    // If columns are missing, we need to apply the schema
    const missingColumns = userSpecificColumns.filter(col => !(col in serverData));
    
    if (missingColumns.length > 0) {
      console.log('\n⚠️  Missing columns detected. You need to apply the database schema.');
      console.log('Run the SQL from fix_user_specific_tracking.sql in your Supabase SQL Editor.');
    } else {
      console.log('\n✅ All user-specific columns exist!');
      
      // Test the stats calculation for both users
      console.log('\n🧪 Testing stats calculation:');
      
      const { data: user1Stats, error: user1Error } = await supabase
        .rpc('calculate_user_server_stats', {
          p_discord_server_id: '831000377863176233',
          p_owner_discord_id: '210250076281372673'
        });
      
      if (user1Error) {
        console.error('❌ Error calculating User 1 stats:', user1Error);
      } else {
        console.log('User 1 stats:', user1Stats[0]);
      }
      
      // Update User 1's stats
      console.log('\n🔄 Updating User 1 stats...');
      const { error: updateError } = await supabase
        .rpc('update_user_server_stats', {
          p_discord_server_id: '831000377863176233',
          p_owner_discord_id: '210250076281372673'
        });
      
      if (updateError) {
        console.error('❌ Error updating User 1 stats:', updateError);
      } else {
        console.log('✅ User 1 stats updated successfully!');
      }
      
      // Update User 2's stats
      console.log('\n🔄 Updating User 2 stats...');
      const { error: updateError2 } = await supabase
        .rpc('update_user_server_stats', {
          p_discord_server_id: '831000377863176233',
          p_owner_discord_id: '1428239995763822592'
        });
      
      if (updateError2) {
        console.error('❌ Error updating User 2 stats:', updateError2);
      } else {
        console.log('✅ User 2 stats updated successfully!');
      }
      
      // Check the updated data
      console.log('\n📊 Updated server records:');
      const { data: updatedServers, error: fetchError } = await supabase
        .from('discord_servers')
        .select('*')
        .eq('discord_server_id', '831000377863176233');
      
      if (!fetchError && updatedServers) {
        updatedServers.forEach((server, index) => {
          console.log(`\n${index + 1}. Owner Discord ID: ${server.owner_discord_id}`);
          console.log(`   User Total Invite Clicks: ${server.user_total_invite_clicks || 0}`);
          console.log(`   User Total Joins: ${server.user_total_joins || 0}`);
          console.log(`   User Conversion Rate: ${server.user_conversion_rate || 0}%`);
          console.log(`   User Monthly Revenue: $${server.user_monthly_revenue || '0.00'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchemaApplied();
