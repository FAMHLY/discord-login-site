# Role System Changes - Implementation Summary

## Overview
The system has been updated to use a flexible role-based subscription model instead of the previous universal paid/free role system.

## Key Changes

### 1. Database Schema

#### New Table: `server_roles`
- **Purpose**: Maps Discord server roles to Stripe price IDs
- **Columns**:
  - `id` (UUID, Primary Key)
  - `discord_server_id` (TEXT) - Discord server ID
  - `role_name` (TEXT) - Name of the Discord role to assign
  - `stripe_price_id` (TEXT) - Stripe price ID that grants this role
  - `created_at`, `updated_at` (timestamps)
- **Constraints**: 
  - Unique on `(discord_server_id, stripe_price_id)`
  - Unique on `(discord_server_id, role_name)`
- **SQL File**: `create_server_roles_table.sql`

#### Updated Table: `subscriptions`
- **New Column**: `role_name` (TEXT) - Stores which role should be assigned for each subscription
- **SQL File**: `add_role_name_to_subscriptions.sql`

### 2. Role System Changes

#### Universal Free Role: "visitor"
- **Name**: `visitor` (changed from `🔴`)
- **Color**: None (Discord default)
- **Scope**: Applied to all users without active paid subscriptions
- **Auto-created**: Bot automatically creates this role in each server

#### Paid Roles: Server-Specific
- **Source**: Defined in `server_roles` table
- **Multiple roles per server**: Each server can have multiple subscription roles
- **No colors**: Roles are created without colors (Discord default)
- **Assignment**: Users get the role(s) corresponding to their active subscriptions

### 3. Bot Command Flow

#### `/subscribe` Command
1. User types `/subscribe` in `#membership` channel
2. Bot fetches available roles from `server_roles` table for that server
3. Bot responds with list of available roles
4. User replies with role number or name
5. Bot validates the selection
6. Bot DMs user with Stripe checkout link for that specific role
7. After subscription, role is immediately assigned

#### `/unsubscribe` Command
1. User types `/unsubscribe` in `#membership` channel
2. Bot fetches user's active subscriptions for that server
3. Bot filters to only show roles they're subscribed to
4. Bot responds with list of subscribed roles
5. User replies with role number or name
6. Bot validates the selection
7. Bot DMs user with Stripe billing portal link
8. After cancellation, role is immediately removed

### 4. Code Changes

#### Files Modified:
1. **`role-manager.js`**
   - Removed `PAID_ROLE_NAME`, `PAID_ROLE_COLOR`, `FREE_ROLE_COLOR`
   - Changed `FREE_ROLE_NAME` to `'visitor'`
   - Updated `ensureStandardizedRoles()` → `ensureVisitorRole()`
   - Completely rewrote `assignMemberRole()` to:
     - Assign "visitor" role for free users
     - Look up and assign roles from `server_roles` table based on active subscriptions
     - Handle multiple subscription roles per user
     - Remove old subscription roles when subscriptions expire

2. **`bot-server.js`**
   - Added `activeRoleSelections` Map to track role selection conversations
   - Updated `interactionCreate` handler to show role selection menu
   - Added `messageCreate` handler to collect user role selections
   - Updated `requestMembershipLink()` to accept `priceId` and `roleName`
   - Timeout of 60 seconds for role selection conversations

3. **`api/stripe.js`**
   - Removed `PAID_ROLE_NAME` constant
   - Updated `FREE_ROLE_NAME` to `'visitor'`
   - Updated `handleSubscriptionCreated()` to:
     - Look up `role_name` from `server_roles` table based on `price_id`
     - Store `role_name` in subscription record
     - Prioritize `role_name` from metadata if available (from checkout)
   - Updated `handleSubscriptionUpdated()` with same logic
   - Updated `createMemberCheckoutSession()` to accept and store `roleName` in metadata

4. **`api/index.js`**
   - Updated `/api/stripe/member/checkout` endpoint to:
     - Accept `priceId` and `roleName` in request body
     - Validate `priceId` exists in `server_roles` table for that server
     - Pass `roleName` to `createMemberCheckoutSession()`

### 5. Webhook Flow

#### Subscription Created/Updated
1. Webhook receives subscription event
2. Looks up `role_name` from `server_roles` table (or uses metadata)
3. Stores `role_name` in `subscriptions` table
4. Calls `handleSubscriptionChange()` which calls `assignMemberRole()`
5. Bot assigns the appropriate role(s) immediately

#### Subscription Cancelled
1. Webhook receives cancellation event
2. Updates subscription status to 'cancelled'
3. Calls `handleSubscriptionChange()` which calls `assignMemberRole()`
4. Bot removes subscription role and assigns "visitor" role if no other active subscriptions

## Migration Steps

1. **Run SQL Migrations**:
   ```sql
   -- Run in Supabase SQL Editor
   \i create_server_roles_table.sql
   \i add_role_name_to_subscriptions.sql
   ```

2. **Populate `server_roles` Table**:
   - Manually insert rows for each server/role/price combination
   - Example:
     ```sql
     INSERT INTO server_roles (discord_server_id, role_name, stripe_price_id)
     VALUES ('123456789', 'Premium', 'price_abc123');
     ```

3. **Update Existing Subscriptions** (optional):
   - Backfill `role_name` for existing subscriptions:
     ```sql
     UPDATE subscriptions s
     SET role_name = sr.role_name
     FROM server_roles sr
     WHERE s.discord_server_id = sr.discord_server_id
       AND s.price_id = sr.stripe_price_id
       AND s.role_name IS NULL;
     ```

4. **Deploy Code Changes**:
   - Deploy updated `role-manager.js`, `bot-server.js`, `api/stripe.js`, `api/index.js`

5. **Bot Will Automatically**:
   - Create "visitor" roles in servers where it doesn't exist
   - Stop creating/managing old 🟢/🔴 roles
   - Use new role assignment logic based on `server_roles` table

## Testing Checklist

- [ ] Run SQL migrations successfully
- [ ] Create test entries in `server_roles` table
- [ ] Test `/subscribe` command with role selection
- [ ] Test `/unsubscribe` command with role selection
- [ ] Verify "visitor" role is created automatically
- [ ] Verify subscription roles are assigned correctly
- [ ] Verify roles are removed on cancellation
- [ ] Test multiple subscriptions per user (multiple roles)
- [ ] Verify webhook flow assigns correct roles
- [ ] Verify role assignment happens immediately after subscription

## Notes

- The old 🟢 and 🔴 roles will not be automatically removed from servers. They can be manually deleted by server admins.
- Users can have multiple subscription roles if they subscribe to multiple prices/roles.
- The "visitor" role is universal and applies to all servers.
- All subscription roles are server-specific and defined in the `server_roles` table.

