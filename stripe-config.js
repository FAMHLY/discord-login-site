// Stripe configuration for Discord server monetization
// Replace these with your actual Stripe price IDs from the Stripe Dashboard

const STRIPE_CONFIG = {
  // Your actual Stripe price IDs from Stripe Dashboard
  PRICE_IDS: {
    MONTHLY_PREMIUM: 'price_1SIzTLFSRfDsx8GKL2BP9o3Q', // Your monthly premium price ID
    YEARLY_PREMIUM: 'price_0987654321fedcba',  // Add yearly price ID when you create it
  },
  
  // Product information for display
  PRODUCTS: {
    MONTHLY_PREMIUM: {
      name: 'Monthly Premium',
      price: '$9.99',
      period: 'month',
      features: [
        '🟢 Premium role in Discord',
        '📊 Advanced analytics',
        '🎯 Priority support',
        '💎 Exclusive features'
      ]
    },
    YEARLY_PREMIUM: {
      name: 'Yearly Premium',
      price: '$99.99',
      period: 'year',
      features: [
        '🟢 Premium role in Discord',
        '📊 Advanced analytics', 
        '🎯 Priority support',
        '💎 Exclusive features',
        '💰 2 months free!'
      ]
    }
  }
};

// Function to create checkout session
async function createCheckoutSession(serverId, priceId) {
  try {
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverId: serverId,
        priceId: priceId
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // Redirect to Stripe checkout
      window.location.href = result.url;
    } else {
      console.error('Failed to create checkout session:', result.error);
      alert('Failed to create checkout session: ' + result.error);
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    alert('Error creating checkout session: ' + error.message);
  }
}

// Function to check if user has active subscription
async function checkUserSubscription(serverId) {
  try {
    const response = await fetch(`/api/stripe/subscriptions/${serverId}`);
    const result = await response.json();
    
    if (result.success) {
      return result.subscriptions.length > 0;
    }
    return false;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

module.exports = {
  STRIPE_CONFIG,
  createCheckoutSession,
  checkUserSubscription
};
