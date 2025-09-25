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
  const redirectTo = encodeURIComponent('https://discord-login-site.vercel.app/dashboard.html');
  const redirectUrl = `${baseUrl}/auth/v1/authorize?provider=discord&redirect_to=${redirectTo}`;
  res.redirect(redirectUrl);
});

// Handle post-authentication and dashboard
app.get('/dashboard.html', async (req, res, next) => {
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
  if (!session) return res.redirect('/');

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
  if (session && session.user) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (session.provider_token) {
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

        res.json({
          username: username,
          avatar: avatarUrl,
        });
        return;
      } catch (error) {
        console.error('Error fetching Discord user data:', error);
        // Fall through to fallback
      }
    }
    
    // Fallback to basic user info from Supabase
    res.json({
      username: user.user_metadata?.full_name || user.email || 'Discord User',
      avatar: user.user_metadata?.avatar_url || '',
    });
  } else {
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