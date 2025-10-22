-- Safe version of the multiple server owners fix
-- This version checks for existing constraints before dropping them

-- First, let's see what constraints exist
-- You can run this query first to see the current constraints:
-- SELECT conname, contype, confrelid::regclass 
-- FROM pg_constraint 
-- WHERE conrelid = 'discord_servers'::regclass;

-- Step 1: Drop the foreign key constraint from subscriptions table (if it exists)
-- The constraint name might be different, so we'll try common variations
DO $$ 
BEGIN
    -- Try to drop the foreign key constraint
    BEGIN
        ALTER TABLE subscriptions DROP CONSTRAINT fk_subscriptions_discord_server;
        RAISE NOTICE 'Dropped constraint fk_subscriptions_discord_server';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint fk_subscriptions_discord_server does not exist, continuing...';
    END;
    
    -- Try alternative constraint names
    BEGIN
        ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_discord_server_id_fkey;
        RAISE NOTICE 'Dropped constraint subscriptions_discord_server_id_fkey';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint subscriptions_discord_server_id_fkey does not exist, continuing...';
    END;
END $$;

-- Step 2: Remove the unique constraint on discord_server_id
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE discord_servers DROP CONSTRAINT discord_servers_discord_server_id_key;
        RAISE NOTICE 'Dropped constraint discord_servers_discord_server_id_key';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint discord_servers_discord_server_id_key does not exist, continuing...';
    END;
END $$;

-- Step 3: Create a new unique constraint that allows multiple owners per server
-- but prevents duplicate entries for the same user-server combination
ALTER TABLE discord_servers ADD CONSTRAINT discord_servers_user_server_unique 
  UNIQUE (owner_id, discord_server_id);

-- Step 4: Recreate the foreign key constraint from subscriptions to discord_servers
-- This will now reference the discord_server_id column without requiring uniqueness
ALTER TABLE subscriptions ADD CONSTRAINT fk_subscriptions_discord_server 
  FOREIGN KEY (discord_server_id) REFERENCES discord_servers(discord_server_id);

-- Step 5: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discord_servers_owner_server 
  ON discord_servers(owner_id, discord_server_id);

CREATE INDEX IF NOT EXISTS idx_discord_servers_discord_id 
  ON discord_servers(discord_server_id);

-- Add comments to document the changes
COMMENT ON TABLE discord_servers IS 'Discord servers table - allows multiple owners per server';
COMMENT ON CONSTRAINT discord_servers_user_server_unique ON discord_servers 
  IS 'Ensures each user can only have one record per Discord server, but multiple users can manage the same server';
