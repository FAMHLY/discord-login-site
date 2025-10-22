// Test script to manually test subscription cancellation
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

async function testCancelSubscription() {
  try {
    console.log('🧪 Testing subscription cancellation...\n');
    
    // Get recent subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      limit: 10,
      status: 'active'
    });
    
    console.log(`Found ${subscriptions.data.length} active subscriptions in Stripe:`);
    
    for (const subscription of subscriptions.data) {
      console.log(`\n📋 Subscription: ${subscription.id}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Customer: ${subscription.customer}`);
      console.log(`   Server ID: ${subscription.metadata?.discord_server_id}`);
      
      if (subscription.metadata?.discord_server_id) {
        // Check database status
        if (supabase) {
          const { data: dbSub, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          
          if (error) {
            console.log(`   ❌ Not found in database: ${error.message}`);
          } else {
            console.log(`   📊 Database status: ${dbSub.status}`);
            console.log(`   📊 Database cancelled_at: ${dbSub.cancelled_at}`);
          }
        }
      }
    }
    
    // Check for recently cancelled subscriptions
    console.log('\n🔍 Checking for recently cancelled subscriptions...');
    const cancelledSubscriptions = await stripe.subscriptions.list({
      limit: 10,
      status: 'canceled'
    });
    
    console.log(`Found ${cancelledSubscriptions.data.length} cancelled subscriptions in Stripe:`);
    
    for (const subscription of cancelledSubscriptions.data.slice(0, 3)) { // Show only first 3
      console.log(`\n📋 Cancelled Subscription: ${subscription.id}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Cancelled at: ${new Date(subscription.canceled_at * 1000).toLocaleString()}`);
      console.log(`   Server ID: ${subscription.metadata?.discord_server_id}`);
      
      // Check database status
      if (supabase) {
        const { data: dbSub, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();
        
        if (error) {
          console.log(`   ❌ Not found in database: ${error.message}`);
        } else {
          console.log(`   📊 Database status: ${dbSub.status}`);
          console.log(`   📊 Database cancelled_at: ${dbSub.cancelled_at}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testManualCancellation() {
  try {
    console.log('\n🧪 Testing manual cancellation...\n');
    
    // Get a test subscription (you can specify a subscription ID here)
    const testSubscriptionId = 'sub_1SL9xwFSRfDsx8GKYxg0QhkV'; // Replace with actual subscription ID
    
    console.log(`Testing cancellation of: ${testSubscriptionId}`);
    
    // Check current status
    const subscription = await stripe.subscriptions.retrieve(testSubscriptionId);
    console.log(`Current status: ${subscription.status}`);
    
    if (subscription.status === 'active') {
      console.log('Subscription is active, would cancel it...');
      // Uncomment the next line to actually cancel
      // const cancelled = await stripe.subscriptions.cancel(testSubscriptionId);
      // console.log(`Cancelled: ${cancelled.status}`);
    } else {
      console.log(`Subscription is already ${subscription.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing manual cancellation:', error.message);
  }
}

async function main() {
  console.log('🚀 Subscription Cancellation Test\n');
  
  await testCancelSubscription();
  await testManualCancellation();
}

main().catch(console.error);
