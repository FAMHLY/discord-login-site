// Stripe integration for Discord monetization
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with error handling
let supabase = null;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabase environment variables not found - Stripe integration will be limited');
  } else {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized for Stripe integration');
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

// Standardized role names
const PAID_ROLE_NAME = '🟢 Paid Member';
const FREE_ROLE_NAME = '🔴 Free Member';

/**
 * Create a Stripe Checkout Session for Discord server subscription
 */
async function createCheckoutSession(customerId, serverId, serverName, priceId, successUrl, cancelUrl) {
  try {
    console.log(`Creating checkout session for server: ${serverId}`);
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        discord_server_id: serverId,
        discord_server_name: serverName,
      },
      subscription_data: {
        metadata: {
          discord_server_id: serverId,
          discord_server_name: serverName,
        },
      },
    });

    console.log(`✅ Created checkout session: ${session.id}`);
    return {
      success: true,
      sessionId: session.id,
      url: session.url
    };
    
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle successful subscription (webhook)
 */
async function handleSubscriptionCreated(subscription) {
  try {
    console.log(`🎉 New subscription created: ${subscription.id}`);
    
    const serverId = subscription.metadata.discord_server_id;
    const serverName = subscription.metadata.discord_server_name;
    const customerId = subscription.customer;
    
    if (!serverId) {
      console.error('No server ID in subscription metadata');
      return { success: false, error: 'Missing server ID' };
    }

    if (!supabase) {
      console.warn('Supabase client not available - skipping database operations');
      return { success: true, subscriptionId: subscription.id, warning: 'Database not available' };
    }

    // Store subscription in database
    const { error: dbError } = await supabase
      .from('subscriptions')
      .insert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        discord_server_id: serverId,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        price_id: subscription.items.data[0]?.price?.id,
        metadata: subscription.metadata
      });

    if (dbError) {
      console.error('Error storing subscription:', dbError);
      return { success: false, error: dbError.message };
    }

    console.log(`✅ Subscription stored for server: ${serverId}`);
    
    // Update server conversion rate
    await updateServerConversionRate(serverId);
    
    return { success: true, subscriptionId: subscription.id };
    
  } catch (error) {
    console.error('Error handling subscription created:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle subscription cancellation (webhook)
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    console.log(`❌ Subscription cancelled: ${subscription.id}`);
    
    const serverId = subscription.metadata.discord_server_id;
    
    if (!supabase) {
      console.warn('Supabase client not available - skipping database operations');
      return { success: true, warning: 'Database not available' };
    }
    
    // Update subscription status in database
    const { error: dbError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (dbError) {
      console.error('Error updating subscription status:', dbError);
      return { success: false, error: dbError.message };
    }

    // Update server conversion rate
    await updateServerConversionRate(serverId);
    
    return { success: true };
    
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update server conversion rate based on active subscriptions
 */
async function updateServerConversionRate(serverId) {
  try {
    console.log(`📊 Updating conversion rate for server: ${serverId}`);
    
    if (!supabase) {
      console.warn('Supabase client not available - skipping conversion rate update');
      return;
    }
    
    // Get active subscription count for this server
    const { data: activeSubscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('discord_server_id', serverId)
      .eq('status', 'active');
      
    if (subError) {
      console.error('Error fetching active subscriptions:', subError);
      return;
    }
    
    const activePaidMembers = activeSubscriptions ? activeSubscriptions.length : 0;
    
    // Get total active members from affiliate tracking
    const { data: activeMembers, error: memberError } = await supabase
      .from('affiliate_tracking')
      .select('id')
      .eq('discord_server_id', serverId)
      .eq('conversion_status', 'joined')
      .is('leave_timestamp', null);
      
    if (memberError) {
      console.error('Error fetching active members:', memberError);
      return;
    }
    
    const totalActiveMembers = activeMembers ? activeMembers.length : 0;
    const conversionRate = totalActiveMembers > 0 ? ((activePaidMembers / totalActiveMembers) * 100) : 0;
    
    // Update server conversion rate
    const { error: updateError } = await supabase
      .from('discord_servers')
      .update({
        paid_conversion_rate: Math.round(conversionRate * 100) / 100,
        updated_at: new Date().toISOString()
      })
      .eq('discord_server_id', serverId);
      
    if (updateError) {
      console.error('Error updating conversion rate:', updateError);
    } else {
      console.log(`✅ Updated conversion rate to ${conversionRate.toFixed(2)}% (${activePaidMembers}/${totalActiveMembers})`);
    }
    
  } catch (error) {
    console.error('Error updating conversion rate:', error);
  }
}

/**
 * Get customer's subscriptions for a specific server
 */
async function getCustomerSubscriptions(customerId, serverId) {
  try {
    if (!supabase) {
      console.warn('Supabase client not available - returning empty subscriptions');
      return { success: true, subscriptions: [] };
    }
    
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .eq('discord_server_id', serverId)
      .eq('status', 'active');
      
    if (error) {
      console.error('Error fetching customer subscriptions:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, subscriptions: subscriptions || [] };
    
  } catch (error) {
    console.error('Error getting customer subscriptions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create or get Stripe customer
 */
async function createOrGetCustomer(discordUserId, email) {
  try {
    // First, try to find existing customer
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });
    
    if (customers.data.length > 0) {
      console.log(`Found existing customer: ${customers.data[0].id}`);
      return {
        success: true,
        customerId: customers.data[0].id,
        isNew: false
      };
    }
    
    // Create new customer
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        discord_user_id: discordUserId
      }
    });
    
    console.log(`Created new customer: ${customer.id}`);
    return {
      success: true,
      customerId: customer.id,
      isNew: true
    };
    
  } catch (error) {
    console.error('Error creating/getting customer:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createCheckoutSession,
  handleSubscriptionCreated,
  handleSubscriptionDeleted,
  updateServerConversionRate,
  getCustomerSubscriptions,
  createOrGetCustomer,
  PAID_ROLE_NAME,
  FREE_ROLE_NAME
};
