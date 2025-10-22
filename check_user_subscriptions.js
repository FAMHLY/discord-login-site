// Check user's subscriptions to see which ones are active/cancelled
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

async function checkUserSubscriptions() {
  try {
    console.log('🔍 Checking all subscriptions in database...\n');
    
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    // Get all subscriptions
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching subscriptions:', error);
      return;
    }
    
    console.log(`📊 Found ${subscriptions.length} total subscriptions:\n`);
    
    // Group by status
    const activeSubs = subscriptions.filter(sub => sub.status === 'active');
    const cancelledSubs = subscriptions.filter(sub => sub.status === 'cancelled');
    
    console.log(`🟢 Active subscriptions (${activeSubs.length}):`);
    activeSubs.forEach(sub => {
      console.log(`  - ${sub.stripe_subscription_id}`);
      console.log(`    Customer: ${sub.stripe_customer_id}`);
      console.log(`    Server: ${sub.discord_server_id}`);
      console.log(`    Created: ${new Date(sub.created_at).toLocaleString()}`);
      console.log(`    Period: ${new Date(sub.current_period_start).toLocaleDateString()} - ${new Date(sub.current_period_end).toLocaleDateString()}`);
      console.log('');
    });
    
    console.log(`🔴 Cancelled subscriptions (${cancelledSubs.length}):`);
    cancelledSubs.forEach(sub => {
      console.log(`  - ${sub.stripe_subscription_id}`);
      console.log(`    Customer: ${sub.stripe_customer_id}`);
      console.log(`    Server: ${sub.discord_server_id}`);
      console.log(`    Created: ${new Date(sub.created_at).toLocaleString()}`);
      console.log(`    Cancelled: ${new Date(sub.cancelled_at).toLocaleString()}`);
      console.log('');
    });
    
    // Check for multiple subscriptions per customer
    const customerGroups = {};
    subscriptions.forEach(sub => {
      if (!customerGroups[sub.stripe_customer_id]) {
        customerGroups[sub.stripe_customer_id] = [];
      }
      customerGroups[sub.stripe_customer_id].push(sub);
    });
    
    console.log('👥 Subscriptions by customer:');
    Object.entries(customerGroups).forEach(([customerId, subs]) => {
      console.log(`\n  Customer: ${customerId}`);
      subs.forEach(sub => {
        console.log(`    - ${sub.stripe_subscription_id} (${sub.status})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUserSubscriptions();
