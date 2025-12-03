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
const PAID_ROLE_NAME = '🟢';
const FREE_ROLE_NAME = '🔴';

async function getMemberAffiliate(discordServerId, discordUserId) {
  if (!supabase || !discordServerId || !discordUserId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('member_affiliates')
      .select('affiliate_id')
      .eq('discord_server_id', discordServerId)
      .eq('discord_user_id', discordUserId)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Unable to load member affiliate link:', error);
      return null;
    }

    return data?.affiliate_id || null;
  } catch (fetchError) {
    console.warn('⚠️ Failed to fetch member affiliate link:', fetchError);
    return null;
  }
}

/**
 * Create a Stripe Checkout Session for Discord server subscription
 */
async function createCheckoutSession(customerId, serverId, serverName, priceId, successUrl, cancelUrl, discordUserId) {
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
        discord_user_id: discordUserId,
      },
      subscription_data: {
        metadata: {
          discord_server_id: serverId,
          discord_server_name: serverName,
          discord_user_id: discordUserId,
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
 * Create a Stripe checkout session initiated by a Discord member via slash command
 */
async function createMemberCheckoutSession({
  discordUserId,
  discordUsername,
  serverId,
  serverName,
  priceId,
  successUrl,
  cancelUrl
}) {
  try {
    let effectivePriceId = priceId || process.env.STRIPE_DEFAULT_PRICE_ID;

    if (!effectivePriceId && supabase) {
      try {
        const { data: serverSettings, error: settingsError } = await supabase
          .from('server_settings')
          .select('stripe_price_id')
          .eq('discord_server_id', serverId)
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.warn('⚠️ Unable to load server settings:', settingsError);
        } else if (serverSettings?.stripe_price_id) {
          effectivePriceId = serverSettings.stripe_price_id;
        } else {
          const { data: legacyConfig, error: legacyError } = await supabase
            .from('discord_servers')
            .select('stripe_price_id')
            .eq('discord_server_id', serverId)
            .order('updated_at', { ascending: false })
            .limit(1);

          if (legacyError) {
            console.warn('⚠️ Unable to load legacy server price configuration:', legacyError);
          } else if (legacyConfig && legacyConfig.length > 0 && legacyConfig[0].stripe_price_id) {
            effectivePriceId = legacyConfig[0].stripe_price_id;
          }
        }
      } catch (configError) {
        console.warn('⚠️ Failed to fetch server price configuration:', configError);
      }
    }

    if (!effectivePriceId) {
      return { success: false, error: 'No Stripe price configured for this server.' };
    }

    let existingCustomerId = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('discord_user_id', discordUserId)
        .eq('discord_server_id', serverId)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('⚠️ Failed to look up existing customer:', error);
      } else if (data && data.length > 0) {
        existingCustomerId = data[0].stripe_customer_id;
      }
    }

    const metadata = {
      discord_user_id: discordUserId,
      discord_username: discordUsername,
      discord_server_id: serverId,
      discord_server_name: serverName
    };

    const sessionParams = {
      mode: 'subscription',
      line_items: [
        {
          price: effectivePriceId,
          quantity: 1,
        },
      ],
      success_url:
        successUrl ||
        process.env.MEMBER_CHECKOUT_SUCCESS_URL ||
        process.env.PUBLIC_SITE_URL ||
        'https://discord.com',
      cancel_url:
        cancelUrl ||
        process.env.MEMBER_CHECKOUT_CANCEL_URL ||
        process.env.PUBLIC_SITE_URL ||
        'https://discord.com',
      metadata,
      subscription_data: {
        metadata
      }
    };

    if (existingCustomerId) {
      sessionParams.customer = existingCustomerId;
    }
    // Note: For subscription mode, Stripe automatically creates a customer
    // if none is provided. The customer_creation parameter is only valid
    // for payment mode, not subscription mode.
    // The customer metadata will be updated in the webhook handler after
    // the subscription is created, using the Discord user ID from subscription metadata.

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log(`✅ Member checkout session created: ${session.id}`);

    return {
      success: true,
      sessionId: session.id,
      url: session.url
    };
  } catch (error) {
    console.error('Error creating member checkout session:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a Stripe billing portal session for a Discord member
 */
async function createMemberPortalSession({
  discordUserId,
  serverId,
  returnUrl
}) {
  try {
    let customerId = null;

    // First, try to find customer in database
    if (supabase) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('discord_user_id', discordUserId)
        .eq('discord_server_id', serverId)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching subscription for portal session:', error);
      } else if (data && data.length > 0 && data[0].stripe_customer_id) {
        customerId = data[0].stripe_customer_id;
      }
    }

    // If not found in database, try to find customer in Stripe by searching subscriptions
    if (!customerId) {
      console.log(`Customer not found in database, searching Stripe subscriptions for server: ${serverId}`);
      try {
        // Search for active subscriptions for this server
        // Note: Stripe doesn't support filtering by metadata in list, so we search recent subscriptions
        const subscriptions = await stripe.subscriptions.list({
          status: 'all',
          limit: 100
        });

        // Filter subscriptions by server ID in metadata and check customer metadata
        for (const sub of subscriptions.data) {
          if (sub.metadata?.discord_server_id === serverId) {
            // Get the customer to check Discord user ID
            let customer;
            if (typeof sub.customer === 'string') {
              customer = await stripe.customers.retrieve(sub.customer);
            } else {
              customer = sub.customer;
            }

            // Check if customer metadata matches, or if subscription metadata has the user ID
            const subDiscordUserId = customer.metadata?.discord_user_id || sub.metadata?.discord_user_id;
            if (subDiscordUserId === discordUserId) {
              customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
              console.log(`✅ Found customer in Stripe subscription: ${customerId}`);
              break;
            }
          }
        }
      } catch (stripeError) {
        console.error('Error searching Stripe for customer:', stripeError);
      }
    }

    if (!customerId) {
      return { success: false, error: 'No active subscription found. Please subscribe first to manage your membership.' };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url:
        returnUrl ||
        process.env.MEMBER_PORTAL_RETURN_URL ||
        process.env.MEMBER_CHECKOUT_SUCCESS_URL ||
        process.env.PUBLIC_SITE_URL ||
        'https://discord.com'
    });

    console.log(`✅ Member portal session created: ${session.id}`);

    return {
      success: true,
      url: session.url
    };
  } catch (error) {
    console.error('Error creating member portal session:', error);
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

    // Get Discord user ID from customer metadata or subscription metadata
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
    
    // Fallback to subscription metadata if customer metadata doesn't have it
    if (!discordUserId && subscription.metadata?.discord_user_id) {
      discordUserId = subscription.metadata.discord_user_id;
      // Update customer metadata so we have it for future lookups
      try {
        const customerIdString = typeof customerId === 'string' ? customerId : customerId.id;
        await stripe.customers.update(customerIdString, {
          metadata: {
            ...(customer.metadata || {}),
            discord_user_id: discordUserId,
            discord_username: subscription.metadata.discord_username || 'Unknown'
          }
        });
        console.log(`✅ Updated customer metadata with Discord user ID: ${discordUserId}`);
      } catch (updateError) {
        console.error('⚠️ Failed to update customer metadata:', updateError);
        // Continue anyway - we have the Discord user ID from subscription metadata
      }
    }

    let affiliateId = null;
    if (serverId && discordUserId) {
      affiliateId = await getMemberAffiliate(serverId, discordUserId);
    }

    // Prepare subscription data with better error handling
    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof customerId === 'string' ? customerId : customerId.id,
      discord_user_id: discordUserId,
      discord_server_id: serverId,
      status: subscription.status,
      price_id: subscription.items?.data?.[0]?.price?.id,
      metadata: subscription.metadata,
      affiliate_id: affiliateId
    };

    // Handle period dates safely
    if (subscription.current_period_start) {
      try {
        subscriptionData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
      } catch (error) {
        console.error('Error parsing current_period_start:', error);
        subscriptionData.current_period_start = null;
      }
    }

    if (subscription.current_period_end) {
      try {
        subscriptionData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
      } catch (error) {
        console.error('Error parsing current_period_end:', error);
        subscriptionData.current_period_end = null;
      }
    }

    console.log('Inserting subscription data:', subscriptionData);

    // Store subscription in database
    const { error: dbError } = await supabase
      .from('subscriptions')
      .insert(subscriptionData);

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
 * Handle subscription updates (status changes, period renewals, metadata updates)
 */
