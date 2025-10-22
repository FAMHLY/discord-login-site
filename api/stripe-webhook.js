// Stripe webhook handler for Discord monetization
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleSubscriptionCreated, handleSubscriptionDeleted, updateServerConversionRate } = require('./stripe');
const { handleSubscriptionChange } = require('../role-manager');

const app = express();

// Stripe webhook endpoint
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature with raw body
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`📡 Received Stripe webhook: ${event.type}`);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    console.error('Headers:', req.headers);
    console.error('Body length:', req.body?.length);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('✅ Checkout session completed');
        const session = event.data.object;
        // Handle successful payment
        await handleCheckoutCompleted(session);
        break;

      case 'customer.subscription.created':
        console.log('🎉 Subscription created');
        const subscription = event.data.object;
        await handleSubscriptionCreated(subscription);
        
        // Update Discord roles
        if (subscription.metadata?.discord_server_id && subscription.customer) {
          await handleSubscriptionChange(
            subscription.customer,
            subscription.metadata.discord_server_id,
            'active'
          );
        }
        break;

      case 'customer.subscription.updated':
        console.log('📝 Subscription updated');
        const updatedSubscription = event.data.object;
        
        // Handle subscription status changes
        if (updatedSubscription.metadata?.discord_server_id && updatedSubscription.customer) {
          await handleSubscriptionChange(
            updatedSubscription.customer,
            updatedSubscription.metadata.discord_server_id,
            updatedSubscription.status
          );
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
          await handleSubscriptionChange(
            deletedSubscription.customer,
            deletedSubscription.metadata.discord_server_id,
            'cancelled'
          );
        }
        break;

      case 'invoice.payment_succeeded':
        console.log('💰 Invoice payment succeeded');
        const invoice = event.data.object;
        // Handle successful payment
        await handleInvoicePaymentSucceeded(invoice);
        break;

      case 'invoice.payment_failed':
        console.log('💸 Invoice payment failed');
        const failedInvoice = event.data.object;
        // Handle failed payment
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
});

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session) {
  try {
    console.log(`✅ Checkout completed for session: ${session.id}`);
    
    // The subscription will be handled by the subscription.created event
    // This is just for logging and any additional processing
    
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
      
      // Update Discord roles (might downgrade to free role)
      await handleSubscriptionChange(
        subscription.customer,
        subscription.metadata.discord_server_id,
        'past_due'
      );
    }
    
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

module.exports = app;
