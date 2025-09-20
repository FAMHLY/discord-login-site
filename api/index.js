const express = require('express');
const session = require('express-session');
const axios = require('axios');
require('dotenv').config();
const path = require('path');
const MemoryStore = require('memorystore')(session);

const app = express();

// Configure session middleware with MemoryStore
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Serve static files from the root public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Explicit route for root to serve index.html from the root public folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/auth/discord', (req, res) => {
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
  res.redirect(authUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  console.log('Callback received with code:', code ? 'present' : 'missing');
  if (!code) {
    console.error('No code provided in query');
    return res.send('No code provided');
  }

  try {
    console.log('Exchanging code for token...');
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response data:', tokenResponse.data);

    const { access_token } = tokenResponse.data;
    if (!access_token) {
      throw new Error('No access_token in response');
    }

    console.log('Fetching user info...');
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    console.log('User response status:', userResponse.status);
    console.log('User response data:', userResponse.data);

    const user = userResponse.data;
    req.session.user = {
      username: `${user.username}#${user.discriminator}`,
      avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`,
    };
    console.log('User session set:', req.session.user.username);

    res.redirect('/dashboard.html');
  } catch (error) {
    console.error('Detailed error during login:', error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.request);
    }
    res.send('Error during login');
  }
});

app.get('/get-user', (req, res) => {
  res.json(req.session.user || null);
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.use('/dashboard.html', (req, res, next) => {
  if (!req.session.user) return res.redirect('/');
  next();
});

module.exports = app;