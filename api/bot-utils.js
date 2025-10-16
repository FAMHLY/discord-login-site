// Shared Discord bot utilities for both main API and bot API
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

// Create a temporary bot client for serverless operations
async function createBotClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds
        ],
        // Optimize for serverless environment
        ws: {
            properties: {
                $browser: 'Discord iOS'
            }
        },
        // Reduce connection timeouts
        rest: {
            timeout: 5000
        }
    });
    
    // Add timeout to prevent hanging (reduced from 10s to 7s for faster failure)
    const loginPromise = client.login(process.env.DISCORD_BOT_TOKEN);
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Bot login timeout')), 7000)
    );
    
    try {
        await Promise.race([loginPromise, timeoutPromise]);
        
        // Wait for client to be ready with a shorter timeout
        const readyPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Bot ready timeout')), 3000);
            
            if (client.isReady()) {
                clearTimeout(timeout);
                resolve();
            } else {
                client.once('clientReady', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            }
        });
        
        await readyPromise;
        return client;
        
    } catch (error) {
        // Ensure client is destroyed on error
        try {
            client.destroy();
        } catch (destroyError) {
            // Ignore destroy errors
        }
        throw error;
    }
}

// Generate Discord invite for a specific server
async function generateDiscordInvite(serverId, options = {}, retryCount = 0) {
    const { maxAge = 0, maxUses = 0 } = options;
    const maxRetries = 2;
    
    if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error('Discord bot is not configured');
    }
    
    let client;
    try {
        // Create temporary bot client
        client = await createBotClient();
        
        // Wait for the client to be ready (already handled in createBotClient)
        if (!client.isReady()) {
            await new Promise(resolve => client.once('clientReady', resolve));
        }
        
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
            console.log(`Available members: ${guild.members.cache.map(m => `${m.user.tag} (${m.id})`).join(', ')}`);
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
            maxAge: maxAge, // 0 = never expires
            maxUses: maxUses, // 0 = unlimited uses
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
        console.error(`Bot invite generation attempt ${retryCount + 1} failed:`, error.message);
        
        // Clean up client on error
        if (client) {
            try {
                client.destroy();
            } catch (destroyError) {
                // Ignore destroy errors
            }
        }
        
        // Retry logic for timeout errors
        if ((error.message.includes('timeout') || error.message.includes('Bot login timeout')) && retryCount < maxRetries) {
            console.log(`Retrying bot invite generation (attempt ${retryCount + 2}/${maxRetries + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return generateDiscordInvite(serverId, options, retryCount + 1);
        }
        
        throw error;
    } finally {
        // Always clean up the client
        if (client) {
            try {
                client.destroy();
            } catch (destroyError) {
                // Ignore destroy errors
            }
        }
    }
}

// Get server information
async function getServerInfo(serverId) {
    if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error('Discord bot is not configured');
    }
    
    // Create temporary bot client
    let client;
    try {
        client = await createBotClient();
        
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Server not found');
        }
        
        return {
            success: true,
            server: {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                member_count: guild.memberCount,
                owner_id: guild.ownerId,
                created_at: guild.createdAt,
                bot_has_permissions: guild.members.cache.get(client.user.id)?.permissions.has(PermissionFlagsBits.CreateInstantInvite) || false
            }
        };
        
    } catch (error) {
        console.error('Error fetching server info:', error.message);
        throw error;
    } finally {
        // Always clean up the client
        if (client) {
            try {
                client.destroy();
            } catch (destroyError) {
                // Ignore destroy errors
            }
        }
    }
}

// Get all servers the bot is in
async function getAllServers() {
    if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error('Discord bot is not configured');
    }
    
    // Create temporary bot client
    const client = await createBotClient();
    
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
        
    } finally {
        // Always clean up the client
        client.destroy();
    }
}

// Health check for bot
async function checkBotHealth() {
    if (!process.env.DISCORD_BOT_TOKEN) {
        return {
            status: 'error',
            message: 'Bot token not configured',
            bot_online: false
        };
    }

    try {
        // Test bot token by creating a temporary client
        const client = await createBotClient();
        
        const result = {
            status: 'healthy',
            bot_online: true,
            bot_user: client.user ? `${client.user.username}#${client.user.discriminator}` : 'Unknown',
            guilds_count: client.guilds.cache.size,
            message: 'Bot is operational'
        };

        // Clean up the client
        client.destroy();
        
        return result;
        
    } catch (error) {
        console.error('Bot health check failed:', error);
        return {
            status: 'error',
            message: error.message,
            bot_online: false
        };
    }
}

module.exports = {
    createBotClient,
    generateDiscordInvite,
    getServerInfo,
    getAllServers,
    checkBotHealth
};
