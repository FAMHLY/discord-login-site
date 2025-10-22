// Script to handle refunded transactions and update subscription status
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

async function handleRefundedTransactions() {
  try {
    console.log('🔍 Checking for refunded transactions...\n');
    
    // Get recent refunds from Stripe
    const refunds = await stripe.refunds.list({
      limit: 50,
      expand: ['data.charge', 'data.charge.invoice', 'data.charge.invoice.subscription']
    });
    
    console.log(`Found ${refunds.data.length} recent refunds`);
    
    for (const refund of refunds.data) {
      console.log(`\n📋 Processing refund: ${refund.id}`);
      console.log(`   Amount: $${(refund.amount / 100).toFixed(2)}`);
      console.log(`   Status: ${refund.status}`);
      console.log(`   Reason: ${refund.reason || 'No reason provided'}`);
      
      // Get the charge and subscription
      const charge = refund.charge;
      if (charge && charge.invoice && charge.invoice.subscription) {
        const subscription = charge.invoice.subscription;
        console.log(`   Subscription: ${subscription.id}`);
        console.log(`   Subscription Status: ${subscription.status}`);
        
        // Update subscription status in database
        if (supabase) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              metadata: {
                ...subscription.metadata,
                refund_id: refund.id,
                refund_reason: refund.reason,
                refund_amount: refund.amount
              }
            })
            .eq('stripe_subscription_id', subscription.id);
          
          if (updateError) {
            console.error(`   ❌ Error updating subscription ${subscription.id}:`, updateError);
          } else {
            console.log(`   ✅ Updated subscription ${subscription.id} to cancelled`);
          }
        }
      } else {
        console.log(`   ⚠️  No subscription found for this refund`);
      }
    }
    
    console.log('\n✅ Refund processing completed');
    
  } catch (error) {
    console.error('❌ Error processing refunds:', error);
  }
}

async function cancelSpecificSubscriptions() {
  try {
    console.log('🔍 Manually cancelling specific subscriptions...\n');
    
    // List of subscription IDs to cancel (add your refunded subscription IDs here)
    const subscriptionIdsToCancel = [
      // Add subscription IDs here, for example:
      // 'sub_1SL9xwFSRfDsx8GKYxg0QhkV',
      // 'sub_1SL9pMFSRfDsx8GKWC9Irc2z',
    ];
    
    if (subscriptionIdsToCancel.length === 0) {
      console.log('No subscription IDs specified for cancellation');
      return;
    }
    
    for (const subscriptionId of subscriptionIdsToCancel) {
      console.log(`\n📋 Cancelling subscription: ${subscriptionId}`);
      
      try {
        // Cancel in Stripe
        const cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
        console.log(`   ✅ Cancelled in Stripe: ${cancelledSubscription.status}`);
        
        // Update in database
        if (supabase) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', subscriptionId);
          
          if (updateError) {
            console.error(`   ❌ Error updating database:`, updateError);
          } else {
            console.log(`   ✅ Updated in database`);
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Error cancelling ${subscriptionId}:`, error.message);
      }
    }
    
    console.log('\n✅ Manual cancellation completed');
    
  } catch (error) {
    console.error('❌ Error in manual cancellation:', error);
  }
}

async function main() {
  console.log('🚀 Subscription Management Script\n');
  
  // Check if we should process refunds or manually cancel subscriptions
  const args = process.argv.slice(2);
  
  if (args.includes('--refunds')) {
    await handleRefundedTransactions();
  } else if (args.includes('--cancel')) {
    await cancelSpecificSubscriptions();
  } else {
    console.log('Usage:');
    console.log('  node handle_refunded_transactions.js --refunds    # Process refunded transactions');
    console.log('  node handle_refunded_transactions.js --cancel     # Manually cancel specific subscriptions');
    console.log('\nTo manually cancel subscriptions, edit the script and add subscription IDs to the array.');
  }
}

main().catch(console.error);
