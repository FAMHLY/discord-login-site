// Stripe webhook handler that works with Vercel's body parsing limitations
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleSubscriptionCreated, handleSubscriptionUpdated, handleSubscriptionDeleted, updateServerConversionRate } = require('./stripe');

const BOT_SERVER_URL = process.env.BOT_SERVER_URL;
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;

// Collect raw body from request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Request the bot server to assign/update a Discord role
 */
async function requestRoleAssignment(discordUserId, serverId, status) {
  if (!BOT_SERVER_URL) {
    console.error('⚠️ BOT_SERVER_URL not configured, cannot assign role');
    return;
  }

  try {
    console.log(`🔗 Requesting role assignment from bot server: user=${discordUserId} server=${serverId} status=${status}`);
    const response = await fetch(`${BOT_SERVER_URL}/api/bot/assign-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-token': BOT_API_TOKEN || '',
      },
      body: JSON.stringify({ discordUserId, serverId, status }),
    });

    const result = await response.json();
    if (result.success) {
      console.log(`✅ Role assignment successful`);
    } else {
      console.error(`⚠️ Role assignment failed:`, result.error);
    }
  } catch (error) {
    console.error('⚠️ Error calling bot server for role assignment:', error.message);
  }
}

/**
 * Get Discord user ID from a Stripe subscription's customer metadata
 */
async function getDiscordUserId(subscription) {
  let customer;
  if (typeof subscription.customer === 'string') {
    customer = await stripe.customers.retrieve(subscription.customer);
  } else {
    customer = subscription.customer;
  }
  return customer.metadata?.discord_user_id || subscription.metadata?.discord_user_id;
}

const handler = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Read the raw body directly from the stream (body parsing is disabled via config below)
    const rawBody = await getRawBody(req);

    // Verify webhook signature with the raw body
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`📡 Received Stripe webhook: ${event.type}`);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
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

        // Update Discord roles via bot server
        if (subscription.metadata?.discord_server_id && subscription.customer) {
          try {
            const discordUserId = await getDiscordUserId(subscription);
            if (discordUserId) {
              await requestRoleAssignment(discordUserId, subscription.metadata.discord_server_id, 'active');
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

        // Update Discord roles via bot server
        if (updatedSubscription.metadata?.discord_server_id && updatedSubscription.customer) {
          try {
            const discordUserId = await getDiscordUserId(updatedSubscription);
            if (discordUserId) {
              await requestRoleAssignment(discordUserId, updatedSubscription.metadata.discord_server_id, updatedSubscription.status);
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

        // Update Discord roles via bot server
        if (deletedSubscription.metadata?.discord_server_id && deletedSubscription.customer) {
          try {
            const discordUserId = await getDiscordUserId(deletedSubscription);
            if (discordUserId) {
              await requestRoleAssignment(discordUserId, deletedSubscription.metadata.discord_server_id, 'cancelled');
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

module.exports = handler;

// Disable Vercel's automatic body parsing so we get the raw body for Stripe signature verification
module.exports.config = {
  api: {
    bodyParser: false,
  },
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
        const discordUserId = await getDiscordUserId(subscription);
        if (discordUserId) {
          await requestRoleAssignment(discordUserId, subscription.metadata.discord_server_id, 'past_due');
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
