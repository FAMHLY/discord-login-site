-- Fix multiple server owners issue
-- Allow multiple users to manage the same Discord server

-- First, remove the unique constraint on discord_server_id
ALTER TABLE discord_servers DROP CONSTRAINT IF EXISTS discord_servers_discord_server_id_key;

-- Create a new unique constraint that allows multiple owners per server
-- but prevents duplicate entries for the same user-server combination
ALTER TABLE discord_servers ADD CONSTRAINT discord_servers_user_server_unique 
  UNIQUE (owner_id, discord_server_id);

-- Update the RLS policies to allow users to see servers they own
-- (this should already be working, but let's make sure)

-- The existing RLS policy should work:
-- "Users can view their own servers" ON discord_servers
--   FOR SELECT USING (auth.uid() = owner_id);

-- Add an index for better performance on the new constraint
CREATE INDEX IF NOT EXISTS idx_discord_servers_owner_server 
  ON discord_servers(owner_id, discord_server_id);

-- Add a comment to document the change
COMMENT ON TABLE discord_servers IS 'Discord servers table - allows multiple owners per server';
COMMENT ON CONSTRAINT discord_servers_user_server_unique ON discord_servers 
  IS 'Ensures each user can only have one record per Discord server, but multiple users can manage the same server';
