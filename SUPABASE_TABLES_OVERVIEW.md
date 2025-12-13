# Supabase Tables Usage Overview

This document provides a comprehensive rundown of how each Supabase table is being used in your Discord monetization platform.

---

## 1. `server_owners` Table

**Purpose**: Extends Supabase auth.users with Discord-specific user information.

**Schema**:
- `id` (UUID, Primary Key) - References `auth.users(id)`
- `email` (VARCHAR) - User's email
- `discord_user_id` (VARCHAR, UNIQUE) - Discord user ID
- `created_at`, `updated_at` - Timestamps

**Usage**:
- **Auto-created**: Trigger `on_auth_user_created` automatically creates a record when a new user signs up via Supabase Auth
- **Links**: One-to-many relationship with `discord_servers` (each owner can have multiple servers)
- **RLS**: Users can only view/update their own record

**Key Features**:
- Automatically populated when users authenticate with Discord
- Used as the owner reference for `discord_servers`

---

## 2. `discord_servers` Table

**Purpose**: Stores Discord server configurations and analytics data.

**Core Schema** (from `database_schema.sql`):
- `id` (UUID, Primary Key)
- `owner_id` (UUID) - References `server_owners(id)`
- `discord_server_id` (VARCHAR, UNIQUE) - Discord's server ID
- `server_name` (VARCHAR)
- `invite_code` (VARCHAR, UNIQUE) - Discord invite code
- `created_at`, `updated_at` - Timestamps

**Extended Columns** (added via migrations):
- `total_invite_clicks` (INTEGER) - Total invite link clicks
- `total_joins` (INTEGER) - Total member joins
- `conversion_rate` (DECIMAL) - Click-to-join conversion rate
- `monthly_revenue` (DECIMAL) - Revenue tracking
- `owner_discord_id` (VARCHAR) - Discord ID of owner
- `server_icon` (VARCHAR) - Server icon URL/hash
- `user_role` (VARCHAR) - User's role in server
- `paid_conversion_rate` (DECIMAL) - % of active members with paid subscriptions
- `stripe_price_id` (TEXT) - Stripe subscription price ID (legacy, see `server_settings`)

**Usage**:
- **API Endpoints** (`api/index.js`):
  - `GET /api/servers` - Lists all servers owned by authenticated user
  - `POST /api/servers` - Creates/registers a new server
  - `PUT /api/servers/:serverId` - Updates server info (name, icon, invite code)
  - `DELETE /api/servers/:serverId` - Removes server registration
  - `GET /api/invite/:inviteCode` - Redirects invite links (tracks clicks)
  - `POST /api/invite/:inviteCode/track` - Tracks invite clicks for analytics

- **Bot Integration**:
  - Bot queries servers by `discord_server_id` to identify registered servers
  - Updates `total_joins` when members join
  - Updates `paid_conversion_rate` when subscriptions change

- **Dashboard Display**:
  - Frontend displays server list with analytics (clicks, joins, revenue)
  - Shows conversion rates and subscription stats

**Key Features**:
- RLS policies ensure users only see/modify their own servers
- Indexed on `owner_id`, `discord_server_id`, and `invite_code` for performance
- Auto-updates `updated_at` timestamp on changes

---

## 3. `affiliate_tracking` Table

**Purpose**: Tracks affiliate marketing analytics - click tracking, join events, and conversions.

**Schema**:
- `id` (UUID, Primary Key)
- `server_id` (UUID) - References `discord_servers(id)` (nullable)
- `discord_server_id` (VARCHAR) - Direct Discord server ID (for persistence)
- `invite_code` (VARCHAR) - The invite code that was clicked
- `affiliate_id` (VARCHAR) - Discord user ID of the affiliate (null for organic/direct)
- `click_timestamp` (TIMESTAMPTZ) - When invite was clicked
- `join_timestamp` (TIMESTAMPTZ) - When user actually joined (null if not joined)
- `user_discord_id` (VARCHAR) - Discord ID of the user who joined
- `conversion_status` (VARCHAR) - 'clicked', 'joined', 'converted_to_paid'
- `leave_timestamp` (TIMESTAMPTZ) - When user left the server (null if still active)
- `created_at`, `updated_at` - Timestamps

