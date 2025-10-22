// Test subscription creation with the correct server ID
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testCorrectSubscription() {
  try {
    console.log('🧪 Testing subscription creation with correct server ID...\n');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Use the actual server ID from the database
    const correctServerId = '831000377863176233';
    
    // Test data using a real subscription ID from Stripe
    const testSubscription = {
      stripe_subscription_id: 'sub_1SL9xwFSRfDsx8GKYxg0QhkV', // Real subscription ID from Stripe
      stripe_customer_id: 'cus_THjH0EB3uEVFn2', // Real customer ID from Stripe
      discord_server_id: correctServerId, // Correct server ID
      discord_user_id: '123456789012345678', // We'll need to get this from customer metadata
      status: 'active',
      price_id: 'price_test_123',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        discord_server_id: correctServerId,
        discord_server_name: 'FAMHLY RE-UNION'
      }
    };
    
    console.log('Inserting subscription with correct server ID:', correctServerId);
    
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
    
    // Check if it was actually inserted
    const { data: insertedSub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', testSubscription.stripe_subscription_id);
    
    if (fetchError) {
      console.error('❌ Error fetching inserted subscription:', fetchError);
    } else {
      console.log('✅ Subscription confirmed in database:', insertedSub);
    }
    
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
  console.log('🚀 Testing Subscription Creation with Correct Server ID\n');
  
  const success = await testCorrectSubscription();
  
  if (success) {
    console.log('\n✅ Database insertion works with correct server ID!');
    console.log('\n🔍 The issue is likely:');
    console.log('1. Webhook not being called by Vercel');
    console.log('2. Webhook signature verification failing');
    console.log('3. Error in webhook processing');
    console.log('\n💡 Next steps:');
    console.log('1. Check Vercel function logs');
    console.log('2. Check Stripe webhook delivery logs');
    console.log('3. Test webhook endpoint directly');
  } else {
    console.log('\n❌ Database insertion still failed. Check the error above.');
  }
}

main().catch(console.error);
