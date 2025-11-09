# Subscription Snapshot Setup

This feature automatically checks subscription counts every **30 minutes** (top and half hour) in the `America/New_York` timezone and posts an updated report to the `#linkwizard` channel. Each new update removes the previous message so the channel shows the latest snapshot.

## What Was Added

1. **Database Table**: `daily_subscription_snapshots` - Tracks daily subscription counts for comparison
2. **Bot Server Updates**: Added scheduled task, slash commands, and subscription checking functions to `bot-server.js`
3. **Slash Commands**: `/subscribe` and `/unsubscribe` in `#membership` channel that generate Stripe links
4. **Dependencies**: Added `node-cron` and `axios` packages for scheduling and API calls

## Setup Instructions

### 1. Run the Database Migration

Execute the SQL file to create the tracking table:

```sql
-- Run this in your Supabase SQL editor
-- File: create_daily_subscription_snapshots_table.sql
```

Or run it directly:
```bash
# If you have psql access
psql -h your-supabase-host -U postgres -d postgres -f create_daily_subscription_snapshots_table.sql
```

### 2. Install Dependencies

Install the new `node-cron` package:

```bash
npm install
```

### 3. Environment Variables

Make sure your `.env` file (or environment variables) includes:

- `BOT_API_TOKEN=choose_a_random_secret` (must match between bot server and API)
- `STRIPE_DEFAULT_PRICE_ID=your_stripe_price`
- `MEMBER_API_BASE_URL=https://your-vercel-domain` (optional; defaults to `http://localhost:3000`)
- `MEMBER_CHECKOUT_SUCCESS_URL=https://your-site/success` (optional)
- `MEMBER_CHECKOUT_CANCEL_URL=https://your-site/cancel` (optional)
- `MEMBER_PORTAL_RETURN_URL=https://your-site/portal-return` (optional)

```
DISCORD_BOT_TOKEN=your_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Bot Permissions

Ensure your Discord bot has the following permissions:

**In the `#linkwizard` channel:**
- **Send Messages** - Required to post daily reports
- **View Channels** - Required to find and access the channel

**In the server (for role management):**
- **Manage Roles** - Required to assign/remove 🟢 and 🔴 roles
- The bot's role must be positioned **above** the 🟢 and 🔴 roles in the role hierarchy

### 5. Start the Bot Server

Start the bot server which includes the scheduled task:

```bash
node bot-server.js
```

Or if you have a package.json script:
```bash
npm run start-bot
```

## How It Works

1. **Recurring Schedule**: The bot checks subscriptions every 30 minutes (automatically adjusts for daylight saving time because the timezone is set to `America/New_York`)

2. **Subscription Check**:
   - Queries all active subscriptions from the database
   - Compares with the previous day's count
   - Calculates new subscriptions created today
   - Calculates subscriptions cancelled today
   - Saves a snapshot to the database

3. **Role Updates**: 
   - **Automatically updates all member roles** in all servers with active subscriptions
   - Members with active subscriptions get the 🟢 (green/paid) role
   - Members without active subscriptions get the 🔴 (red/free) role
   - This ensures roles stay in sync with subscription status daily

4. **Discord Report**: Posts a formatted message to `#linkwizard` channel with:
   - System status
   - Current total paid members
   - New subscriptions today
   - Cancelled subscriptions today
   - Net change

## Testing

You can manually test the subscription check without waiting for the next 30‑minute window:

```bash
node test_daily_subscription_check.js
```

This will:
- Connect to Discord
- Run the subscription check
- Post the report to `#linkwizard`
- Exit

## Channel Configuration

The bot automatically searches all Discord servers it's in for a channel named `linkwizard`. If you need to change the channel name, edit the `LINKWIZARD_CHANNEL_NAME` constant in `bot-server.js`:

```javascript
const LINKWIZARD_CHANNEL_NAME = 'linkwizard'; // Change this if needed
```

Create a `membership` channel for the `/subscribe` and `/unsubscribe` commands. These commands only respond in that channel and DM the user with the Stripe link. If you want to use a different channel name, update the `MEMBERSHIP_CHANNEL_NAME` constant in `bot-server.js`.

Slash commands are registered per guild when the bot starts (and when the bot joins a new guild), so `/subscribe` and `/unsubscribe` should appear immediately in Discord after restarting the bot.

## Troubleshooting

### Bot can't find the channel
- Make sure the channel is named exactly `linkwizard` (case-sensitive)
- Ensure the bot has access to the channel
- Check that the bot is in the same Discord server

### Bot doesn't have permission to send messages
- Go to Discord Server Settings → Roles → Select your bot's role
- Enable "Send Messages" permission
- Make sure channel-specific permissions aren't overriding this

### Schedule not running
- Check that the bot server is running continuously
- Verify `node-cron` is installed: `npm list node-cron`
- Check server logs for any errors

### Database errors
- Verify Supabase credentials are correct
- Run the SQL migration to create the `daily_subscription_snapshots` table
- Check that the `subscriptions` table exists and has data

## Example Report Format

```
📊 **Subscription Snapshot** - January 15, 2024 at 12:00 PM EST (updates every 30 min)

✅ **Status:** System is operational

📈 **Current Paid Members:** 42
🆕 **New Subscriptions Today:** +3
❌ **Cancelled Subscriptions Today:** -1

**Net Change Today:** +2

🕒 Next automatic update in ~30 minutes.
```

## Notes

- The first run of the day will use 0 as the previous day's count (no snapshot exists yet)
- Updates happen every 30 minutes; the bot deletes the previous message before posting the latest snapshot
- If the bot restarts, it posts an update shortly after coming back online
- Snapshot data is still stored once per day (per date) so you can review daily totals historically

