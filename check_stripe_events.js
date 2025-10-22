// Check recent Stripe events to see what server IDs are being used
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function checkStripeEvents() {
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
        console.log(`Metadata:`, obj.metadata);
        if (obj.subscription) {
          console.log(`Subscription ID: ${obj.subscription}`);
        }
      } else if (event.type.includes('subscription')) {
        console.log(`Subscription ID: ${obj.id}`);
        console.log(`Customer: ${obj.customer}`);
        console.log(`Status: ${obj.status}`);
        console.log(`Metadata:`, obj.metadata);
      }
      
      console.log('---');
    }
    
    // Check if any of these events have the correct server ID
    const correctServerId = '831000377863176233';
    console.log(`\n🔍 Looking for server ID: ${correctServerId}`);
    
    const matchingEvents = events.data.filter(event => {
      const obj = event.data.object;
      return obj.metadata?.discord_server_id === correctServerId;
    });
    
    if (matchingEvents.length > 0) {
      console.log(`✅ Found ${matchingEvents.length} events with correct server ID`);
    } else {
      console.log('❌ No events found with correct server ID');
      console.log('   This means the checkout is using a different server ID than what exists in the database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStripeEvents();
