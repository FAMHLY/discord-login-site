// API endpoint to get user's subscriptions
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
  // Set no-cache headers to prevent Vercel from caching responses
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from session (you'll need to implement session handling)
    // For now, we'll get it from query parameters
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not available' });
    }

    console.log(`🔍 Fetching subscriptions for user: ${userId}`);

    // Get user's subscriptions from database
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('discord_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    console.log(`✅ Found ${subscriptions.length} subscriptions for user: ${userId}`);

    // Get server information for each subscription
    const formattedSubscriptions = await Promise.all(
      subscriptions.map(async (sub) => {
        // Get server information separately since we removed the foreign key relationship
        let serverName = 'Unknown Server';
        let serverIcon = null;
        
        try {
          const { data: serverData, error: serverError } = await supabase
            .from('discord_servers')
            .select('server_name, server_icon')
            .eq('discord_server_id', sub.discord_server_id)
            .limit(1)
            .single();
          
          if (!serverError && serverData) {
            serverName = serverData.server_name;
            serverIcon = serverData.server_icon;
          }
        } catch (error) {
          console.log(`Could not fetch server info for ${sub.discord_server_id}:`, error.message);
        }
        
        return {
          id: sub.stripe_subscription_id,
          status: sub.status,
          serverId: sub.discord_server_id,
          serverName: serverName,
          serverIcon: serverIcon,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelledAt: sub.cancelled_at,
          createdAt: sub.created_at,
          priceId: sub.price_id
        };
      })
    );

    res.json({
      success: true,
      subscriptions: formattedSubscriptions
    });

  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subscriptions',
      details: error.message
    });
  }
};
