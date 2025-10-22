// Test manual subscription creation with the exact data from Stripe
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

async function testManualSubscriptionCreation() {
  try {
    console.log('🧪 Testing manual subscription creation...\n');
    
    // Get the subscription from Stripe
    const subscriptionId = 'sub_1SLAcGFSRfDsx8GKT9DRHgl5';
    console.log(`Fetching subscription: ${subscriptionId}`);
    
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['customer']
    });
    
    console.log('Subscription data from Stripe:');
    console.log(`  ID: ${subscription.id}`);
    console.log(`  Status: ${subscription.status}`);
    console.log(`  Customer: ${subscription.customer.id}`);
    console.log(`  Server ID: ${subscription.metadata?.discord_server_id}`);
    console.log(`  Current Period Start: ${subscription.current_period_start}`);
    console.log(`  Current Period End: ${subscription.current_period_end}`);
    console.log(`  Items: ${subscription.items?.data?.length} items`);
    
    if (subscription.items?.data?.[0]?.price) {
      console.log(`  Price ID: ${subscription.items.data[0].price.id}`);
    }
    
    // Test the handleSubscriptionCreated function
    console.log('\n🔄 Testing handleSubscriptionCreated function...');
    
    // Import the function (we'll simulate it here)
    const serverId = subscription.metadata.discord_server_id;
    const serverName = subscription.metadata.discord_server_name;
    const customerId = subscription.customer;
    
    console.log(`Server ID: ${serverId}`);
    console.log(`Server Name: ${serverName}`);
    console.log(`Customer ID: ${customerId}`);
    
    if (!serverId) {
      console.error('❌ No server ID in subscription metadata');
      return;
    }

    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }

    // Get Discord user ID from customer metadata
    let customer;
    let discordUserId;
    
    if (typeof customerId === 'string') {
      // Customer ID is a string, retrieve the customer
      customer = await stripe.customers.retrieve(customerId);
      discordUserId = customer.metadata?.discord_user_id;
    } else {
      // Customer is already expanded as an object
      customer = customerId;
      discordUserId = customer.metadata?.discord_user_id;
    }
    
    console.log(`Discord User ID: ${discordUserId}`);

    // Prepare subscription data with better error handling
    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof customerId === 'string' ? customerId : customerId.id,
      discord_user_id: discordUserId,
      discord_server_id: serverId,
      status: subscription.status,
      price_id: subscription.items?.data?.[0]?.price?.id,
      metadata: subscription.metadata
    };

    // Handle period dates safely
    if (subscription.current_period_start) {
      try {
        subscriptionData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
        console.log(`Current Period Start: ${subscriptionData.current_period_start}`);
      } catch (error) {
        console.error('Error parsing current_period_start:', error);
        subscriptionData.current_period_start = null;
      }
    }

    if (subscription.current_period_end) {
      try {
        subscriptionData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
        console.log(`Current Period End: ${subscriptionData.current_period_end}`);
      } catch (error) {
        console.error('Error parsing current_period_end:', error);
        subscriptionData.current_period_end = null;
      }
    }

    console.log('\n📊 Subscription data to insert:');
    console.log(JSON.stringify(subscriptionData, null, 2));

    // Check if subscription already exists
    const { data: existingSub, error: checkError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing subscription:', checkError);
      return;
    }
    
    if (existingSub) {
      console.log('⚠️  Subscription already exists in database:');
      console.log(`  Status: ${existingSub.status}`);
      console.log(`  Created: ${existingSub.created_at}`);
      return;
    }

    // Store subscription in database
    console.log('\n💾 Inserting subscription into database...');
    const { error: dbError } = await supabase
      .from('subscriptions')
      .insert(subscriptionData);

    if (dbError) {
      console.error('❌ Error storing subscription:', dbError);
      return;
    }

    console.log('✅ Subscription stored successfully!');
    
    // Verify it was stored
    const { data: storedSub, error: verifyError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying stored subscription:', verifyError);
    } else {
      console.log('✅ Verification successful:');
      console.log(`  Database ID: ${storedSub.id}`);
      console.log(`  Status: ${storedSub.status}`);
      console.log(`  Created: ${storedSub.created_at}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testManualSubscriptionCreation();