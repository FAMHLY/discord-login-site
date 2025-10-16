// Shared Discord bot utilities for both main API and bot API
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

// Global client instance for connection reuse
let globalClient = null;
let clientReady = false;
let clientPromise = null;

// Create and maintain a persistent bot client
async function getOrCreateClient() {
    // If client is already ready, return it immediately
    if (globalClient && clientReady && globalClient.isReady()) {
        return globalClient;
    }
    
    // If we're already creating a client, wait for it
    if (clientPromise) {
        return clientPromise;
    }
    
    // Create new client
    clientPromise = createClient();
    return clientPromise;
}

async function createClient() {
    console.log('🔌 Creating new Discord client...');
    
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
            timeout: 3000
        },
        // Disable unnecessary features for speed
        presence: {
            status: 'invisible'
        }
    });
    
    // Set up event handlers
    client.once('clientReady', () => {
        console.log(`✅ Discord client ready: ${client.user.tag}`);
        clientReady = true;
    });
    
    client.on('error', (error) => {
        console.error('❌ Discord client error:', error);
        clientReady = false;
    });
    
    client.on('disconnect', () => {
        console.log('🔌 Discord client disconnected');
        clientReady = false;
    });
    
    try {
        // Login with shorter timeout
        const loginPromise = client.login(process.env.DISCORD_BOT_TOKEN);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Bot login timeout')), 5000)
        );
        
        await Promise.race([loginPromise, timeoutPromise]);
        
        // Wait for ready state with shorter timeout
        if (!client.isReady()) {
            const readyPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Bot ready timeout')), 2000);
                
                client.once('clientReady', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
            
            await readyPromise;
        }
        
        globalClient = client;
        clientReady = true;
        
        console.log(`🚀 Discord client connected successfully`);
        return client;
        
    } catch (error) {
        console.error('❌ Failed to create Discord client:', error);
        clientReady = false;
        clientPromise = null;
        throw error;
    }
}

// Generate Discord invite for a specific server
async function generateDiscordInvite(serverId, options = {}, retryCount = 0) {
    const { maxAge = 0, maxUses = 0 } = options;
    const maxRetries = 1; // Reduced retries for faster failure
    
    if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error('Discord bot is not configured');
    }
    
    let client;
    try {
        // Get or create client (reuses existing connection)
        client = await getOrCreateClient();
        
        // Find the guild (server)
        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            console.log(`Guild not found. Available guilds: ${client.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ')}`);
            throw new Error('Server not found or bot not in server');
        }
        
        console.log(`Found guild: ${guild.name} (${guild.id})`);
        
        // Check if bot has permission to create invites
        // Try to get bot member from cache first, then fetch if needed
        let botMember = guild.members.cache.get(client.user.id);
        
        if (!botMember) {
            console.log('Bot member not in cache, fetching...');
            try {
                // Only fetch the specific bot member, not all members
                const fetchPromise = guild.members.fetch(client.user.id);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Member fetch timeout')), 3000)
                );
                botMember = await Promise.race([fetchPromise, timeoutPromise]);
            } catch (fetchError) {
                console.log('Failed to fetch bot member:', fetchError.message);
                // Continue anyway - we'll check permissions later
            }
        }
        if (!botMember) {
            console.log(`Bot member not found in guild. Bot ID: ${client.user.id}`);
            console.log(`Available members: ${guild.members.cache.map(m => `${m.user.tag} (${m.id})`).join(', ')}`);
            console.log('⚠️ Proceeding without bot member validation - attempting direct invite creation');
            // Continue without bot member validation - we'll try to create invite directly
        } else {
            console.log(`Bot member found: ${botMember.user.tag}`);
            
            if (!botMember.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
                throw new Error('Bot does not have permission to create invites');
            }
        }
        
        // Find a suitable channel to create the invite
        const channel = guild.channels.cache.find(ch => {
            if (ch.type !== 0) return false; // Must be text channel
            
            if (botMember) {
                // If we have bot member, check permissions
                return ch.permissionsFor(botMember).has(PermissionFlagsBits.CreateInstantInvite);
            } else {
                // If no bot member, try to find any text channel and attempt invite creation
                console.log(`Trying channel: ${ch.name} (${ch.id})`);
                return true;
            }
        });
        
        if (!channel) {
            throw new Error('No suitable channel found for creating invites');
        }
        
        // Create the invite with timeout
        console.log(`Creating invite in channel: ${channel.name} (${channel.id})`);
        const invitePromise = channel.createInvite({
            maxAge: options.maxAge || 0,
            maxUses: options.maxUses || 0,
            unique: true,
            reason: 'Generated via Discord Monetization Bot'
        });
        
        const inviteTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Invite creation timeout')), 5000)
        );
        
        const invite = await Promise.race([invitePromise, inviteTimeoutPromise]);
        
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
        
        // Reset client connection on certain errors
        if (error.message.includes('timeout') || error.message.includes('Bot login timeout')) {
            console.log('🔄 Resetting client connection due to timeout...');
            clientReady = false;
            clientPromise = null;
            if (globalClient) {
                try {
                    globalClient.destroy();
                } catch (destroyError) {
                    // Ignore destroy errors
                }
                globalClient = null;
            }
        }
        
        // Retry logic for timeout errors
        if ((error.message.includes('timeout') || error.message.includes('Bot login timeout')) && retryCount < maxRetries) {
            console.log(`Retrying bot invite generation (attempt ${retryCount + 2}/${maxRetries + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Shorter wait for retry
            return generateDiscordInvite(serverId, options, retryCount + 1);
        }
        
        throw error;
    }
    // Note: We don't destroy the client here since we're reusing connections
}

// Get server information
async function getServerInfo(serverId) {
    if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error('Discord bot is not configured');
    }
    
    try {
        const client = await getOrCreateClient();
        
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
    }
}

// Get all servers the bot is in
async function getAllServers() {
    if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error('Discord bot is not configured');
    }
    
    const client = await getOrCreateClient();
    
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
        throw error;
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
        const client = await getOrCreateClient();
        
        return {
            status: 'healthy',
            bot_online: client.isReady(),
            bot_user: client.user ? `${client.user.username}#${client.user.discriminator}` : 'Unknown',
            guilds_count: client.guilds.cache.size,
            message: 'Bot is operational'
        };
        
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
    generateDiscordInvite,
    getServerInfo,
    getAllServers,
    checkBotHealth
};
