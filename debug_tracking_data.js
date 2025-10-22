// Debug script to check the current tracking data and affiliate IDs
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTrackingData() {
  try {
    console.log('🔍 Debugging tracking data...\n');
    
    // Check current affiliate tracking data
    console.log('📊 Current affiliate tracking records:');
    const { data: trackingRecords, error: trackingError } = await supabase
      .from('affiliate_tracking')
      .select('*')
      .eq('discord_server_id', '831000377863176233')
      .order('created_at', { ascending: false });
    
    if (trackingError) {
      console.error('❌ Error fetching tracking records:', trackingError);
      return;
    }
    
    console.log(`Found ${trackingRecords.length} tracking records:`);
    trackingRecords.forEach((record, index) => {
      console.log(`\n${index + 1}. Record ID: ${record.id}`);
      console.log(`   Discord Server ID: ${record.discord_server_id}`);
      console.log(`   Affiliate ID: ${record.affiliate_id || 'NULL'}`);
      console.log(`   Invite Code: ${record.invite_code}`);
      console.log(`   Conversion Status: ${record.conversion_status}`);
      console.log(`   Click Timestamp: ${new Date(record.click_timestamp).toLocaleString()}`);
      console.log(`   Join Timestamp: ${record.join_timestamp ? new Date(record.join_timestamp).toLocaleString() : 'Not joined'}`);
    });
    
    // Check current discord_servers data
    console.log('\n📊 Current discord_servers records:');
    const { data: serverRecords, error: serverError } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('discord_server_id', '831000377863176233');
    
    if (serverError) {
      console.error('❌ Error fetching server records:', serverError);
      return;
    }
    
    console.log(`Found ${serverRecords.length} server records:`);
    serverRecords.forEach((server, index) => {
      console.log(`\n${index + 1}. Server Record ID: ${server.id}`);
      console.log(`   Discord Server ID: ${server.discord_server_id}`);
      console.log(`   Owner ID: ${server.owner_id}`);
      console.log(`   Owner Discord ID: ${server.owner_discord_id}`);
      console.log(`   User Total Invite Clicks: ${server.user_total_invite_clicks || 0}`);
      console.log(`   User Total Joins: ${server.user_total_joins || 0}`);
      console.log(`   User Conversion Rate: ${server.user_conversion_rate || 0}%`);
      console.log(`   User Monthly Revenue: $${server.user_monthly_revenue || '0.00'}`);
    });
    
    // Check subscriptions data
    console.log('\n📊 Current subscriptions records:');
    const { data: subscriptionRecords, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('discord_server_id', '831000377863176233');
    
    if (subError) {
      console.error('❌ Error fetching subscription records:', subError);
      return;
    }
    
    console.log(`Found ${subscriptionRecords.length} subscription records:`);
    subscriptionRecords.forEach((sub, index) => {
      console.log(`\n${index + 1}. Subscription ID: ${sub.stripe_subscription_id}`);
      console.log(`   Discord Server ID: ${sub.discord_server_id}`);
      console.log(`   Discord User ID: ${sub.discord_user_id}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Created: ${new Date(sub.created_at).toLocaleString()}`);
    });
    
    // Test the calculation function
    console.log('\n🧪 Testing user-specific stats calculation:');
    
    // Test for User 1 (should have 26 clicks, 2 joins)
    console.log('\n--- User 1 Stats ---');
    const { data: user1Stats, error: user1Error } = await supabase
      .rpc('calculate_user_server_stats', {
        p_discord_server_id: '831000377863176233',
        p_owner_discord_id: '210250076281372673'  // User 1's Discord ID
      });
    
    if (user1Error) {
      console.error('❌ Error calculating User 1 stats:', user1Error);
    } else {
      console.log('User 1 stats:', user1Stats);
    }
    
    // Test for User 2 (should have 0 clicks, 0 joins)
    console.log('\n--- User 2 Stats ---');
    const { data: user2Stats, error: user2Error } = await supabase
      .rpc('calculate_user_server_stats', {
        p_discord_server_id: '831000377863176233',
        p_owner_discord_id: '1428239995763822592'  // User 2's Discord ID
      });
    
    if (user2Error) {
      console.error('❌ Error calculating User 2 stats:', user2Error);
    } else {
      console.log('User 2 stats:', user2Stats);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugTrackingData();