**Usage**:
- **Click Tracking** (`api/index.js`):
  - When a user clicks an invite link, a record is created with `conversion_status = 'clicked'`
  - `trackInviteClick()` function inserts records and increments server click counts

- **Join Tracking** (Bot files: `railway-complete-bot.js`, `start_bot.js`, etc.):
  - Bot listens for `guildMemberAdd` events
  - Finds pending click records and updates them to `conversion_status = 'joined'`
  - Sets `join_timestamp` and `user_discord_id`
  - For organic joins (no prior click), creates new record with `invite_code = 'ORGANIC'`

- **Leave Tracking**:
  - Bot can track when members leave (using `leave_timestamp`)
  - Used to calculate active vs inactive members

- **Analytics**:
  - Powers conversion rate calculations (clicks → joins → paid)
  - Used to calculate `paid_conversion_rate` in `discord_servers`

**Key Features**:
- `server_id` is nullable to persist tracking even if server config is deleted
- Indexed on `discord_server_id`, `invite_code`, and `affiliate_id`
- RLS allows public read for invite redirects, authenticated write for owners

---

## 4. `member_affiliates` Table

**Purpose**: Persistent lookup table linking Discord members to their referrers/affiliates.

**Schema**:
- `id` (BIGSERIAL, Primary Key)
- `discord_server_id` (TEXT) - Discord server ID
- `discord_user_id` (TEXT) - Discord user ID of the member
- `affiliate_id` (TEXT) - Discord user ID of the affiliate who referred them (null for organic)
- `invite_code` (TEXT) - The invite code used
- `joined_at` (TIMESTAMPTZ) - When member joined
- `left_at` (TIMESTAMPTZ) - When member left (null if still active)
- `created_at`, `updated_at` - Timestamps
- **Unique constraint**: One row per `(discord_server_id, discord_user_id)`

**Usage**:
- **Member Join Tracking** (Bot files):
  - Created/updated when members join via `trackMemberJoin()`
  - Uses `upsert` with conflict resolution on `(discord_server_id, discord_user_id)`
  - Links members to their affiliates for commission tracking

- **Subscription Attribution** (`api/stripe.js`):
  - `getMemberAffiliate()` function queries this table
  - When a subscription is created, looks up the affiliate who referred the subscriber
  - Stores affiliate ID in `subscriptions.affiliate_id` for commission tracking

**Key Features**:
- Ensures one-to-one mapping (member can only have one affiliate per server)
- Indexed on `affiliate_id` for fast affiliate performance queries
- Auto-updates `updated_at` on changes

---

## 5. `subscriptions` Table

**Purpose**: Tracks Stripe subscription data for Discord server monetization.

**Schema**:
- `id` (UUID, Primary Key)
- `stripe_subscription_id` (TEXT, UNIQUE) - Stripe's subscription ID
- `stripe_customer_id` (TEXT) - Stripe customer ID
- `discord_server_id` (TEXT) - Discord server this subscription is for
- `discord_user_id` (TEXT) - Discord user ID of subscriber
- `status` (TEXT) - 'active', 'cancelled', 'past_due', etc.
- `price_id` (TEXT) - Stripe price ID
- `current_period_start`, `current_period_end` (TIMESTAMPTZ) - Billing period
- `cancelled_at` (TIMESTAMPTZ) - When subscription was cancelled
- `affiliate_id` (TEXT) - Affiliate who referred this subscriber (from `member_affiliates`)
- `metadata` (JSONB) - Additional Stripe metadata
- `created_at`, `updated_at` - Timestamps

**Usage**:
- **Webhook Handlers** (`api/stripe.js`):
  - `handleSubscriptionCreated()` - Creates record when subscription starts
  - `handleSubscriptionUpdated()` - Updates record on status/billing period changes
  - `handleSubscriptionDeleted()` - Marks subscription as cancelled

- **Checkout Sessions**:
  - Created when users purchase subscriptions via Stripe Checkout
  - Stores Discord metadata for role assignment

- **Bot Role Management** (`bot-server.js`):
  - Queries active subscriptions to assign paid roles
  - Daily cron job (`checkSubscriptions()`) syncs roles based on subscription status

- **Dashboard** (`api/index.js`, `api/user-subscriptions.js`):
  - Users can view their subscriptions
  - Displays subscription status, billing period, server info

