// Discord Bot API for Vercel Serverless
// This provides bot functionality without maintaining a persistent connection

const express = require('express');
const { 
    generateDiscordInvite, 
    getServerInfo, 
    getAllServers, 
    checkBotHealth 
} = require('./bot-utils');

const app = express();
app.use(express.json());

// Bot configuration
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Health check endpoint
app.get('/api/bot/health', async (req, res) => {
    try {
        const result = await checkBotHealth();
        res.json(result);
    } catch (error) {
        console.error('Bot health check failed:', error);
        res.json({
            status: 'error',
            message: error.message,
            bot_online: false
        });
    }
});

// API endpoint to generate invite for a specific server
app.post('/api/bot/generate-invite', async (req, res) => {
    try {
        const { serverId, maxAge = 0, maxUses = 0 } = req.body;
        
        if (!serverId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Server ID is required' 
            });
        }

        const result = await generateDiscordInvite(serverId, { maxAge, maxUses });
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error generating invite:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API endpoint to get server information
app.get('/api/bot/server/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;
        const result = await getServerInfo(serverId);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error fetching server info:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API endpoint to list all servers the bot is in
app.get('/api/bot/servers', async (req, res) => {
    try {
        const result = await getAllServers();
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error fetching servers:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Keep-alive endpoint to maintain bot connection (called periodically)
app.get('/api/bot/keepalive', async (req, res) => {
    try {
        const result = await checkBotHealth();
        res.json({
            ...result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Keep-alive failed:', error);
        res.json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Export the app for Vercel
module.exports = app;
