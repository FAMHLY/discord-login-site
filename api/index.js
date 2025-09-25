const express = require('express');
const axios = require('axios');
require('dotenv').config();
const path = require('path');
const { createServerClient } = require('@supabase/ssr');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();

// Add cookie-parser for Supabase cookies
app.use(cookieParser());

// Session management is handled by Supabase

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

  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session exists:', !!session);
  console.log('Session user:', session?.user?.id);
  console.log('Provider token exists:', !!session?.provider_token);
  console.log('Session data:', session);
  console.log('All cookies received:', Object.keys(req.cookies));
  
  if (session && session.user) {
    console.log('Session found, getting user data...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User data:', {
      id: user?.id,
      email: user?.email,
      user_metadata: user?.user_metadata
    });
    
    if (session.provider_token) {
      try {
        console.log('Attempting Discord API call...');
        console.log('Provider token exists:', !!session.provider_token);
        console.log('Provider token length:', session.provider_token?.length);
        
        const discordResponse = await axios.get('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${session.provider_token}` },
        });
        const discordUser = discordResponse.data;
        console.log('Discord user data:', {
          id: discordUser.id,
          username: discordUser.username,
          global_name: discordUser.global_name,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar
        });
        
        // Handle modern Discord username format (no discriminator)
        const username = discordUser.discriminator && discordUser.discriminator !== '0' 
          ? `${discordUser.username}#${discordUser.discriminator}`
          : discordUser.global_name || discordUser.username;
        
        // Handle avatar URL construction
        const avatarUrl = discordUser.avatar 
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${discordUser.discriminator % 5}.png`;

        const result = {
          username: username,
          avatar: avatarUrl,
          discord_id: discordUser.id,
        };
        console.log('Returning Discord data:', result);
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
    res.json(fallbackResult);
  } else {
    console.log('No session found, returning null');
    console.log('Session check details:', {
      hasSession: !!session,
      sessionUser: session?.user,
      sessionError: session?.error
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

  try {
    console.log('Session provider token exists:', !!session.provider_token);
    console.log('Session user ID:', session.user.id);
    
    if (!session.provider_token) {
      console.error('No provider token available for Discord API call');
      return res.status(400).json({ error: 'No Discord access token available. Please re-authenticate.' });
    }

    // Get user's Discord servers via Discord API
    console.log('Making Discord API call to fetch guilds...');
    const discordResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${session.provider_token}` },
    });

    const discordServers = discordResponse.data;
    console.log('Discord servers fetched:', discordServers.length);
    console.log('Discord servers data:', discordServers);

    // Get servers from our database
    console.log('Querying database for configured servers...');
    const { data: dbServers, error } = await supabase
      .from('discord_servers')
      .select('*')
      .eq('owner_id', session.user.id);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    console.log('Database servers found:', dbServers?.length || 0);

    // Merge Discord API data with our database data
    const servers = discordServers.map(server => {
      const dbServer = dbServers.find(db => db.discord_server_id === server.id);
      return {
        id: server.id,
        name: server.name,
        icon: server.icon ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : null,
        owner: server.owner,
        permissions: server.permissions,
        invite_code: dbServer?.invite_code || null,
        is_configured: !!dbServer,
        created_at: dbServer?.created_at || null
      };
    });

    console.log('Returning merged servers data:', servers.length);
    res.json(servers);
  } catch (error) {
    console.error('Error fetching servers:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Discord token expired. Please re-authenticate.' });
    }
    
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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { serverId } = req.params;
  const { serverName } = req.body;

  try {
    // Verify user owns this server
    const discordResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${session.provider_token}` },
    });

    const userServers = discordResponse.data;
    const targetServer = userServers.find(server => server.id === serverId);
    
    if (!targetServer) {
      return res.status(404).json({ error: 'Server not found or not owned by user' });
    }

    // Generate a unique invite code
    const inviteCode = crypto.randomBytes(8).toString('hex');

    // Create or update server in database
    const { data, error } = await supabase
      .from('discord_servers')
      .upsert({
        owner_id: session.user.id,
        discord_server_id: serverId,
        server_name: serverName || targetServer.name,
        invite_code: inviteCode,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'discord_server_id',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ 
      success: true, 
      invite_code: inviteCode,
      server_name: serverName || targetServer.name
    });
  } catch (error) {
    console.error('Error configuring server:', error);
    res.status(500).json({ error: 'Failed to configure server' });
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
      .eq('owner_id', session.user.id)
      .single();

    if (dbError || !dbServer) {
      return res.status(404).json({ error: 'Server not configured' });
    }

    // Create Discord invite via Discord API
    const inviteData = {
      max_age: 0, // Never expires
      max_uses: 0, // Unlimited uses
      temporary: false,
      unique: true
    };

    const discordResponse = await axios.post(
      `https://discord.com/api/channels/${serverId}/invites`,
      inviteData,
      {
        headers: { 
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
      }
    );

    const invite = discordResponse.data;
    const inviteUrl = `https://discord.gg/${invite.code}`;

    res.json({ 
      success: true, 
      invite_url: inviteUrl,
      invite_code: invite.code,
      expires_at: invite.expires_at
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    
    // If bot token method fails, provide a fallback
    if (error.response?.status === 401 || error.response?.status === 403) {
      res.json({ 
        success: false, 
        error: 'Bot permissions required. Please add the bot to your server with proper permissions.',
        fallback_url: `https://discord.com/channels/${serverId}`
      });
    } else {
      res.status(500).json({ error: 'Failed to create invite' });
    }
  }
});

// Get server statistics
app.get('/api/servers/:serverId/stats', async (req, res) => {
  console.log('=== /api/servers/:serverId/stats endpoint called ===');
  
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
      .eq('owner_id', session.user.id)
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

module.exports = app;