// Manual test to create a subscription record in Supabase
// This bypasses Stripe webhooks to test if the database insertion works
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testSubscriptionCreation() {
  console.log('🧪 Testing manual subscription creation...\n');
  
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test data
    const testSubscription = {
      stripe_subscription_id: 'sub_test_' + Date.now(),
      stripe_customer_id: 'cus_test_' + Date.now(),
      discord_server_id: '123456789012345678', // Replace with a real server ID
      discord_user_id: '987654321098765432', // Replace with a real user ID
      status: 'active',
      price_id: 'price_test_123',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      metadata: {
        test: true,
        discord_server_id: '123456789012345678'
      }
    };
    
    console.log('Inserting test subscription:', testSubscription.stripe_subscription_id);
    
    // Insert test subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(testSubscription)
      .select();
    
    if (error) {
      console.error('❌ Error inserting subscription:', error);
      return false;
    }
    
    console.log('✅ Test subscription created successfully!');
    console.log('Data:', data);
    
    // Clean up - delete the test subscription
    const { error: deleteError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('stripe_subscription_id', testSubscription.stripe_subscription_id);
    
    if (deleteError) {
      console.log('⚠️  Could not clean up test subscription:', deleteError.message);
    } else {
      console.log('🧹 Test subscription cleaned up');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Manual Subscription Creation Test\n');
  
  // Check environment variables
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your_')) {
    console.log('❌ Invalid Supabase URL in .env file');
    console.log('Please update your .env file with real Supabase credentials');
    return;
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_')) {
    console.log('❌ Invalid Supabase service role key in .env file');
    console.log('Please update your .env file with real Supabase credentials');
    return;
  }
  
  const success = await testSubscriptionCreation();
  
  if (success) {
    console.log('\n✅ Database insertion works! The issue is likely with:');
    console.log('1. Webhook endpoint not receiving events from Stripe');
    console.log('2. Webhook signature verification failing');
    console.log('3. Environment variables not set correctly in Vercel');
  } else {
    console.log('\n❌ Database insertion failed. Check:');
    console.log('1. Supabase credentials');
    console.log('2. Subscriptions table exists');
    console.log('3. Database permissions');
  }
}

main().catch(console.error);
