-- Fix affiliate tracking persistence to prevent data loss
-- This makes tracking independent of server configuration changes

-- First, let's modify the affiliate_tracking table to be more resilient
-- We'll make the server_id reference optional and add direct discord_server_id tracking

-- Add a new column to track the discord server ID directly (independent of server configuration)
ALTER TABLE affiliate_tracking 
ADD COLUMN IF NOT EXISTS direct_discord_server_id VARCHAR(255);

-- Update existing records to populate the direct_discord_server_id
UPDATE affiliate_tracking 
SET direct_discord_server_id = discord_server_id 
WHERE direct_discord_server_id IS NULL;

-- Make the server_id reference nullable so tracking can persist even if server config is deleted
ALTER TABLE affiliate_tracking 
ALTER COLUMN server_id DROP NOT NULL;

-- Create a function to restore affiliate tracking when a server is re-added
CREATE OR REPLACE FUNCTION restore_affiliate_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new server is created, check if there's existing tracking data
  -- and link it to the new server record
  UPDATE affiliate_tracking 
  SET server_id = NEW.id
  WHERE discord_server_id = NEW.discord_server_id 
    AND server_id IS NULL;
  
  -- Also update the direct_discord_server_id for consistency
  UPDATE affiliate_tracking 
  SET direct_discord_server_id = NEW.discord_server_id
  WHERE discord_server_id = NEW.discord_server_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically restore tracking when server is re-added
DROP TRIGGER IF EXISTS restore_tracking_on_server_create ON discord_servers;
CREATE TRIGGER restore_tracking_on_server_create
  AFTER INSERT ON discord_servers
  FOR EACH ROW EXECUTE FUNCTION restore_affiliate_tracking();

-- Create a function to get aggregated statistics for a server
-- This will work even if the server configuration was deleted and re-added
CREATE OR REPLACE FUNCTION get_server_tracking_stats(p_discord_server_id VARCHAR(255))
RETURNS TABLE (
  total_invite_clicks INTEGER,
  total_joins INTEGER,
  conversion_rate DECIMAL(5,2),
  unique_affiliates INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_invite_clicks,
    COUNT(CASE WHEN conversion_status = 'joined' THEN 1 END)::INTEGER as total_joins,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(CASE WHEN conversion_status = 'joined' THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL) * 100, 2)
      ELSE 0 
    END as conversion_rate,
    COUNT(DISTINCT affiliate_id)::INTEGER as unique_affiliates
  FROM affiliate_tracking 
  WHERE discord_server_id = p_discord_server_id;
END;
$$ LANGUAGE plpgsql;

-- Create an index for better performance on tracking queries
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_discord_server_affiliate 
ON affiliate_tracking(discord_server_id, affiliate_id);

-- Create an index on the new direct_discord_server_id column
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_direct_discord_server 
ON affiliate_tracking(direct_discord_server_id);

-- Update the discord_servers table to use the persistent tracking stats
-- Add a function to update server stats from persistent tracking data
CREATE OR REPLACE FUNCTION update_server_stats_from_tracking()
RETURNS TRIGGER AS $$
DECLARE
  tracking_stats RECORD;
BEGIN
  -- Get aggregated stats from tracking data
  SELECT * INTO tracking_stats 
  FROM get_server_tracking_stats(NEW.discord_server_id);
  
  -- Update the server record with the latest stats
  UPDATE discord_servers 
  SET 
    total_invite_clicks = COALESCE(tracking_stats.total_invite_clicks, 0),
    total_joins = COALESCE(tracking_stats.total_joins, 0),
    conversion_rate = COALESCE(tracking_stats.conversion_rate, 0.00),
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update stats when server is created or updated
DROP TRIGGER IF EXISTS update_stats_on_server_change ON discord_servers;
CREATE TRIGGER update_stats_on_server_change
  AFTER INSERT OR UPDATE ON discord_servers
  FOR EACH ROW EXECUTE FUNCTION update_server_stats_from_tracking();

-- Create a function to safely remove server configuration without losing tracking data
CREATE OR REPLACE FUNCTION soft_delete_server_config(p_discord_server_id VARCHAR(255), p_owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Instead of deleting the server record, we'll mark it as inactive
  -- This preserves all tracking data while hiding it from the user
  
  -- For now, we'll still delete the server config but preserve tracking data
  -- The tracking data will be restored when the server is re-added
  
  DELETE FROM discord_servers 
  WHERE discord_server_id = p_discord_server_id 
    AND owner_id = p_owner_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the new system
COMMENT ON TABLE affiliate_tracking IS 'Persistent affiliate tracking that survives server configuration changes. Data is linked by discord_server_id and affiliate_id, making it resilient to server removal/re-addition.';

COMMENT ON FUNCTION restore_affiliate_tracking() IS 'Automatically restores affiliate tracking data when a server is re-added to the system.';

COMMENT ON FUNCTION get_server_tracking_stats(VARCHAR) IS 'Gets aggregated tracking statistics for a server, working even if the server configuration was deleted and re-added.';
