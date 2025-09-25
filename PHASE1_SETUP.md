# Phase 1 Setup Instructions

## Discord Server Management & Free Tier Invites

This phase implements the core server management functionality allowing Discord server owners to:
- Connect their Discord servers
- Generate free tier invite links
- Manage server configurations

## Prerequisites

1. **Supabase Project**: You need a Supabase project with Discord OAuth configured
2. **Discord Application**: A Discord application with proper OAuth2 scopes
3. **Discord Bot Token** (optional): For advanced invite generation

## Environment Variables

Add these to your `.env` file:

```env
# Existing Supabase variables
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Discord Bot Token (optional - for advanced invite generation)
DISCORD_BOT_TOKEN=your_discord_bot_token
```

## Database Setup

1. **Run the SQL Schema**: Execute the `database_schema.sql` file in your Supabase SQL editor
2. **Verify Tables**: Ensure these tables are created:
   - `server_owners`
   - `discord_servers`

## Discord OAuth Configuration

Your Discord application needs these OAuth2 scopes:
- `identify` - Basic user information
- `guilds` - Access to user's Discord servers

## Features Implemented

### Server Management
- **Server Discovery**: Automatically fetches user's Discord servers
- **Server Configuration**: One-click setup for monetization
- **Status Tracking**: Shows which servers are configured

### Invite Link Generation
- **Free Tier Links**: Generate permanent invite links
- **Link Management**: Copy and share invite links
- **Fallback Support**: Works without bot token (manual setup required)

### Dashboard Interface
- **Modern UI**: Clean, responsive design
- **Real-time Updates**: Live server status and configuration
- **Error Handling**: User-friendly error messages

## API Endpoints

### Server Management
- `GET /api/servers` - List user's Discord servers
- `POST /api/servers/:serverId/configure` - Configure a server
- `POST /api/servers/:serverId/invite` - Generate invite link
- `GET /api/servers/:serverId/stats` - Get server statistics

## Usage Flow

1. **User Login**: Discord OAuth authentication
2. **Server Discovery**: System fetches user's Discord servers
3. **Server Configuration**: User configures servers for monetization
4. **Invite Generation**: Create and share free tier invite links
5. **Management**: Monitor and manage server settings

## Limitations (Phase 1)

- **No Payment Processing**: Stripe integration comes in Phase 2
- **No Affiliate System**: Affiliate tracking comes in Phase 3
- **Basic Invite Generation**: Limited to Discord API capabilities
- **No Analytics**: Detailed analytics come in Phase 5

## Testing

1. **Login**: Test Discord OAuth flow
2. **Server Loading**: Verify servers are fetched correctly
3. **Configuration**: Test server setup process
4. **Invite Generation**: Test invite link creation
5. **Error Handling**: Test various error scenarios

## Next Steps

Phase 1 provides the foundation for:
- **Phase 2**: Stripe Connect integration for payments
- **Phase 3**: Affiliate link system and tracking
- **Phase 4**: Commission handling and transfers
- **Phase 5**: Advanced analytics and reporting

## Troubleshooting

### Common Issues

1. **No Servers Found**: Ensure user has admin permissions on Discord servers
2. **Invite Generation Fails**: Check Discord bot token and permissions
3. **Database Errors**: Verify Supabase connection and table creation
4. **OAuth Issues**: Check Discord application configuration

### Debug Mode

Enable console logging by opening browser developer tools to see detailed API calls and responses.

## Security Notes

- All API endpoints require authentication
- Row Level Security (RLS) is enabled on all tables
- User data is isolated by authentication
- No sensitive data is stored (banking info handled by Stripe in Phase 2)
