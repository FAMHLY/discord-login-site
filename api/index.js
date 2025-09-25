const express = require('express');
const session = require('express-session'); // Optional fallback
const axios = require('axios');
require('dotenv').config();
const path = require('path');
const { createServerClient } = require('@supabase/ssr');
const cookieParser = require('cookie-parser');

const app = express();

// Add cookie-parser for Supabase cookies
app.use(cookieParser());

// Optional session middleware (only if SESSION_SECRET is provided)
if (process.env.SESSION_SECRET) {
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }));
}

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/auth/discord', (req, res) => {
  const baseUrl = process.env.SUPABASE_URL; // Already includes https://
  
  console.log('=== Discord OAuth Debug ===');
  console.log('VERCEL_URL:', process.env.VERCEL_URL);
  console.log('Request host:', req.headers.host);
  console.log('X-Forwarded-Host:', req.headers['x-forwarded-host']);
  console.log('X-Forwarded-Proto:', req.headers['x-forwarded-proto']);
  console.log('All headers:', req.headers);
  
  // Force use of the actual Vercel domain
  let redirectTo;
  
  // Hardcode the Vercel domain for now to test
  const vercelDomain = 'discord-login-site.vercel.app';
  redirectTo = encodeURIComponent(`https://${vercelDomain}/auth/callback`);
  console.log('Using hardcoded Vercel domain:', vercelDomain);
  
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
  res.redirect(redirectUrl);
});

// Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  console.log('=== OAuth callback received ===');
  console.log('Callback query params:', req.query);
  console.log('Callback cookies:', req.cookies);
  
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

  const { data: { session } } = await supabase.auth.getSession();
  console.log('Dashboard session exists:', !!session);
  console.log('Dashboard session user:', session?.user?.id);
  
  if (!session) {
    console.log('No session found in dashboard, redirecting to home');
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
        set: (name, value, options) => res.cookie(name, value, options),
        remove: (name, options) => res.clearCookie(name, options),
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session exists:', !!session);
  console.log('Session user:', session?.user?.id);
  console.log('Provider token exists:', !!session?.provider_token);
  
  if (session && session.user) {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User data:', {
      id: user?.id,
      email: user?.email,
      user_metadata: user?.user_metadata
    });
    
    if (session.provider_token) {
      try {
        console.log('Attempting Discord API call...');
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
        };
        console.log('Returning Discord data:', result);
        res.json(result);
        return;
      } catch (error) {
        console.error('Error fetching Discord user data:', error.response?.data || error.message);
        // Fall through to fallback
      }
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
  req.session.destroy();
  res.redirect('/');
});

app.use('/dashboard.html', (req, res, next) => {
  if (!req.session.user) return res.redirect('/');
  next();
});

module.exports = app;