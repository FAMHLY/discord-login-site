// Add subscription upgrade buttons to existing server cards
// This integrates with your existing dashboard without breaking anything

function addSubscriptionButtonsToServerCards() {
  console.log('Adding subscription buttons to server cards...');
  
  // Find all server cards
  const serverCards = document.querySelectorAll('.server-card');
  
  serverCards.forEach(card => {
    const serverId = card.dataset.serverId;
    if (!serverId) return;
    
    // Check if subscription section already exists
    if (card.querySelector('.subscription-section')) return;
    
    // Create subscription section
    const subscriptionSection = document.createElement('div');
    subscriptionSection.className = 'subscription-section';
    subscriptionSection.innerHTML = `
      <div class="subscription-header">
        <h4>💰 Monetize Your Server</h4>
        <p>Let members upgrade to premium for exclusive benefits!</p>
      </div>
      <div class="subscription-actions">
        <button class="btn btn-premium" onclick="upgradeServerToPremium('${serverId}')">
          🚀 Enable Premium Subscriptions
        </button>
        <div class="subscription-info">
          <small>💰 Earn recurring revenue from your Discord community</small>
        </div>
      </div>
    `;
    
    // Add to server card
    const actionsDiv = card.querySelector('.server-actions');
    if (actionsDiv) {
      actionsDiv.appendChild(subscriptionSection);
    }
  });
}

// Function to upgrade a server to premium (enable subscriptions)
async function upgradeServerToPremium(serverId) {
  console.log(`Upgrading server ${serverId} to premium...`);
  
  const priceId = 'price_1SIzTLFSRfDsx8GKL2BP9o3Q'; // Your Stripe price ID
  
  try {
    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '⏳ Creating checkout...';
    button.disabled = true;
    
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
      console.log('Checkout session created, redirecting...');
      // Redirect to Stripe checkout
      window.location.href = result.url;
    } else {
      console.error('Failed to create checkout session:', result.error);
      alert('Failed to create checkout session: ' + result.error);
      
      // Reset button
      button.textContent = originalText;
      button.disabled = false;
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    alert('Error creating checkout session: ' + error.message);
    
    // Reset button
    button.textContent = originalText;
    button.disabled = false;
  }
}

// Function to check if user has active subscription for a server
async function checkServerSubscription(serverId) {
  try {
    const response = await fetch(`/api/stripe/subscriptions/${serverId}`);
    const result = await response.json();
    
    if (result.success && result.subscriptions.length > 0) {
      return true; // User has active subscription
    }
    return false; // No active subscription
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

// Add CSS styles for subscription buttons
function addSubscriptionStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .subscription-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-top: 1rem;
      text-align: center;
    }
    
    .subscription-header h4 {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
    }
    
    .subscription-header p {
      margin: 0 0 1rem 0;
      opacity: 0.9;
      font-size: 0.9rem;
    }
    
    .btn-premium {
      background: #00FF00;
      color: #000;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 0.9rem;
    }
    
    .btn-premium:hover:not(:disabled) {
      background: #00CC00;
      transform: translateY(-1px);
    }
    
    .btn-premium:disabled {
      background: #666;
      cursor: not-allowed;
      transform: none;
    }
    
    .subscription-info {
      margin-top: 0.75rem;
    }
    
    .subscription-info small {
      opacity: 0.8;
      font-size: 0.8rem;
    }
  `;
  document.head.appendChild(style);
}

// Initialize subscription buttons when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Add styles
  addSubscriptionStyles();
  
  // Add subscription buttons after a short delay to ensure server cards are loaded
  setTimeout(() => {
    addSubscriptionButtonsToServerCards();
  }, 1000);
});

// Also add buttons when servers are refreshed
const originalLoadServers = window.loadServers;
if (originalLoadServers) {
  window.loadServers = function() {
    originalLoadServers.apply(this, arguments);
    // Add subscription buttons after servers are loaded
    setTimeout(addSubscriptionButtonsToServerCards, 500);
  };
}
