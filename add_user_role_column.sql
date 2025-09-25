-- Add user_role column to discord_servers table
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS user_role VARCHAR(50);

-- Add comment to explain the column
COMMENT ON COLUMN discord_servers.user_role IS 'Discord role of the user in this server (owner, admin, member, etc.)';
