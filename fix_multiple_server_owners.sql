-- Fix multiple server owners issue
-- Allow multiple users to manage the same Discord server

-- First, we need to handle the foreign key constraint from subscriptions table
-- Let's check what constraints exist and handle them properly

-- Step 1: Drop the foreign key constraint from subscriptions table
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS fk_subscriptions_discord_server;

-- Step 2: Remove the unique constraint on discord_server_id
ALTER TABLE discord_servers DROP CONSTRAINT IF EXISTS discord_servers_discord_server_id_key;

-- Step 3: Create a new unique constraint that allows multiple owners per server
-- but prevents duplicate entries for the same user-server combination
ALTER TABLE discord_servers ADD CONSTRAINT discord_servers_user_server_unique 
  UNIQUE (owner_id, discord_server_id);

-- Step 4: Recreate the foreign key constraint from subscriptions to discord_servers
-- This will now reference the discord_server_id column without requiring uniqueness
ALTER TABLE subscriptions ADD CONSTRAINT fk_subscriptions_discord_server 
  FOREIGN KEY (discord_server_id) REFERENCES discord_servers(discord_server_id);

-- Step 5: Add an index for better performance on the new constraint
CREATE INDEX IF NOT EXISTS idx_discord_servers_owner_server 
  ON discord_servers(owner_id, discord_server_id);

-- Step 6: Add an index on discord_server_id for the foreign key relationship
CREATE INDEX IF NOT EXISTS idx_discord_servers_discord_id 
  ON discord_servers(discord_server_id);

-- Add comments to document the changes
COMMENT ON TABLE discord_servers IS 'Discord servers table - allows multiple owners per server';
COMMENT ON CONSTRAINT discord_servers_user_server_unique ON discord_servers 
  IS 'Ensures each user can only have one record per Discord server, but multiple users can manage the same server';
