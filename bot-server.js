// Persistent Discord Bot Server
// This runs as a standalone server for better performance
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = process.env.PORT || 3001;

// Create persistent Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// Bot ready event
client.once('clientReady', () => {
    console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    
    // Log all servers
    client.guilds.cache.forEach(guild => {
        console.log(`   - ${guild.name} (${guild.id})`);
    });
});

// Bot error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', info => {
    console.warn('⚠️ Discord client warning:', info);
});

// Generate Discord invite function
async function generateDiscordInvite(serverId, options = {}) {
    try {
        console.log(`🔗 Generating invite for server ${serverId}`);
        
        // Find the guild (server)
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            console.log(`Guild not found. Available guilds: ${client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ')}`);
            throw new Error('Server not found or bot not in server');
        }
        
        console.log(`Found guild: ${guild.name} (${guild.id})`);
        
        // Fetch the guild members to ensure we have the bot member
        await guild.members.fetch();
        
        // Check if bot has permission to create invites
        const botMember = guild.members.cache.get(client.user.id);
        if (!botMember) {
            console.log(`Bot member not found in guild. Bot ID: ${client.user.id}`);
            throw new Error('Bot is not a member of this server. Please add the bot to the server first.');
        }
        
        console.log(`Bot member found: ${botMember.user.tag}`);
        
        if (!botMember.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
            throw new Error('Bot does not have permission to create invites');
        }
        
        // Find a suitable channel to create the invite
        const channel = guild.channels.cache.find(ch => 
            ch.type === 0 && // Text channel
            ch.permissionsFor(botMember).has(PermissionFlagsBits.CreateInstantInvite)
        );
        
        if (!channel) {
            throw new Error('No suitable channel found for creating invites');
        }
        
        // Create the invite
        const invite = await channel.createInvite({
            maxAge: options.maxAge || 0,
            maxUses: options.maxUses || 0,
            unique: true,
            reason: 'Generated via Discord Monetization Bot'
        });
        
        console.log(`✅ Created invite for ${guild.name}: ${invite.url}`);
        
        return {
            success: true,
            invite_code: invite.code,
            invite_url: invite.url,
            server_name: guild.name,
            channel_name: channel.name,
            expires_at: invite.expiresAt,
            max_uses: invite.maxUses
        };
        
    } catch (error) {
        console.error('❌ Error generating invite:', error);
        return { success: false, error: error.message };
    }
}

// Get server information
async function getServerInfo(serverId) {
    try {
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Server not found');
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

        return {
            success: true,
            server: serverInfo
        };
        
    } catch (error) {
        console.error('Error fetching server info:', error.message);
        return { success: false, error: error.message };
    }
}

// Get all servers
async function getAllServers() {
    try {
        const servers = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            member_count: guild.memberCount,
            owner_id: guild.ownerId,
            bot_has_permissions: guild.members.cache.get(client.user.id)?.permissions.has(PermissionFlagsBits.CreateInstantInvite) || false
        }));
        
        return {
            success: true,
            servers: servers
        };
        
    } catch (error) {
        console.error('Error fetching servers:', error.message);
        return { success: false, error: error.message };
    }
}

// API Routes
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
        console.error('❌ Error in generate-invite endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/bot/server/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;
        const result = await getServerInfo(serverId);
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in server info endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/bot/servers', async (req, res) => {
    try {
        const result = await getAllServers();
        res.json(result);
        
    } catch (error) {
        console.error('❌ Error in servers endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/bot/health', async (req, res) => {
    try {
        res.json({
            status: 'healthy',
            bot_online: client.isReady(),
            bot_user: client.user ? client.user.tag : 'Unknown',
            guilds_count: client.guilds.cache.size,
            message: 'Bot is operational'
        });
    } catch (error) {
        console.error('❌ Error in health endpoint:', error);
        res.json({
            status: 'error',
            message: error.message,
            bot_online: false
        });
    }
});

// Keep-alive endpoint
app.get('/api/bot/keepalive', async (req, res) => {
    try {
        res.json({
            status: 'alive',
            bot_user: client.user ? client.user.tag : 'Unknown',
            guilds_count: client.guilds.cache.size,
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

// Start the server
async function startServer() {
    try {
        if (!BOT_TOKEN) {
            throw new Error('DISCORD_BOT_TOKEN environment variable is required');
        }
        
        // Login to Discord
        await client.login(BOT_TOKEN);
        
        // Start HTTP server
        app.listen(PORT, () => {
            console.log(`🚀 Bot server running on port ${PORT}`);
            console.log(`📡 Health check: http://localhost:${PORT}/api/bot/health`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start bot server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down bot server...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down bot server...');
    client.destroy();
    process.exit(0);
});

// Start the server
startServer();
