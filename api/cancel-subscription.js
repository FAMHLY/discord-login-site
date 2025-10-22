// API endpoint to cancel Stripe subscriptions
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

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscriptionId, serverId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    console.log(`🔄 Cancelling subscription: ${subscriptionId}`);

    // Cancel the subscription in Stripe
    const cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
    
    console.log(`✅ Subscription cancelled in Stripe: ${subscriptionId}`);

    // Update the subscription status in our database
    if (supabase) {
      const { error: dbError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscriptionId);

      if (dbError) {
        console.error('Error updating subscription in database:', dbError);
        // Don't fail the request if database update fails
      } else {
        console.log(`✅ Subscription status updated in database: ${subscriptionId}`);
      }

      // Update conversion rate if serverId is provided
      if (serverId) {
        try {
          const { updateServerConversionRate } = require('./stripe');
          await updateServerConversionRate(serverId);
          console.log(`✅ Conversion rate updated for server: ${serverId}`);
        } catch (error) {
          console.error('Error updating conversion rate:', error);
        }
      }
    }

    // Return success response
    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: {
        id: cancelledSubscription.id,
        status: cancelledSubscription.status,
        cancelled_at: cancelledSubscription.canceled_at
      }
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid subscription ID or subscription already cancelled',
        details: error.message
      });
    }

    res.status(500).json({ 
      error: 'Failed to cancel subscription',
      details: error.message
    });
  }
};
