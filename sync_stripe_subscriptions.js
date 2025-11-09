// Sync Stripe subscription statuses into Supabase
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleSubscriptionUpdated } = require('./api/stripe');

async function syncSubscriptions() {
  try {
    console.log('🔄 Fetching subscriptions from Stripe...');
    
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY environment variable is required');
      process.exit(1);
    }

    const subscriptions = await stripe.subscriptions.list({
      status: 'all',
      limit: 100
    });

    console.log(`📦 Retrieved ${subscriptions.data.length} subscription(s) from Stripe`);

    for (const subscription of subscriptions.data) {
      console.log(`\n📝 Syncing subscription ${subscription.id} (${subscription.status})`);
      await handleSubscriptionUpdated(subscription);
    }

    console.log('\n✅ Sync complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to sync subscriptions:', error);
    process.exit(1);
  }
}

syncSubscriptions();

