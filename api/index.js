const express = require('express');
const axios = require('axios');
require('dotenv').config();
const path = require('path');
const { createServerClient } = require('@supabase/ssr');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { 
  createCheckoutSession, 
  createMemberCheckoutSession,
  createMemberPortalSession,
  createOrGetCustomer, 
  getCustomerSubscriptions 
} = require('./stripe');
// Discord REST API for serverless environment

const app = express();
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
const STRIPE_DEFAULT_PRICE_ID = process.env.STRIPE_DEFAULT_PRICE_ID;

let supabaseServiceClient = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseServiceClient = createSupabaseClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  } else {
    console.warn('⚠️ Supabase service role credentials not configured. Some server settings features may be unavailable.');
  }
} catch (serviceClientError) {
  console.error('❌ Failed to initialize Supabase service client:', serviceClientError);
}

// Discord REST API functions for serverless environment
async function getDiscordGuilds() {
    try {
        console.log('Fetching all Discord guilds for bot...');
        const response = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Bot can see', response.data.length, 'guilds');
        return response.data;
    } catch (error) {
        console.error('Error fetching Discord guilds:', error.response?.data || error.message);
        return [];
    }
}

async function getUserDiscordRole(guildId, userId) {
    try {
        console.log(`Fetching Discord role for user ${userId} in guild ${guildId}...`);
        const response = await axios.get(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const member = response.data;
        console.log('Member data:', { userId, guildId, roles: member.roles });
        
        // Get guild roles to determine hierarchy
        const guildResponse = await axios.get(`https://discord.com/api/guilds/${guildId}/roles`, {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const guildRoles = guildResponse.data;
        console.log('Guild roles:', guildRoles.map(r => ({ id: r.id, name: r.name, position: r.position })));
        
        // Find the highest role (excluding @everyone)
        const userRoles = member.roles.filter(roleId => roleId !== guildId); // Remove @everyone role
        const userRoleObjects = guildRoles.filter(role => userRoles.includes(role.id));
        
        if (userRoleObjects.length === 0) {
            return 'Member';
        }
        
        // Sort by position (highest first) and get the top role
        const highestRole = userRoleObjects.sort((a, b) => b.position - a.position)[0];
        console.log('Highest role:', highestRole.name);
        
        return highestRole.name;
        
    } catch (error) {
        console.error('Error fetching user Discord role:', error.response?.data || error.message);
        // Return default role if we can't fetch it
        return 'Member';
    }
}

async function getDiscordGuild(guildId) {
    try {
        console.log('Fetching Discord guild with ID:', guildId);
        console.log('Bot token exists:', !!process.env.DISCORD_BOT_TOKEN);
        console.log('Bot token length:', process.env.DISCORD_BOT_TOKEN?.length);
        
        const response = await axios.get(`https://discord.com/api/guilds/${guildId}`, {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Discord API response status:', response.status);
        return response.data;
    } catch (error) {
        console.error('Error fetching Discord guild:', error.response?.data || error.message);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);
        return null;
    }
}

async function getDiscordChannels(guildId) {
    try {
        const response = await axios.get(`https://discord.com/api/guilds/${guildId}/channels`, {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching Discord channels:', error.response?.data || error.message);
        return [];
    }
}

async function createDiscordInvite(channelId, options = {}) {
    try {
        const response = await axios.post(`https://discord.com/api/channels/${channelId}/invites`, {
            max_age: options.maxAge || 0,
            max_uses: options.maxUses || 0,
            temporary: options.temporary || false,
            unique: options.unique || true
        }, {
            headers: {
                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error creating Discord invite:', error.response?.data || error.message);
        throw error;
    }
}

// Add middleware for parsing JSON request bodies
app.use(express.json());

// Add cookie-parser for Supabase cookies
app.use(cookieParser());

// Session management is handled by Supabase

// Handle /dashboard route - redirect to /dashboard.html
app.get('/dashboard', async (req, res) => {
  console.log('=== /dashboard route hit, redirecting to /dashboard.html ===');
  // Preserve query parameters when redirecting
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect('/dashboard.html' + queryString);
});

// Handle dashboard.html route specifically (before static file serving)
app.get('/dashboard.html', async (req, res, next) => {
  console.log('=== /dashboard.html route hit ===');
  console.log('Dashboard URL:', req.url);
  console.log('Dashboard query params:', req.query);
  console.log('Dashboard cookies:', req.cookies);
  
  // Check if this is an OAuth callback (has access_token in query or hash)
  if (req.query.access_token || req.url.includes('access_token') || req.url.includes('#')) {
    console.log('OAuth callback detected in dashboard route, redirecting to callback handler');
    console.log('Dashboard URL with hash:', req.url);
    // Convert hash parameters to query parameters for the callback handler
    const hashIndex = req.url.indexOf('#');
    if (hashIndex !== -1) {
      const hashParams = req.url.substring(hashIndex + 1);
      return res.redirect('/auth/callback?' + hashParams);
    }
    return res.redirect('/auth/callback' + req.url.substring(req.url.indexOf('?')));
  }
  
  // Allow access to dashboard without session check for now
  console.log('Dashboard accessed - allowing without session check');
  console.log('Dashboard cookies:', Object.keys(req.cookies));
  
  // Continue to the existing dashboard handler
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  console.log('=== Root route hit ===');
  console.log('Root URL:', req.url);
  console.log('Root query params:', req.query);
  console.log('Root cookies:', req.cookies);
  console.log('Root headers:', {
    'user-agent': req.headers['user-agent'],
    'referer': req.headers.referer,
    'host': req.headers.host
  });
  
  // Check if this is an OAuth callback (has access_token in query or hash)
  if (req.query.access_token || req.url.includes('access_token') || req.url.includes('#')) {
    console.log('OAuth callback detected in root route, redirecting to callback handler');
    console.log('Full URL with hash:', req.url);
    // Convert hash parameters to query parameters for the callback handler
    const hashIndex = req.url.indexOf('#');
    if (hashIndex !== -1) {
      const hashParams = req.url.substring(hashIndex + 1);
      return res.redirect('/auth/callback?' + hashParams);
    }
    return res.redirect('/auth/callback' + req.url.substring(req.url.indexOf('?')));
  }
  
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Simple test route at root level
app.get('/test', (req, res) => {
  console.log('=== Simple test route hit ===');
  res.json({ message: 'Simple test route is working', timestamp: new Date().toISOString() });
});

// Test route to verify callback route is working
app.get('/test-callback', (req, res) => {
  console.log('=== Test callback route hit ===');
  res.json({ message: 'Callback route is working', timestamp: new Date().toISOString() });
});

// Test route to verify any route is working
app.get('/test-any', (req, res) => {
  console.log('=== Test any route hit ===');
  res.json({ message: 'Any route is working', timestamp: new Date().toISOString() });
});

// Test route to check Discord OAuth configuration
app.get('/test-discord', async (req, res) => {
  console.log('=== Testing Discord OAuth Configuration ===');
  
  const baseUrl = process.env.SUPABASE_URL;
  const testUrl = `${baseUrl}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent('https://discord-login-site.vercel.app/auth/callback')}`;
  
  console.log('Test Discord OAuth URL:', testUrl);
  
  try {
    const response = await axios.get(testUrl, {
      timeout: 10000,
      validateStatus: () => true,
      maxRedirects: 0 // Don't follow redirects
    });
    
    console.log('Discord OAuth test response:', {
      status: response.status,
      headers: response.headers,
      location: response.headers.location
    });
    
    res.json({
      success: true,
      testUrl: testUrl,
      response: {
        status: response.status,
        location: response.headers.location
      }
    });
  } catch (error) {
    console.log('Discord OAuth test error:', error.message);
    res.json({
      success: false,
      error: error.message,
      testUrl: testUrl
    });
  }
});

// Test route to manually create a session
app.get('/test-session', async (req, res) => {
  console.log('=== Testing Manual Session Creation ===');
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  try {
    // Try to get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('Current session:', !!session);
    console.log('Session error:', error);
    
    res.json({
      hasSession: !!session,
      sessionData: session,
      error: error,
      cookies: req.cookies
    });
  } catch (error) {
    console.error('Session test error:', error);
    res.json({
      error: error.message,
      cookies: req.cookies
    });
  }
});

app.get('/auth/discord', async (req, res) => {
  const baseUrl = process.env.SUPABASE_URL; // Already includes https://
  
  console.log('=== Discord OAuth Debug ===');
  console.log('VERCEL_URL:', process.env.VERCEL_URL);
  console.log('Request host:', req.headers.host);
  console.log('X-Forwarded-Host:', req.headers['x-forwarded-host']);
  console.log('X-Forwarded-Proto:', req.headers['x-forwarded-proto']);
  console.log('All headers:', req.headers);
  
  // Force use of the actual Vercel domain
  let redirectTo;
  
  // Use Supabase callback URL - Supabase will handle the OAuth and redirect to our site
  redirectTo = encodeURIComponent('https://discord-login-site.vercel.app/dashboard.html');
  console.log('Using Supabase callback flow with dashboard redirect');
  
  // Original logic (commented out for testing)
  /*
  if (req.headers.host && req.headers.host.includes('vercel.app')) {
    // Use the actual Vercel domain from the request
    redirectTo = encodeURIComponent(`https://${req.headers.host}/auth/callback`);
    console.log('Using Vercel domain from request host');
  } else if (process.env.VERCEL_URL) {
    // Use Vercel environment variable
    redirectTo = encodeURIComponent(`https://${process.env.VERCEL_URL}/auth/callback`);
    console.log('Using VERCEL_URL environment variable');
  } else {
    // Fallback - but this should not happen on Vercel
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    redirectTo = encodeURIComponent(`${protocol}://${host}/auth/callback`);
    console.log('Using fallback method');
  }
  */
  
  const redirectUrl = `${baseUrl}/auth/v1/authorize?provider=discord&redirect_to=${redirectTo}`;
  console.log('Final redirect URL:', redirectUrl);
  console.log('Decoded redirect_to:', decodeURIComponent(redirectTo));
  console.log('Supabase base URL:', baseUrl);
  console.log('Expected callback URL:', decodeURIComponent(redirectTo));
  console.log('=== IMPORTANT: Discord OAuth redirect should be Supabase callback ===');
  console.log('Discord OAuth redirect URL should be:', `${baseUrl}/auth/v1/callback`);
  
  // Also try to get current Supabase auth settings
  console.log('Environment variables check:', {
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY ? 'exists' : 'missing'
  });
  
  // Check if we can access Supabase auth settings
  console.log('Supabase auth URL should be:', `${baseUrl}/auth/v1/authorize`);
  console.log('Discord callback URL should be:', `${baseUrl}/auth/v1/callback`);
  
  // Test if Supabase auth endpoint is accessible
  try {
    const testResponse = await axios.get(`${baseUrl}/auth/v1/authorize?provider=discord`, {
      timeout: 5000,
      validateStatus: () => true // Accept any status code
    });
    console.log('Supabase auth endpoint test:', {
      status: testResponse.status,
      accessible: testResponse.status < 500
    });
  } catch (error) {
    console.log('Supabase auth endpoint test failed:', error.message);
  }
  
  res.redirect(redirectUrl);
});

// Handle Supabase OAuth callback redirect
app.get('/auth/callback', async (req, res) => {
  console.log('=== Supabase OAuth callback redirect received ===');
  console.log('Callback URL:', req.url);
  console.log('Callback query params:', req.query);
  console.log('Callback cookies:', req.cookies);
  console.log('Callback headers:', {
    'user-agent': req.headers['user-agent'],
    'referer': req.headers.referer,
    'host': req.headers.host
  });
  console.log('=== DEBUGGING INFO ===');
  console.log('Has code parameter:', !!req.query.code);
  console.log('Has error parameter:', !!req.query.error);
  console.log('Has state parameter:', !!req.query.state);
  console.log('All query parameters:', Object.keys(req.query));
  console.log('Full URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => {
          const value = req.cookies[name];
          console.log(`Callback getting cookie ${name}:`, value ? 'exists' : 'missing');
          return value;
        },
        set: (name, value, options) => {
          console.log(`Callback setting cookie ${name}:`, 'exists');
          res.cookie(name, value, options);
        },
        remove: (name, options) => {
          console.log(`Callback removing cookie ${name}`);
          res.clearCookie(name, options);
        },
      },
    }
  );

  try {
    // Handle different OAuth response types
    if (req.query.code) {
      console.log('OAuth code found, exchanging for session');
      const { data, error } = await supabase.auth.exchangeCodeForSession(req.query.code);
      console.log('Code exchange result:', { data, error });
      
      if (error) {
        console.error('Error exchanging code for session:', error);
        return res.redirect('/?error=oauth_error');
      }
      
      if (data.session) {
        console.log('Session created from code exchange:', {
          userId: data.session.user?.id,
          hasProviderToken: !!data.session.provider_token
        });
      }
    } else if (req.query.access_token) {
      console.log('Access token found, setting session');
      // Handle implicit flow with access token
      const { data, error } = await supabase.auth.setSession({
        access_token: req.query.access_token,
        refresh_token: req.query.refresh_token || ''
      });
      console.log('Session set result:', { data, error });
      
      if (error) {
        console.error('Error setting session:', error);
        return res.redirect('/?error=session_error');
      }
    } else {
      console.log('No OAuth parameters found in callback');
      return res.redirect('/?error=no_oauth_params');
    }
    
    // Get the session to verify it was created
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Callback session check:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      error: sessionError,
      cookiesAfter: Object.keys(req.cookies)
    });
    
    if (session) {
      console.log('Session created successfully, redirecting to dashboard');
      res.redirect('/dashboard.html');
    } else {
      console.log('No session found after callback, redirecting to home');
      res.redirect('/?error=no_session');
    }
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect('/?error=callback_error');
  }
});

// Handle OAuth callback (legacy route)
app.get('/auth/callback-legacy', async (req, res) => {
  console.log('=== OAuth callback received ===');
  console.log('Callback URL:', req.url);
  console.log('Callback query params:', req.query);
  console.log('Callback cookies:', req.cookies);
  console.log('Callback headers:', {
    'user-agent': req.headers['user-agent'],
    'referer': req.headers.referer,
    'host': req.headers.host
  });
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  try {
    // First, try to exchange the code for a session
    if (req.query.code) {
      console.log('OAuth code found, exchanging for session');
      const { data, error } = await supabase.auth.exchangeCodeForSession(req.query.code);
      console.log('Code exchange result:', { data, error });
    }
    
    // Then get the session
    const { data, error } = await supabase.auth.getSession();
    console.log('Callback session data:', data);
    console.log('Callback session error:', error);
    
    if (data.session) {
      console.log('Session found in callback, redirecting to dashboard');
      res.redirect('/dashboard.html');
    } else {
      console.log('No session in callback, redirecting to home');
      res.redirect('/');
    }
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect('/');
  }
});

// Handle post-authentication and dashboard
app.get('/dashboard.html', async (req, res, next) => {
  console.log('=== /dashboard.html endpoint called ===');
  console.log('Dashboard request cookies:', req.cookies);
  console.log('Dashboard request query:', req.query);
  console.log('Dashboard request headers:', {
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-forwarded-host': req.headers['x-forwarded-host'],
    'referer': req.headers.referer
  });
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => {
          const value = req.cookies[name];
          console.log(`Dashboard getting cookie ${name}:`, value ? 'exists' : 'missing');
          return value;
        },
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('Dashboard session exists:', !!session);
  console.log('Dashboard session user:', session?.user?.id);
  console.log('Dashboard session error:', sessionError);
  console.log('Dashboard session data:', session);
  
  if (!session) {
    console.log('No session found in dashboard, redirecting to home');
    console.log('Available cookies:', Object.keys(req.cookies));
    return res.redirect('/');
  }

  // Sync Discord user data
  const { data: { user } } = await supabase.auth.getUser();
  if (user && session.provider_token) {
    try {
      const discordResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${session.provider_token}` },
      });
      const discordUser = discordResponse.data;
      
      // Handle modern Discord username format (no discriminator)
      const username = discordUser.discriminator && discordUser.discriminator !== '0' 
        ? `${discordUser.username}#${discordUser.discriminator}`
        : discordUser.global_name || discordUser.username;
      
      // Handle avatar URL construction
      const avatarUrl = discordUser.avatar 
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${discordUser.discriminator % 5}.png`;

      req.session.user = {
        username: username,
        avatar: avatarUrl,
      };

      // Store in Supabase DB
      await supabase.from('users').upsert({
        id: user.id,
        discord_id: discordUser.id,
        username: username,
        avatar: avatarUrl,
      }, { onConflict: 'id' });
    } catch (error) {
      console.error('Error fetching Discord user data:', error);
      // Fallback to basic user info from Supabase
      req.session.user = {
        username: user.user_metadata?.full_name || user.email || 'Discord User',
        avatar: user.user_metadata?.avatar_url || '',
      };
    }
  } else if (user) {
    // Fallback when no provider token is available
    req.session.user = {
      username: user.user_metadata?.full_name || user.email || 'Discord User',
      avatar: user.user_metadata?.avatar_url || '',
    };
  }

  next();
});

app.get('/get-user', async (req, res) => {
  console.log('=== /get-user endpoint called ===');
  console.log('Environment check:', {
    'SUPABASE_URL exists': !!process.env.SUPABASE_URL,
    'SUPABASE_ANON_KEY exists': !!process.env.SUPABASE_ANON_KEY,
    'SUPABASE_URL': process.env.SUPABASE_URL ? 'set' : 'missing'
  });
  console.log('Request cookies:', req.cookies);
  console.log('Request headers:', {
    'user-agent': req.headers['user-agent'],
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-forwarded-host': req.headers['x-forwarded-host']
  });
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => {
          const value = req.cookies[name];
          console.log(`Getting cookie ${name}:`, value ? 'exists' : 'missing');
          return value;
        },
        set: (name, value, options) => {
          console.log(`Setting cookie ${name}:`, 'exists');
          res.cookie(name, value, options);
        },
        remove: (name, options) => {
          console.log(`Removing cookie ${name}`);
          res.clearCookie(name, options);
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('User exists:', !!user);
  console.log('User ID:', user?.id);
  console.log('User error:', userError);
  console.log('All cookies received:', Object.keys(req.cookies));
  
  if (user) {
    console.log('User found, processing user data...');
    console.log('User data:', {
      id: user?.id,
      email: user?.email,
      user_metadata: user?.user_metadata
    });
    
    // Note: provider_token is not available in getUser() response
    // We'll use the user metadata instead
    if (user.user_metadata?.provider_id) {
      try {
        console.log('Using user metadata for Discord data...');
        console.log('Provider ID exists:', !!user.user_metadata.provider_id);
        
        // Use the metadata we already have instead of making API calls
        const discordUser = {
          id: user.user_metadata.provider_id,
          username: user.user_metadata.full_name,
          global_name: user.user_metadata.custom_claims?.global_name,
          avatar: user.user_metadata.avatar_url
        };
        console.log('Discord user data:', {
          id: discordUser.id,
          username: discordUser.username,
          global_name: discordUser.global_name,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar
        });
        
        // Handle modern Discord username format (no discriminator)
        const username = discordUser.global_name || discordUser.username;
        
        // Use the avatar URL from metadata (already includes full URL)
        const avatarUrl = discordUser.avatar;

        const result = {
          username: username,
          avatar: avatarUrl,
          discord_id: discordUser.id,
        };
        console.log('Returning Discord data:', result);
        
        // Ensure user exists in server_owners table
        await ensureServerOwnerExists(supabase, user.id, discordUser.id);
        
        res.json(result);
        return;
      } catch (error) {
        console.error('Error fetching Discord user data:', error.response?.data || error.message);
        console.error('Error status:', error.response?.status);
        console.error('Error headers:', error.response?.headers);
        // Fall through to fallback
      }
    } else {
      console.log('No provider token available');
    }
    
    // Fallback to basic user info from Supabase
    const fallbackResult = {
      username: user.user_metadata?.full_name || user.email || 'Discord User',
      avatar: user.user_metadata?.avatar_url || '',
    };
    console.log('Returning fallback data:', fallbackResult);
    
    // Ensure user exists in server_owners table even for fallback
    const discordUserId = user.user_metadata?.provider_id;
    if (discordUserId) {
      await ensureServerOwnerExists(supabase, user.id, discordUserId);
    }
    
    res.json(fallbackResult);
  } else {
    console.log('No user found, returning null');
    console.log('User check details:', {
      hasUser: !!user,
      userError: userError
    });
    res.json(null);
  }
});

app.get('/logout', async (req, res) => {
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  await supabase.auth.signOut();
  res.redirect('/');
});

// ===== SERVER MANAGEMENT API ENDPOINTS =====

// Get user's Discord servers (servers they manage)
app.get('/api/servers', async (req, res) => {
  console.log('=== /api/servers endpoint called ===');
  
  // Set no-cache headers to prevent Vercel from caching responses
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    console.log('User authenticated successfully');
    
    // Get Discord ID from user metadata
    console.log('Session user ID:', user?.id);
    const discordUserId = user?.user_metadata?.provider_id;
    
    console.log('Discord user ID from metadata:', discordUserId);
    
    if (!discordUserId) {
      console.error('No Discord user ID found in user metadata');
      return res.status(400).json({ error: 'Discord user ID not found. Please re-authenticate with Discord.' });
    }

    // For now, return a placeholder response since we can't fetch Discord servers without the provider token
    // This is a limitation of the current Supabase Discord OAuth setup
    console.log('Discord provider token not available - returning placeholder response');
    
    // Get servers from our database
    console.log('Querying database for configured servers...');
    const { data: dbServers, error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('owner_id', user.id);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    console.log('Database servers found:', dbServers?.length || 0);

    // Return a message explaining the limitation
    res.json({
      message: 'Discord server fetching requires additional OAuth setup. Please configure your Discord servers manually.',
      discord_user_id: discordUserId,
      configured_servers: dbServers || [],
      setup_required: true
    });
    
  } catch (error) {
    console.error('Error fetching servers:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
    res.status(500).json({ 
      error: 'Failed to fetch servers', 
      details: error.message,
      status: error.response?.status 
    });
  }
});

// Create or update server configuration
app.post('/api/servers/:serverId/configure', async (req, res) => {
  console.log('=== /api/servers/:serverId/configure endpoint called ===');
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { serverId } = req.params;
  const { serverName } = req.body;

  try {
    console.log('Server ID:', serverId);
    console.log('Server Name:', serverName);
    console.log('User ID:', user.id);
    
    // Try to fetch Discord server name from Discord API
    let actualServerName = serverName || `Server ${serverId}`;
    
    try {
      // Try to get server info from Discord API (this might work for public servers)
      console.log('Attempting to fetch Discord server info...');
      const discordResponse = await axios.get(`https://discord.com/api/guilds/${serverId}`, {
        headers: { 
          'User-Agent': 'DiscordBot (https://discord.com/api, 1.0)',
        },
        timeout: 5000
      });
      
      if (discordResponse.data && discordResponse.data.name) {
        actualServerName = discordResponse.data.name;
        console.log('Fetched Discord server name:', actualServerName);
      }
    } catch (error) {
      console.log('Could not fetch Discord server name, using provided name:', actualServerName);
    }
    
    // Generate a real Discord invite code
    let inviteCode = null;
    let actualInviteUrl = null;
    let targetGuild = null;
    
    // Try to create a real Discord invite if bot is available
    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        console.log('Creating real Discord invite using bot utilities...');
        
        // Use the shared bot utility
        const { generateDiscordInvite } = require('./bot-utils');
        const botResponse = await generateDiscordInvite(serverId, {
          maxAge: 0,
          maxUses: 0
        });
        
        if (botResponse.success) {
          inviteCode = botResponse.invite_code;
          actualInviteUrl = botResponse.invite_url;
          actualServerName = botResponse.server_name;
          targetGuild = botResponse.guild_info; // Set targetGuild from bot response
          console.log(`✅ Created real Discord invite: ${actualInviteUrl}`);
          console.log(`✅ Discord invite code: ${inviteCode}`);
          console.log(`✅ Server icon from bot: ${botResponse.server_icon}`);
        } else {
          console.log('Bot utility failed:', botResponse.error);
          // Fall through to fallback
        }
      } catch (error) {
        console.error('Error creating Discord invite via bot utility:', error.message);
        // Fall through to fallback
      }
    }
    
    // Fallback to random code if Discord invite creation failed
    if (!inviteCode) {
      inviteCode = crypto.randomBytes(8).toString('hex');
      console.log('Using fallback random invite code:', inviteCode);
    }

    // Create or update server in database
    console.log('Creating/updating server in database...');
    console.log('User metadata:', user.user_metadata);
    console.log('Provider ID:', user.user_metadata?.provider_id);
    
    // Check if there's existing tracking data for this server
    const { data: existingTracking, error: trackingCheckError } = await supabase
      .from('affiliate_tracking')
      .select('id, affiliate_id, click_timestamp, conversion_status')
      .eq('discord_server_id', serverId);
    
    if (trackingCheckError) {
      console.error('Error checking existing tracking data:', trackingCheckError);
    } else if (existingTracking && existingTracking.length > 0) {
      console.log(`📊 Found ${existingTracking.length} existing tracking records for this server`);
    }
    
    // Get server icon URL if available
    let serverIconUrl = null;
    console.log('Server icon debug - targetGuild:', targetGuild);
    console.log('Server icon debug - targetGuild.icon:', targetGuild?.icon);
    
    if (targetGuild && targetGuild.icon) {
      serverIconUrl = `https://cdn.discordapp.com/icons/${serverId}/${targetGuild.icon}.png`;
      console.log('Server icon URL constructed:', serverIconUrl);
    } else {
      console.log('No server icon found - targetGuild:', !!targetGuild, 'icon:', targetGuild?.icon);
    }
    
    // Get user's Discord role if available
    let userRole = 'Member'; // Default fallback
    if (targetGuild && user.user_metadata?.provider_id) {
      try {
        userRole = await getUserDiscordRole(serverId, user.user_metadata.provider_id);
        console.log('Storing user role:', userRole);
      } catch (error) {
        console.log('Could not fetch user role, using default:', userRole);
      }
    } else if (!targetGuild) {
      // Bot not in server - show instruction
      userRole = 'Add Bot to Server';
    }
    
    // Check if this user already has this server
    const { data: existingServer, error: checkError } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('owner_id', user.id)
      .eq('discord_server_id', serverId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing server:', checkError);
      return res.status(500).json({ error: 'Database error', details: checkError.message });
    }

    let serverResult;
    let error;
    let ownerDiscordId = user.user_metadata?.provider_id || null;

    if (existingServer) {
      // Update existing server record for this user
      console.log('Updating existing server record for user');
      const { data, error: updateError } = await supabase
        .from('discord_servers')
        .update({
          server_name: actualServerName,
          server_icon: serverIconUrl,
          user_role: userRole,
          invite_code: inviteCode,
          owner_discord_id: ownerDiscordId,
          updated_at: new Date().toISOString()
        })
        .eq('owner_id', user.id)
        .eq('discord_server_id', serverId)
        .select();
      
      serverResult = data;
      error = updateError;

      if (!ownerDiscordId && serverResult && serverResult.length > 0) {
        ownerDiscordId = serverResult[0]?.owner_discord_id || ownerDiscordId;
      }
    } else {
      // Create new server record for this user
      console.log('Creating new server record for user');
      const { data, error: insertError } = await supabase
        .from('discord_servers')
        .insert({
          owner_id: user.id,
          discord_server_id: serverId,
          server_name: actualServerName,
          server_icon: serverIconUrl,
          user_role: userRole,
          invite_code: inviteCode,
          owner_discord_id: ownerDiscordId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      serverResult = data;
      error = insertError;

      if (!ownerDiscordId && serverResult && serverResult.length > 0) {
        ownerDiscordId = serverResult[0]?.owner_discord_id || ownerDiscordId;
      }
    }

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    console.log('Server configured successfully in database');
    console.log('ServerResult:', serverResult);

    // Refresh owner-specific stats so dashboard shows accurate conversion metrics
    try {
      const statsClient = supabaseServiceClient || supabase;
      if (ownerDiscordId) {
        const { error: statsError } = await statsClient.rpc('update_user_server_stats', {
          p_discord_server_id: serverId,
          p_owner_discord_id: ownerDiscordId
        });

        if (statsError) {
          console.warn('⚠️ Failed to update user server stats after configure:', statsError);
        } else {
          console.log('✅ User-specific stats refreshed for owner:', ownerDiscordId);
        }
      } else {
        console.log('⚠️ No owner Discord ID available; skipping stats refresh.');
      }
    } catch (statsException) {
      console.warn('⚠️ Exception while updating user stats after configure:', statsException);
    }
    
    // Restore affiliate tracking data if it exists
    if (existingTracking && existingTracking.length > 0) {
      console.log(`📊 Found ${existingTracking.length} existing tracking records, restoring...`);
      
      // Get the server ID - handle different response structures
      let serverIdForRestoration;
      if (serverResult && serverResult.length > 0) {
        serverIdForRestoration = serverResult[0].id;
      } else {
        // If upsert didn't return data, fetch the server record
        console.log('ServerResult is empty, fetching server record...');
        const { data: fetchedServer, error: fetchError } = await supabase
          .from('discord_servers')
          .select('id')
          .eq('discord_server_id', serverId)
          .single();
          
        if (fetchError || !fetchedServer) {
          console.error('Error fetching server record for restoration:', fetchError);
          return res.status(500).json({ error: 'Failed to restore tracking data', details: fetchError?.message });
        }
        
        serverIdForRestoration = fetchedServer.id;
        console.log('Fetched server ID for restoration:', serverIdForRestoration);
      }
      
      // Update affiliate tracking records to link them to the new server configuration
      const { error: restoreError } = await supabase
        .from('affiliate_tracking')
        .update({ 
          server_id: serverIdForRestoration, // Link to the new server record
          updated_at: new Date().toISOString()
        })
        .eq('discord_server_id', serverId)
        .is('server_id', null); // Only update records that were unlinked
      
      if (restoreError) {
        console.error('Error restoring tracking data:', restoreError);
      } else {
        console.log(`✅ Successfully restored ${existingTracking.length} affiliate tracking records for server ${serverId}`);
        
        // Update the server click count to match the restored tracking data
        const { error: countUpdateError } = await supabase
          .from('discord_servers')
          .update({ 
            total_invite_clicks: existingTracking.length,
            updated_at: new Date().toISOString()
          })
          .eq('discord_server_id', serverId);
          
        if (countUpdateError) {
          console.error('Error updating server click count after restoration:', countUpdateError);
        } else {
          console.log(`✅ Updated server click count to ${existingTracking.length}`);
        }
      }
    }
    
    res.json({ 
      success: true, 
      invite_code: inviteCode,
      server_name: actualServerName,
      server_id: serverId,
      tracking_restored: existingTracking ? existingTracking.length : 0
    });
  } catch (error) {
    console.error('Error configuring server:', error);
    res.status(500).json({ error: 'Failed to configure server', details: error.message });
  }
});

// Remove server configuration
app.delete('/api/servers/:serverId', async (req, res) => {
  console.log('=== /api/servers/:serverId DELETE endpoint called ===');
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { serverId } = req.params;

  try {
    console.log('Removing server:', serverId, 'for user:', user.id);
    
    // Check if there's existing affiliate tracking data
    const { data: existingTracking, error: trackingCheckError } = await supabase
      .from('affiliate_tracking')
      .select('id, affiliate_id, click_timestamp')
      .eq('discord_server_id', serverId)
      .limit(1);

    if (trackingCheckError) {
      console.error('Error checking tracking data:', trackingCheckError);
    } else if (existingTracking && existingTracking.length > 0) {
      console.log(`⚠️ Warning: Server has ${existingTracking.length}+ affiliate tracking records that will be preserved`);
    }
    
    // Preserve affiliate tracking data before deleting server configuration
    if (existingTracking && existingTracking.length > 0) {
      console.log(`📊 Preserving ${existingTracking.length} affiliate tracking records...`);
      
      // Update affiliate tracking records to set server_id to NULL
      // This preserves the data while unlinking it from the server configuration
      const { error: preserveError } = await supabase
        .from('affiliate_tracking')
        .update({ server_id: null })
        .eq('discord_server_id', serverId);
        
      if (preserveError) {
        console.error('Error preserving tracking data:', preserveError);
        console.error('Proceeding with server deletion anyway...');
      } else {
        console.log('✅ Successfully preserved affiliate tracking data');
      }
    }
    
    // Delete server configuration (tracking data is now preserved with server_id = NULL)
    const { error } = await supabase
      .from('discord_servers')
      .delete()
      .eq('discord_server_id', serverId)
      .eq('owner_id', user.id);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    console.log('Server configuration removed successfully (tracking data preserved)');
    res.json({ 
      success: true, 
      message: 'Server removed successfully. Your affiliate tracking data has been preserved and will be restored if you re-add this server.',
      tracking_preserved: existingTracking && existingTracking.length > 0,
      tracking_count: existingTracking ? existingTracking.length : 0
    });
  } catch (error) {
    console.error('Error removing server:', error);
    res.status(500).json({ error: 'Failed to remove server', details: error.message });
  }
});

// Generate Discord invite link
app.post('/api/servers/:serverId/invite', async (req, res) => {
  console.log('=== /api/servers/:serverId/invite endpoint called ===');
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { serverId } = req.params;

  try {
    // Get server from database
    const { data: dbServer, error: dbError } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('discord_server_id', serverId)
      .eq('owner_id', user.id)
      .single();

    if (dbError || !dbServer) {
      return res.status(404).json({ error: 'Server not configured' });
    }

    // Check if Discord bot token is available
    if (!process.env.DISCORD_BOT_TOKEN) {
      return res.status(503).json({ 
        success: false, 
        error: 'Discord bot is not configured. Please add DISCORD_BOT_TOKEN environment variable.',
        details: 'The bot token is required to generate invites.'
      });
    }

    // Use the shared bot utility for invite generation
    console.log('Creating invite using bot utilities...');
    
    const { generateDiscordInvite } = require('./bot-utils');
    const botResponse = await generateDiscordInvite(serverId, {
      maxAge: 0,
      maxUses: 0
    });
    
    if (!botResponse.success) {
      return res.status(500).json({
        success: false,
        error: botResponse.error || 'Failed to create invite',
        details: botResponse.error || 'Unknown error occurred'
      });
    }
    
    const invite = botResponse;
    console.log(`✅ Created invite via bot utility: ${invite.invite_url}`);

    // Update database with the new invite code
    console.log('Updating database with invite code:', invite.invite_code);
    console.log('For server ID:', serverId, 'and user ID:', user.id);
    
    const { error: updateError } = await supabase
      .from('discord_servers')
      .update({ 
        invite_code: invite.invite_code,
        updated_at: new Date().toISOString()
      })
      .eq('discord_server_id', serverId)
      .eq('owner_id', user.id);

    if (updateError) {
      console.error('Error updating database with invite code:', updateError);
    } else {
      console.log('Successfully updated database with invite code:', invite.invite_code);
    }

    res.json({ 
      success: true, 
      invite_url: invite.invite_url,
      invite_code: invite.invite_code
    });
    
  } catch (error) {
    console.error('Error creating invite via bot API:', error.response?.data || error.message);
    
    // Handle specific Discord API errors
    if (error.response?.status === 404) {
      res.status(404).json({ 
        success: false, 
        error: 'Server not found or bot not in server. Please add the bot to your Discord server.',
        details: 'Make sure the bot is added to your server with proper permissions.'
      });
    } else if (error.response?.status === 403) {
      res.status(403).json({ 
        success: false, 
        error: 'Bot does not have permission to create invites in this server.',
        details: 'Please ensure the bot has "Create Instant Invite" permission.'
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to create invite',
        details: error.response?.data?.error || error.message
      });
    }
  }
});

// Health check endpoint for Discord bot (uses shared utility)
app.get('/api/bot/health', async (req, res) => {
  try {
    // Use the shared bot utility for health check
    const { checkBotHealth } = require('./bot-utils');
    const botResponse = await checkBotHealth();
    res.json(botResponse);
  } catch (error) {
    console.error('Bot health check failed:', error.message);
    res.json({
      status: 'error',
      bot_configured: !!process.env.DISCORD_BOT_TOKEN,
      bot_online: false,
      error: error.message
    });
  }
});

// Get server statistics
app.get('/api/servers/:serverId/stats', async (req, res) => {
  console.log('=== /api/servers/:serverId/stats endpoint called ===');
  
  // Set no-cache headers to prevent Vercel from caching responses
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { serverId } = req.params;

  try {
    // Get server from database
    const { data: dbServer, error: dbError } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('discord_server_id', serverId)
      .eq('owner_id', user.id)
      .single();

    if (dbError || !dbServer) {
      return res.status(404).json({ error: 'Server not configured' });
    }

    // Get basic server info from Discord API
    const discordResponse = await axios.get(`https://discord.com/api/guilds/${serverId}`, {
      headers: { Authorization: `Bearer ${session.provider_token}` },
    });

    const serverInfo = discordResponse.data;

    // TODO: Add more detailed statistics in future phases
    const stats = {
      member_count: serverInfo.approximate_member_count || 0,
      server_name: serverInfo.name,
      server_icon: serverInfo.icon ? `https://cdn.discordapp.com/icons/${serverId}/${serverInfo.icon}.png` : null,
      invite_code: dbServer.invite_code,
      created_at: dbServer.created_at
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching server stats:', error);
    res.status(500).json({ error: 'Failed to fetch server statistics' });
  }
});

// Dashboard authentication is handled by the route itself

// Catch-all route for any other OAuth callbacks
app.get('*', (req, res, next) => {
  console.log('=== Catch-all route hit ===');
  console.log('Catch-all URL:', req.url);
  console.log('Catch-all query params:', req.query);
  
  // Check if this is an OAuth callback (has access_token in query or hash)
  if (req.query.access_token || req.url.includes('access_token') || req.url.includes('#')) {
    console.log('OAuth callback detected in catch-all route, redirecting to callback handler');
    console.log('Catch-all URL with hash:', req.url);
    // Convert hash parameters to query parameters for the callback handler
    const hashIndex = req.url.indexOf('#');
    if (hashIndex !== -1) {
      const hashParams = req.url.substring(hashIndex + 1);
      return res.redirect('/auth/callback?' + hashParams);
    }
    return res.redirect('/auth/callback' + req.url.substring(req.url.indexOf('?')));
  }
  
  // Continue to static file serving
  next();
});

// Helper function to ensure server_owner exists
async function ensureServerOwnerExists(supabase, userId, discordUserId) {
  try {
    console.log('Ensuring server_owner exists for user:', userId, 'discord:', discordUserId);
    
    const { data, error } = await supabase
      .from('server_owners')
      .upsert({
        id: userId,
        discord_user_id: discordUserId,
        email: null, // Will be updated if available
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Error ensuring server_owner exists:', error);
    } else {
      console.log('Server_owner ensured successfully');
    }
  } catch (error) {
    console.error('Error in ensureServerOwnerExists:', error);
  }
}

// Track invite clicks for affiliate analytics
async function trackInviteClick(inviteCode, affiliateId = null) {
  try {
    console.log('=== trackInviteClick called ===');
    console.log('Invite code:', inviteCode);
    console.log('Affiliate ID:', affiliateId);
    
    // Use anon key with public access for tracking
    const supabase = createServerClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        cookies: {
          get: () => null,
          set: () => {},
          remove: () => {},
        },
      }
    );

    // Find the server by invite code
    const { data: server, error: serverError } = await supabase
      .from('discord_servers')
      .select('id, discord_server_id')
      .eq('invite_code', inviteCode)
      .single();

    console.log('Server lookup result:', { server, serverError });

    if (serverError) {
      console.error('Error finding server by invite code:', serverError);
      return;
    }

    if (server) {
      // Create affiliate tracking record
      const { error: trackingError } = await supabase
        .from('affiliate_tracking')
        .insert({
          server_id: server.id,
          discord_server_id: server.discord_server_id,
          invite_code: inviteCode,
          affiliate_id: affiliateId,
          conversion_status: 'clicked'
        });

      if (trackingError) {
        console.error('Error creating affiliate tracking record:', trackingError);
        console.error('Tracking error details:', JSON.stringify(trackingError, null, 2));
      } else {
        console.log('✅ Successfully created affiliate tracking record');
        // Update server stats - get current count and increment
        console.log('Updating server click count...');
        
        try {
          // Get current count
          const { data: currentServer, error: currentServerError } = await supabase
            .from('discord_servers')
            .select('total_invite_clicks')
            .eq('discord_server_id', server.discord_server_id)
            .single();

          if (currentServerError) {
            console.error('Error getting current server stats:', currentServerError);
            console.error('Current server error details:', JSON.stringify(currentServerError, null, 2));
          } else {
            const currentClicks = currentServer?.total_invite_clicks || 0;
            console.log(`Current clicks: ${currentClicks}, incrementing to: ${currentClicks + 1}`);
            
            // Update the count
            const { error: updateError } = await supabase
              .from('discord_servers')
              .update({ 
                total_invite_clicks: currentClicks + 1,
                updated_at: new Date().toISOString()
              })
              .eq('discord_server_id', server.discord_server_id);
              
            if (updateError) {
              console.error('Error updating server click count:', updateError);
              console.error('Update error details:', JSON.stringify(updateError, null, 2));
            } else {
              console.log('✅ Successfully updated server click count');
            }
          }
        } catch (updateError) {
          console.error('Exception during server count update:', updateError);
        }
        
        console.log('Tracked affiliate invite click for server:', server.discord_server_id, 'affiliate:', affiliateId);
      }
    }
  } catch (error) {
    console.error('Error tracking affiliate invite click:', error);
  }
}

// Handle invite redirects
app.get('/invite/:inviteCode', async (req, res) => {
  const { inviteCode } = req.params;
  const { affiliate } = req.query; // Get affiliate ID from URL parameter
  console.log('=== Invite redirect called ===');
  console.log('Invite code:', inviteCode);
  console.log('Affiliate ID:', affiliate);
  
  // Track the invite click with affiliate information
  try {
    await trackInviteClick(inviteCode, affiliate);
    console.log('✅ Click tracking completed successfully');
  } catch (trackingError) {
    console.error('❌ Error in click tracking:', trackingError);
    // Continue with redirect even if tracking fails
  }
  
  // Create a public client for invite lookups (bypasses RLS)
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  try {
    // Look up the invite code in the database
    console.log('Looking up invite code in database:', inviteCode);
    
    // First, let's try to get all records to see what's in the database
    const { data: allServers, error: allError } = await supabase
      .from('discord_servers')
      .select('*');
    
    console.log('All servers in database:', allServers);
    console.log('All servers error:', allError);
    
    // Now try the specific query
    const { data: server, error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();

    console.log('Database query result:', { server, error });
    
    if (error || !server) {
      console.log('Invite code not found:', inviteCode);
      console.log('Database error:', error);
      return res.status(404).send(`
        <html>
          <head><title>Invite Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Invite Not Found</h1>
            <p>This invite link is invalid or has expired.</p>
            <a href="/">Return to Dashboard</a>
          </body>
        </html>
      `);
    }

    // Redirect to the actual Discord invite
    const discordInviteUrl = `https://discord.gg/${inviteCode}`;
    console.log('Redirecting to Discord invite:', discordInviteUrl);
    
    res.redirect(discordInviteUrl);
  } catch (error) {
    console.error('Error handling invite redirect:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error</h1>
          <p>An error occurred while processing the invite.</p>
          <a href="/">Return to Dashboard</a>
        </body>
      </html>
    `);
  }
});

// ===== STRIPE INTEGRATION ENDPOINTS =====

// Create Stripe checkout session for server subscription
app.post('/api/stripe/create-checkout', async (req, res) => {
  console.log('=== /api/stripe/create-checkout endpoint called ===');
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { serverId, priceId } = req.body;
    
    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' });
    }

    console.log(`Creating checkout session for server: ${serverId}`);

    // Get user's email and Discord ID
    const email = user.email;
    const discordUserId = user.user_metadata?.provider_id;

    if (!email || !discordUserId) {
      return res.status(400).json({ error: 'User email or Discord ID not found' });
    }

    // Create or get Stripe customer
    const customerResult = await createOrGetCustomer(discordUserId, email);
    if (!customerResult.success) {
      return res.status(500).json({ error: 'Failed to create customer', details: customerResult.error });
    }

    // Get server info
    const { data: server, error: serverError } = await supabase
      .from('discord_servers')
      .select('server_name')
      .eq('discord_server_id', serverId)
      .eq('owner_id', user.id)
      .single();

    if (serverError || !server) {
      return res.status(404).json({ error: 'Server not found or not owned by user' });
    }

    // Resolve Stripe price ID
    let effectivePriceId = priceId;

    if (!effectivePriceId && supabaseServiceClient) {
      const { data: serverSettings, error: settingsError } = await supabaseServiceClient
        .from('server_settings')
        .select('stripe_price_id')
        .eq('discord_server_id', serverId)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.warn('⚠️ Unable to load server settings during checkout:', settingsError);
      } else if (serverSettings?.stripe_price_id) {
        effectivePriceId = serverSettings.stripe_price_id;
      }
    }

    if (!effectivePriceId && STRIPE_DEFAULT_PRICE_ID) {
      effectivePriceId = STRIPE_DEFAULT_PRICE_ID;
    }

    if (!effectivePriceId) {
      return res.status(400).json({ error: 'Stripe price ID not configured for this server.' });
    }

    // Persist the Stripe price for this server
    if (supabaseServiceClient) {
      const { error: upsertError } = await supabaseServiceClient
        .from('server_settings')
        .upsert({
          discord_server_id: serverId,
          stripe_price_id: effectivePriceId,
          updated_at: new Date().toISOString()
        });

      if (upsertError) {
        console.warn('⚠️ Failed to persist server settings:', upsertError);
      }
    }

    // Create checkout session
    const successUrl = `${req.protocol}://${req.get('host')}/dashboard.html?subscription=success`;
    const cancelUrl = `${req.protocol}://${req.get('host')}/dashboard.html?subscription=cancelled`;

    const checkoutResult = await createCheckoutSession(
      customerResult.customerId,
      serverId,
      server.server_name,
      effectivePriceId,
      successUrl,
      cancelUrl,
      discordUserId
    );

    if (!checkoutResult.success) {
      return res.status(500).json({ error: 'Failed to create checkout session', details: checkoutResult.error });
    }

    res.json({
      success: true,
      sessionId: checkoutResult.sessionId,
      url: checkoutResult.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
});

// Get customer's subscriptions for a server
app.get('/api/stripe/subscriptions/:serverId', async (req, res) => {
  console.log('=== /api/stripe/subscriptions/:serverId endpoint called ===');
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies[name],
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { serverId } = req.params;
    const discordUserId = user.user_metadata?.provider_id;

    if (!discordUserId) {
      return res.status(400).json({ error: 'Discord user ID not found' });
    }

    // Get customer's subscriptions for this server
    const subscriptionResult = await getCustomerSubscriptions(discordUserId, serverId);
    
    if (!subscriptionResult.success) {
      return res.status(500).json({ error: 'Failed to fetch subscriptions', details: subscriptionResult.error });
    }

    res.json({
      success: true,
      subscriptions: subscriptionResult.subscriptions
    });

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions', details: error.message });
  }
});

// === Member-facing Stripe endpoints (triggered by bot slash commands) ===

function validateBotRequest(req, res) {
  if (!BOT_API_TOKEN) {
    res.status(500).json({ success: false, error: 'Bot token not configured' });
    return false;
  }

  const token = req.headers['x-bot-token'];
  if (!token || token !== BOT_API_TOKEN) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }

  return true;
}

app.post('/api/stripe/member/checkout', async (req, res) => {
  console.log('=== /api/stripe/member/checkout endpoint called ===');

  if (!validateBotRequest(req, res)) {
    return;
  }

  try {
    const {
      discordUserId,
      discordUsername,
      serverId,
      serverName,
      priceId,
      successUrl,
      cancelUrl
    } = req.body || {};

    if (!discordUserId || !serverId || !serverName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (discordUserId, serverId, serverName)'
      });
    }

    const checkoutResult = await createMemberCheckoutSession({
      discordUserId,
      discordUsername,
      serverId,
      serverName,
      priceId: priceId || STRIPE_DEFAULT_PRICE_ID,
      successUrl,
      cancelUrl
    });

    if (!checkoutResult.success) {
      return res.status(500).json(checkoutResult);
    }

    return res.json({
      success: true,
      url: checkoutResult.url
    });
  } catch (error) {
    console.error('Error creating member checkout session:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/stripe/member/portal', async (req, res) => {
  console.log('=== /api/stripe/member/portal endpoint called ===');

  if (!validateBotRequest(req, res)) {
    return;
  }

  try {
    const { discordUserId, serverId, returnUrl } = req.body || {};

    if (!discordUserId || !serverId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (discordUserId, serverId)'
      });
    }

    const portalResult = await createMemberPortalSession({
      discordUserId,
      serverId,
      returnUrl
    });

    if (!portalResult.success) {
      return res.status(400).json(portalResult);
    }

    return res.json({
      success: true,
      url: portalResult.url
    });
  } catch (error) {
    console.error('Error creating member portal session:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;