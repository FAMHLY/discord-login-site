-- Add server_icon column to discord_servers table
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS server_icon VARCHAR(500);

-- Add comment to explain the column
COMMENT ON COLUMN discord_servers.server_icon IS 'Discord server icon URL or hash';
