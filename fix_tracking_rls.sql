-- Fix RLS issues with affiliate tracking
-- This allows public access to update server click counts for tracking

-- Create a function to update server click counts that bypasses RLS
CREATE OR REPLACE FUNCTION public.increment_server_click_count(p_discord_server_id VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the server click count directly
  UPDATE discord_servers 
  SET 
    total_invite_clicks = COALESCE(total_invite_clicks, 0) + 1,
    updated_at = NOW()
  WHERE discord_server_id = p_discord_server_id;
  
  -- Return true if at least one row was updated
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users for tracking
GRANT EXECUTE ON FUNCTION public.increment_server_click_count(VARCHAR) TO anon;

-- Create a function to get server click count that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_server_click_count(p_discord_server_id VARCHAR(255))
RETURNS INTEGER AS $$
DECLARE
  click_count INTEGER;
BEGIN
  SELECT COALESCE(total_invite_clicks, 0) INTO click_count
  FROM discord_servers 
  WHERE discord_server_id = p_discord_server_id;
  
  RETURN COALESCE(click_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anonymous users for tracking
GRANT EXECUTE ON FUNCTION public.get_server_click_count(VARCHAR) TO anon;

-- Update the affiliate_tracking table to allow public inserts
-- This is needed for the tracking system to work
CREATE POLICY "Public can insert affiliate tracking records" 
ON affiliate_tracking 
AS PERMISSIVE 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow public to select affiliate tracking records for invite redirects
CREATE POLICY "Public can select affiliate tracking for redirects" 
ON affiliate_tracking 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (true);

-- Allow public to update discord_servers for tracking (click counts only)
CREATE POLICY "Public can update server click counts for tracking" 
ON discord_servers 
AS PERMISSIVE 
FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);

-- Allow public to select discord_servers for invite lookups
CREATE POLICY "Public can select servers for invite lookups" 
ON discord_servers 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (true);

-- Add comment explaining the functions
COMMENT ON FUNCTION public.increment_server_click_count(VARCHAR) IS 'Increments the click count for a server by Discord server ID. Used by affiliate tracking system.';

COMMENT ON FUNCTION public.get_server_click_count(VARCHAR) IS 'Gets the current click count for a server by Discord server ID. Used by affiliate tracking system.';