async function handleSubscriptionUpdated(subscription) {
  try {
    console.log(`📝 Subscription updated: ${subscription.id} -> ${subscription.status}`);

    if (!supabase) {
      console.warn('Supabase client not available - skipping subscription update');
      return { success: true, warning: 'Database not available' };
    }

    // Ensure we have the customer's Discord user ID
    let discordUserId = null;
    if (subscription.customer) {
      if (typeof subscription.customer === 'string') {
        try {
          const customer = await stripe.customers.retrieve(subscription.customer);
          discordUserId = customer.metadata?.discord_user_id || null;
        } catch (customerError) {
          console.error('⚠️ Failed to retrieve customer for subscription update:', customerError);
        }
      } else {
        discordUserId = subscription.customer.metadata?.discord_user_id || null;
      }
    }

    let affiliateId = null;
    if (supabase && subscription.metadata?.discord_server_id && discordUserId) {
      affiliateId = await getMemberAffiliate(subscription.metadata.discord_server_id, discordUserId);
    }

    const updateData = {
      status: subscription.status,
      price_id: subscription.items?.data?.[0]?.price?.id,
      metadata: subscription.metadata,
      updated_at: new Date().toISOString(),
    };

    if (discordUserId) {
      updateData.discord_user_id = discordUserId;
    }

    if (affiliateId) {
      updateData.affiliate_id = affiliateId;
    }

    if (subscription.current_period_start) {
      try {
        updateData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
      } catch (error) {
        console.error('Error parsing current_period_start (update):', error);
      }
    }

    if (subscription.current_period_end) {
      try {
        updateData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
      } catch (error) {
        console.error('Error parsing current_period_end (update):', error);
      }
    }

    if (subscription.canceled_at) {
      try {
        updateData.cancelled_at = new Date(subscription.canceled_at * 1000).toISOString();
      } catch (error) {
        console.error('Error parsing canceled_at (update):', error);
      }
    } else if (subscription.status === 'active') {
      // Clear cancelled_at if subscription reactivated
      updateData.cancelled_at = null;
    }

    // Update the subscription in the database
    const { data: updatedRows, error: updateError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.id)
      .select();

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return { success: false, error: updateError.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.log('⚠️ Subscription not found in database. Creating a new record...');
      return await handleSubscriptionCreated(subscription);
    }

    console.log(`✅ Subscription updated in database: ${subscription.id}`);
    return { success: true };
  } catch (error) {
    console.error('Error handling subscription updated:', error);
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
    const existingCustomer = customers.data[0];
    console.log(`Found existing customer: ${existingCustomer.id}`);

    // Ensure Discord user ID is stored in metadata
    if (discordUserId && existingCustomer.metadata?.discord_user_id !== discordUserId) {
      try {
        const updatedMetadata = {
          ...(existingCustomer.metadata || {}),
          discord_user_id: discordUserId
        };
        await stripe.customers.update(existingCustomer.id, {
          metadata: updatedMetadata
        });
        console.log(`🔄 Updated customer metadata with Discord user ID for ${existingCustomer.id}`);
      } catch (metadataError) {
        console.error('⚠️ Failed to update customer metadata:', metadataError);
      }
    }
    
    return {
      success: true,
      customerId: existingCustomer.id,
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
  createMemberCheckoutSession,
  createMemberPortalSession,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  updateServerConversionRate,
  getCustomerSubscriptions,
  createOrGetCustomer,
  PAID_ROLE_NAME,
  FREE_ROLE_NAME
};
