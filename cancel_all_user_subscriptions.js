// Script to cancel all active subscriptions for a specific user
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

async function cancelAllUserSubscriptions(customerId) {
  try {
    console.log(`🔍 Finding all active subscriptions for customer: ${customerId}\n`);
    
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    // Get all active subscriptions for this customer
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .eq('status', 'active');
    
    if (error) {
      console.error('❌ Error fetching subscriptions:', error);
      return;
    }
    
    console.log(`📊 Found ${subscriptions.length} active subscriptions to cancel:\n`);
    
    for (const subscription of subscriptions) {
      console.log(`🔄 Cancelling subscription: ${subscription.stripe_subscription_id}`);
      console.log(`   Server: ${subscription.discord_server_id}`);
      console.log(`   Created: ${new Date(subscription.created_at).toLocaleString()}`);
      
      try {
        // Cancel in Stripe
        const cancelledSubscription = await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        console.log(`   ✅ Cancelled in Stripe: ${cancelledSubscription.status}`);
        
        // Update in database
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.stripe_subscription_id);
        
        if (updateError) {
          console.error(`   ❌ Error updating database:`, updateError);
        } else {
          console.log(`   ✅ Updated in database`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error cancelling ${subscription.stripe_subscription_id}:`, error.message);
      }
      
      console.log('');
    }
    
    console.log('✅ Cancellation process completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Cancel All User Subscriptions\n');
  
  // You can specify the customer ID here
  // Replace with your actual customer ID
  const customerId = 'cus_THjH0EB3uEVFn2'; // This appears to be your customer ID
  
  console.log(`Target customer: ${customerId}`);
  console.log('This will cancel ALL active subscriptions for this customer.\n');
  
  // Uncomment the next line to actually cancel subscriptions
  // await cancelAllUserSubscriptions(customerId);
  
  console.log('⚠️  To actually cancel subscriptions, uncomment the line in the script.');
  console.log('⚠️  Make sure you want to cancel ALL subscriptions for this customer.');
}

main().catch(console.error);
