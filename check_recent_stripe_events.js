// Check recent Stripe events and subscription status
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkRecentEvents() {
  try {
    console.log('🔍 Checking recent Stripe events...\n');
    
    // Get recent events
    const events = await stripe.events.list({ 
      limit: 10,
      types: ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated']
    });
    
    console.log(`📊 Found ${events.data.length} recent events:\n`);
    
    for (const event of events.data) {
      console.log(`Event: ${event.type}`);
      console.log(`ID: ${event.id}`);
      console.log(`Created: ${new Date(event.created * 1000).toLocaleString()}`);
      
      const obj = event.data.object;
      
      if (event.type === 'checkout.session.completed') {
        console.log(`Session ID: ${obj.id}`);
        console.log(`Customer: ${obj.customer}`);
        console.log(`Subscription: ${obj.subscription || 'None'}`);
        console.log(`Metadata:`, obj.metadata);
      } else if (event.type.includes('subscription')) {
        console.log(`Subscription ID: ${obj.id}`);
        console.log(`Customer: ${obj.customer}`);
        console.log(`Status: ${obj.status}`);
        console.log(`Metadata:`, obj.metadata);
      }
      
      console.log('---');
    }
    
    // Check current subscription status
    console.log('\n🔍 Checking current subscription status...\n');
    
    const subscriptions = await stripe.subscriptions.list({
      limit: 10,
      expand: ['data.customer']
    });
    
    console.log(`📊 Found ${subscriptions.data.length} subscriptions:\n`);
    
    for (const subscription of subscriptions.data) {
      console.log(`Subscription: ${subscription.id}`);
      console.log(`Status: ${subscription.status}`);
      console.log(`Customer: ${subscription.customer.id}`);
      console.log(`Server ID: ${subscription.metadata?.discord_server_id}`);
      console.log(`Created: ${new Date(subscription.created * 1000).toLocaleString()}`);
      console.log(`Current Period: ${new Date(subscription.current_period_start * 1000).toLocaleDateString()} - ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRecentEvents();
