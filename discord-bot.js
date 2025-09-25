const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Express server for API endpoints
const app = express();
app.use(express.json());
app.use(cors());

// Bot configuration
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = process.env.PORT || 3001;

// Store server configurations
const serverConfigs = new Map();

// Bot ready event
client.once('ready', () => {
    console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
});

// API endpoint to generate invite for a specific server
app.post('/api/generate-invite', async (req, res) => {
    try {
        const { serverId, maxAge = 0, maxUses = 0 } = req.body;
        
        if (!serverId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Server ID is required' 
            });
        }
        
        // Find the guild (server)
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ 
                success: false, 
                error: 'Server not found or bot not in server' 
            });
        }
        
        // Check if bot has permission to create invites
        const botMember = guild.members.cache.get(client.user.id);
        if (!botMember.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
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
app.get('/api/server/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;
        
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            return res.status(404).json({ 
                success: false, 
                error: 'Server not found' 
            });
        }
        
        res.json({
            success: true,
            server: {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                member_count: guild.memberCount,
                owner_id: guild.ownerId,
                created_at: guild.createdAt
            }
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
app.get('/api/servers', async (req, res) => {
    try {
        const servers = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            member_count: guild.memberCount,
            owner_id: guild.ownerId,
            bot_has_permissions: guild.members.cache.get(client.user.id)?.permissions.has(PermissionFlagsBits.CreateInstantInvite) || false
        }));
        
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        bot_ready: client.isReady(),
        servers: client.guilds.cache.size 
    });
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
});

// Login the bot
if (!BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN environment variable is required');
    process.exit(1);
}

client.login(BOT_TOKEN);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

module.exports = { client, app };
