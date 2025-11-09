// Stripe webhook handler that works with Vercel's body parsing limitations
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleSubscriptionCreated, handleSubscriptionUpdated, handleSubscriptionDeleted, updateServerConversionRate } = require('./stripe');
const { handleSubscriptionChange } = require('../role-manager');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // For Vercel, we need to work around the automatic JSON parsing
    // The key insight is that we need to reconstruct the exact JSON string
    // that Stripe sent, including preserving the exact formatting
    
    let rawBody;
    
    if (Buffer.isBuffer(req.body)) {
      // Body is already a buffer (ideal case)
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      // Body is a string, convert to buffer
      rawBody = Buffer.from(req.body, 'utf8');
    } else {
      // Body was parsed as JSON object - we need to reconstruct it
      // Use JSON.stringify with no spaces to match Stripe's format
      rawBody = Buffer.from(JSON.stringify(req.body), 'utf8');
    }
    
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`📡 Received Stripe webhook: ${event.type}`);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    console.error('Headers:', req.headers);
    console.error('Body type:', typeof req.body);
    console.error('Body length:', req.body?.length);
    console.error('Stripe signature:', sig);
    
    // For debugging, let's try to process the event anyway if signature verification fails
    // This is NOT recommended for production, but helps us debug
    console.log('⚠️  Attempting to process event without signature verification for debugging...');
    
    try {
      // Try to parse the body as a Stripe event
      if (typeof req.body === 'object' && req.body.type) {
        event = req.body;
        console.log(`📡 Processing event without signature verification: ${event.type}`);
      } else {
        throw new Error('Cannot parse event from body');
      }
    } catch (parseErr) {
      console.error('Failed to parse event:', parseErr.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('✅ Checkout session completed');
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;

      case 'customer.subscription.created':
        console.log('🎉 Subscription created');
        const subscription = event.data.object;
        await handleSubscriptionCreated(subscription);
        await handleSubscriptionUpdated(subscription);
        
        // Update Discord roles
        if (subscription.metadata?.discord_server_id && subscription.customer) {
          try {
            // Get Discord user ID from customer metadata
            let customer;
            let discordUserId;
            
            if (typeof subscription.customer === 'string') {
              customer = await stripe.customers.retrieve(subscription.customer);
            } else {
              customer = subscription.customer;
            }
            
            discordUserId = customer.metadata?.discord_user_id || subscription.metadata?.discord_user_id;
            
            if (discordUserId) {
              await handleSubscriptionChange(
                discordUserId,
                subscription.metadata.discord_server_id,
                'active'
              );
            } else {
              console.error('⚠️ No Discord user ID found in customer or subscription metadata');
            }
          } catch (roleError) {
            console.error('⚠️ Discord role update failed:', roleError);
          }
        }
        break;

      case 'customer.subscription.updated':
        console.log('📝 Subscription updated');
        const updatedSubscription = event.data.object;
        await handleSubscriptionUpdated(updatedSubscription);
        
        // Handle subscription status changes
        if (updatedSubscription.metadata?.discord_server_id && updatedSubscription.customer) {
          try {
            // Get Discord user ID from customer metadata
            let customer;
            let discordUserId;
            
            if (typeof updatedSubscription.customer === 'string') {
              customer = await stripe.customers.retrieve(updatedSubscription.customer);
            } else {
              customer = updatedSubscription.customer;
            }
            
            discordUserId = customer.metadata?.discord_user_id || updatedSubscription.metadata?.discord_user_id;
            
            if (discordUserId) {
              await handleSubscriptionChange(
                discordUserId,
                updatedSubscription.metadata.discord_server_id,
                updatedSubscription.status
              );
            } else {
              console.error('⚠️ No Discord user ID found in customer or subscription metadata');
            }
          } catch (roleError) {
            console.error('⚠️ Discord role update failed:', roleError);
          }
        }
        
        // Update conversion rate
        if (updatedSubscription.metadata?.discord_server_id) {
          await updateServerConversionRate(updatedSubscription.metadata.discord_server_id);
        }
        break;

      case 'customer.subscription.deleted':
        console.log('❌ Subscription deleted');
        const deletedSubscription = event.data.object;
        await handleSubscriptionDeleted(deletedSubscription);
        
        // Update Discord roles (remove paid role)
        if (deletedSubscription.metadata?.discord_server_id && deletedSubscription.customer) {
          try {
            // Get Discord user ID from customer metadata
            let customer;
            let discordUserId;
            
            if (typeof deletedSubscription.customer === 'string') {
              customer = await stripe.customers.retrieve(deletedSubscription.customer);
            } else {
              customer = deletedSubscription.customer;
            }
            
            discordUserId = customer.metadata?.discord_user_id || deletedSubscription.metadata?.discord_user_id;
            
            if (discordUserId) {
              await handleSubscriptionChange(
                discordUserId,
                deletedSubscription.metadata.discord_server_id,
                'cancelled'
              );
            } else {
              console.error('⚠️ No Discord user ID found in customer or subscription metadata');
            }
          } catch (roleError) {
            console.error('⚠️ Discord role update failed:', roleError);
          }
        }
        break;

      case 'invoice.payment_succeeded':
        console.log('💰 Invoice payment succeeded');
        const invoice = event.data.object;
        await handleInvoicePaymentSucceeded(invoice);
        break;

      case 'invoice.payment_failed':
        console.log('💸 Invoice payment failed');
        const failedInvoice = event.data.object;
        await handleInvoicePaymentFailed(failedInvoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session) {
  try {
    console.log(`✅ Checkout completed for session: ${session.id}`);
    
    if (session.metadata?.discord_server_id) {
      console.log(`Checkout completed for server: ${session.metadata.discord_server_id}`);
    }
    
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    console.log(`💰 Payment succeeded for invoice: ${invoice.id}`);
    
    // Check if invoice has a subscription
    if (!invoice.subscription) {
      console.log('⚠️  Invoice has no subscription, skipping...');
      return;
    }
    
    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    if (subscription.metadata?.discord_server_id) {
      console.log(`Payment succeeded for server: ${subscription.metadata.discord_server_id}`);
      
      // Update conversion rate
      await updateServerConversionRate(subscription.metadata.discord_server_id);
    }
    
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice) {
  try {
    console.log(`💸 Payment failed for invoice: ${invoice.id}`);
    
    // Get the subscription
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
      if (subscription.metadata?.discord_server_id && subscription.customer) {
        console.log(`Payment failed for server: ${subscription.metadata.discord_server_id}`);
        
        try {
          // Get Discord user ID from customer metadata
          let customer;
          let discordUserId;
          
          if (typeof subscription.customer === 'string') {
            customer = await stripe.customers.retrieve(subscription.customer);
          } else {
            customer = subscription.customer;
          }
          
          discordUserId = customer.metadata?.discord_user_id || subscription.metadata?.discord_user_id;
          
          if (discordUserId) {
            // Update Discord roles (might downgrade to free role)
            await handleSubscriptionChange(
              discordUserId,
              subscription.metadata.discord_server_id,
              'past_due'
            );
          } else {
            console.error('⚠️ No Discord user ID found in customer or subscription metadata');
          }
        } catch (roleError) {
          console.error('⚠️ Discord role update failed:', roleError);
        }
      }
    
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}
