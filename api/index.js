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

// Supabase server client
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

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Redirect to Supabase Discord auth
app.get('/auth/discord', (req, res) => {
  const redirectUrl = `https://${process.env.SUPABASE_URL}/auth/v1/authorize?provider=discord&redirect_to=${encodeURIComponent('https://discord-login-site.vercel.app/dashboard.html')}`;
  res.redirect(redirectUrl);
});

// Handle post-authentication (optional refresh or data sync)
app.get('/dashboard.html', async (req, res, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res.redirect('/');

  // Optionally sync Discord user data
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const discordResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${session.provider_token}` },
    });
    const discordUser = discordResponse.data;
    req.session.user = {
      username: `${discordUser.username}#${discordUser.discriminator}`,
      avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`,
    };

    // Store in Supabase DB (create 'users' table if not exists)
    await supabase.from('users').upsert({
      id: user.id,
      discord_id: discordUser.id,
      username: `${discordUser.username}#${discordUser.discriminator}`,
      avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`,
    }, { onConflict: 'id' });
  }

  next();
});

app.get('/get-user', async (req, res) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    res.json({
      username: req.session.user?.username || `${session.user.user_metadata?.username}#${session.user.user_metadata?.discriminator}`,
      avatar: req.session.user?.avatar || `https://cdn.discordapp.com/avatars/${session.user.user_metadata?.sub}/${session.user.user_metadata?.picture}.png?size=128`,
    });
  } else {
    res.json(null);
  }
});

app.get('/logout', async (req, res) => {
  await supabase.auth.signOut();
  req.session.destroy();
  res.redirect('/');
});

app.use('/dashboard.html', (req, res, next) => {
  if (!req.session.user) return res.redirect('/');
  next();
});

module.exports = app;