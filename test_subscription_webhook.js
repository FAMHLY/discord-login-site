// Test script to manually trigger subscription webhook for existing subscription
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleSubscriptionCreated, updateServerConversionRate } = require('./api/stripe');
const { handleSubscriptionChange } = require('./role-manager');

async function testSubscriptionWebhook() {
  try {
    console.log('🔍 Looking for existing subscriptions...');
    
    // List recent subscriptions
    const subscriptions = await stripe.subscriptions.list({
      limit: 10,
      expand: ['data.customer']
    });
    
    console.log(`Found ${subscriptions.data.length} recent subscriptions:`);
    
    for (const subscription of subscriptions.data) {
      console.log(`- ${subscription.id}: ${subscription.status} (Customer: ${subscription.customer.id})`);
      
      // Check if this subscription has Discord server metadata
      if (subscription.metadata?.discord_server_id) {
        console.log(`  📍 Discord Server: ${subscription.metadata.discord_server_id}`);
        
        // Get customer metadata
        const customer = subscription.customer;
        const discordUserId = customer.metadata?.discord_user_id;
        console.log(`  👤 Discord User ID: ${discordUserId}`);
        
        if (discordUserId) {
          console.log(`  🔄 Triggering subscription created webhook...`);
          
          // Manually trigger the subscription created handler
          await handleSubscriptionCreated(subscription);
          
          // Update conversion rate
          await updateServerConversionRate(subscription.metadata.discord_server_id);
          
          // Update Discord roles
          await handleSubscriptionChange(
            subscription.customer.id,
            subscription.metadata.discord_server_id,
            subscription.status
          );
          
          console.log(`  ✅ Webhook triggered for subscription ${subscription.id}`);
        } else {
          console.log(`  ⚠️ No Discord user ID found in customer metadata`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error testing subscription webhook:', error);
  }
}

testSubscriptionWebhook();

