// Discord Bot API for Vercel Serverless
// This provides bot functionality without maintaining a persistent connection

const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const express = require('express');

const app = express();
app.use(express.json());

// Bot configuration
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Create a temporary client for each request (serverless approach)
async function createBotClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds
        ]
    });
    
    await client.login(BOT_TOKEN);
    return client;
}

// Health check endpoint
app.get('/api/bot/health', async (req, res) => {
    try {
        if (!BOT_TOKEN) {
            return res.json({
                status: 'error',
                message: 'Bot token not configured',
                bot_online: false
            });
        }

        // Test bot token by creating a temporary client
        const client = await createBotClient();
        
        res.json({
            status: 'healthy',
            bot_online: true,
            bot_user: client.user ? `${client.user.username}#${client.user.discriminator}` : 'Unknown',
            guilds_count: client.guilds.cache.size,
            message: 'Bot is operational'
        });

        // Clean up the client
        client.destroy();
        
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
        if (!BOT_TOKEN) {
            return res.status(503).json({ 
                success: false, 
                error: 'Discord bot is not configured' 
            });
        }

        const { serverId, maxAge = 0, maxUses = 0 } = req.body;
        
        if (!serverId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Server ID is required' 
            });
        }

        // Create temporary bot client
        const client = await createBotClient();
        
        // Find the guild (server)
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            client.destroy();
            return res.status(404).json({ 
                success: false, 
                error: 'Server not found or bot not in server' 
            });
        }
        
        // Check if bot has permission to create invites
        const botMember = guild.members.cache.get(client.user.id);
        if (!botMember.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
            client.destroy();
            return res.status(403).json({ 
                success: false, 
                error: 'Bot does not have permission to create invites' 
            });
        }
        
        // Find a suitable channel to create the invite
        const channel = guild.channels.cache.find(ch => 
            ch.type === 0 && // Text channel
            ch.permissionsFor(botMember).has(PermissionFlagsBits.CreateInstantInvite)
        );
        
        if (!channel) {
            client.destroy();
            return res.status(403).json({ 
                success: false, 
                error: 'No suitable channel found for creating invites' 
            });
        }
        
        // Create the invite
        const invite = await channel.createInvite({
            maxAge: maxAge, // 0 = never expires
            maxUses: maxUses, // 0 = unlimited uses
            unique: true,
            reason: 'Generated via Discord Monetization Bot'
        });
        
        console.log(`✅ Created invite for ${guild.name}: ${invite.url}`);
        
        // Clean up the client
        client.destroy();
        
        res.json({
            success: true,
            invite_code: invite.code,
            invite_url: invite.url,
            server_name: guild.name,
            channel_name: channel.name,
            expires_at: invite.expiresAt,
            max_uses: invite.maxUses
        });
        
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
        if (!BOT_TOKEN) {
            return res.status(503).json({ 
                success: false, 
                error: 'Discord bot is not configured' 
            });
        }

        const { serverId } = req.params;
        
        // Create temporary bot client
        const client = await createBotClient();
        
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            client.destroy();
            return res.status(404).json({ 
                success: false, 
                error: 'Server not found' 
            });
        }
        
        const serverInfo = {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            member_count: guild.memberCount,
            owner_id: guild.ownerId,
            created_at: guild.createdAt,
            bot_has_permissions: guild.members.cache.get(client.user.id)?.permissions.has(PermissionFlagsBits.CreateInstantInvite) || false
        };

        // Clean up the client
        client.destroy();
        
        res.json({
            success: true,
            server: serverInfo
        });
        
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
        if (!BOT_TOKEN) {
            return res.status(503).json({ 
                success: false, 
                error: 'Discord bot is not configured' 
            });
        }

        // Create temporary bot client
        const client = await createBotClient();
        
        const servers = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            member_count: guild.memberCount,
            owner_id: guild.ownerId,
            bot_has_permissions: guild.members.cache.get(client.user.id)?.permissions.has(PermissionFlagsBits.CreateInstantInvite) || false
        }));
        
        // Clean up the client
        client.destroy();

        res.json({
            success: true,
            servers: servers
        });
        
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
        if (!BOT_TOKEN) {
            return res.json({
                status: 'error',
                message: 'Bot token not configured'
            });
        }

        // Create temporary bot client to verify connectivity
        const client = await createBotClient();
        
        res.json({
            status: 'alive',
            bot_user: client.user ? client.user.tag : 'Unknown',
            guilds_count: client.guilds.cache.size,
            timestamp: new Date().toISOString()
        });

        // Clean up the client
        client.destroy();
        
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
