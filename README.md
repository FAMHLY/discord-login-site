# Discord Monetization Bot

Discord bot for generating invite links for server monetization platform.

## Environment Variables

- `DISCORD_BOT_TOKEN` - Your Discord bot token (required)

## API Endpoints

- `GET /health` - Health check
- `GET /api/servers` - List servers the bot is in
- `POST /api/generate-invite` - Generate invite for a server
- `GET /api/server/:serverId` - Get server information

## Deployment

This bot is deployed on Vercel and provides API endpoints for the main Discord monetization platform.