**Key Features**:
- Foreign key to `discord_servers.discord_server_id` with CASCADE delete
- Indexed on `stripe_subscription_id`, `stripe_customer_id`, `discord_server_id`, `status`
- Partial index on active subscriptions for fast queries
- RLS allows service role full access (for webhooks), server owners can view their server's subscriptions

---

## 6. `server_settings` Table

**Purpose**: Stores per-server shared configuration settings (decoupled from `discord_servers` for multi-owner support).

**Schema**:
- `discord_server_id` (TEXT, Primary Key)
- `stripe_price_id` (TEXT) - Stripe subscription price ID for this server
- `created_at`, `updated_at` - Timestamps

**Usage**:
- **Checkout Sessions** (`api/stripe.js`, `api/index.js`):
  - `createMemberCheckoutSession()` checks this table for server's Stripe price
  - Falls back to legacy `discord_servers.stripe_price_id` if not found
  - Persists price ID when checkout session is created

- **Price Configuration**:
  - Allows multiple server owners to share the same Stripe price setting
  - Separates pricing config from owner-specific server records

**Key Features**:
- One row per Discord server (regardless of how many owners)
- Auto-updates `updated_at` on changes
- RLS allows service role full access

---

## 7. `daily_subscription_snapshots` Table

**Purpose**: Daily snapshots of subscription counts for tracking growth/decline over time.

**Schema**:
- `id` (UUID, Primary Key)
- `snapshot_date` (DATE, UNIQUE) - Date of snapshot (YYYY-MM-DD)
- `total_active_subscriptions` (INTEGER) - Total active subscriptions on this date
- `subscriptions_created` (INTEGER) - New subscriptions created this day
- `subscriptions_cancelled` (INTEGER) - Subscriptions cancelled this day
- `created_at` (TIMESTAMPTZ) - When snapshot was created

**Usage**:
- **Daily Subscription Check** (`bot-server.js`):
  - Cron job runs `checkSubscriptions()` daily
  - Compares current subscription count with previous day's snapshot
  - Calculates growth metrics (new vs cancelled)
  - Creates/updates snapshot for today
  - Used to generate daily reports

**Key Features**:
- Indexed on `snapshot_date` for efficient date queries
- Unique constraint ensures one snapshot per day
- Used for analytics and reporting

---

## Data Flow Summary

### User Registration Flow:
1. User authenticates via Supabase Auth (Discord OAuth)
2. `server_owners` record auto-created via trigger
3. User can register servers in `discord_servers`

### Invite Click Flow:
1. User clicks invite link → `affiliate_tracking` record created (status: 'clicked')
2. `discord_servers.total_invite_clicks` incremented
3. User redirected to Discord

### Member Join Flow:
1. Bot detects `guildMemberAdd` event
2. Finds pending `affiliate_tracking` record and updates to 'joined'
3. Creates/updates `member_affiliates` record
4. Updates `discord_servers.total_joins`
5. Calculates conversion rate

### Subscription Flow:
1. User initiates checkout → `server_settings` queried for price
2. Stripe Checkout session created
3. Webhook receives `subscription.created` → `subscriptions` record created
4. Looks up `member_affiliates` to get `affiliate_id`
5. Bot assigns paid role based on active subscription
6. `discord_servers.paid_conversion_rate` updated

### Daily Snapshot Flow:
1. Daily cron job queries active subscriptions
2. Compares with previous day's snapshot
3. Creates new snapshot in `daily_subscription_snapshots`
4. Updates all member roles based on subscription status

---

## Security (RLS Policies)

All tables use Row Level Security (RLS) with policies that:
- Allow service role full access (for webhooks, bot operations)
- Restrict user access to their own data (server owners see only their servers)
- Public access where needed (invite redirects for `affiliate_tracking`)

---

## Key Relationships

```
auth.users
  └─> server_owners (1:1)
       └─> discord_servers (1:many)

discord_servers
  ├─> affiliate_tracking (1:many)
  ├─> subscriptions (1:many, via discord_server_id)
  └─> server_settings (1:1, via discord_server_id)

member_affiliates
  └─> subscriptions.affiliate_id (many:1, for commission tracking)
```

---

This overview covers the current state of your Supabase tables and their usage patterns. Each table serves a specific purpose in your Discord server monetization platform, from user management to subscription tracking and affiliate analytics.

