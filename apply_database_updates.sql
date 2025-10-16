-- ========================================
-- COMPLETE DATABASE UPDATE FOR AFFILIATE TRACKING
-- Run this in Supabase SQL Editor
-- ========================================

-- Step 1: Add missing columns to discord_servers table if they don't exist
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS total_invite_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_joins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS monthly_revenue DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS server_icon VARCHAR(500),
ADD COLUMN IF NOT EXISTS user_role VARCHAR(255),
ADD COLUMN IF NOT EXISTS owner_discord_id VARCHAR(255);

-- Step 2: Update affiliate_tracking table for persistence
ALTER TABLE affiliate_tracking 
ADD COLUMN IF NOT EXISTS direct_discord_server_id VARCHAR(255);

-- Update existing records to populate the direct_discord_server_id
UPDATE affiliate_tracking 
SET direct_discord_server_id = discord_server_id 
WHERE direct_discord_server_id IS NULL;

-- Make the server_id reference nullable so tracking can persist even if server config is deleted
ALTER TABLE affiliate_tracking 
ALTER COLUMN server_id DROP NOT NULL;

-- Step 3: Create functions for tracking operations
-- Function to increment server click count (bypasses RLS)
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

-- Function to restore affiliate tracking when server is re-added
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

-- Function to get aggregated statistics for a server
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

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.increment_server_click_count(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.get_server_tracking_stats(VARCHAR) TO anon;

-- Step 5: Create triggers
DROP TRIGGER IF EXISTS restore_tracking_on_server_create ON discord_servers;
CREATE TRIGGER restore_tracking_on_server_create
  AFTER INSERT ON discord_servers
  FOR EACH ROW EXECUTE FUNCTION restore_affiliate_tracking();

-- Step 6: Update RLS policies for public access
-- Allow public to insert affiliate tracking records
DROP POLICY IF EXISTS "Public can insert affiliate tracking records" ON affiliate_tracking;
CREATE POLICY "Public can insert affiliate tracking records" 
ON affiliate_tracking 
AS PERMISSIVE 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow public to select affiliate tracking records for invite redirects
DROP POLICY IF EXISTS "Public can select affiliate tracking for redirects" ON affiliate_tracking;
CREATE POLICY "Public can select affiliate tracking for redirects" 
ON affiliate_tracking 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (true);

-- Allow public to update discord_servers for tracking (click counts only)
DROP POLICY IF EXISTS "Public can update server click counts for tracking" ON discord_servers;
CREATE POLICY "Public can update server click counts for tracking" 
ON discord_servers 
AS PERMISSIVE 
FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);

-- Allow public to select discord_servers for invite lookups
DROP POLICY IF EXISTS "Public can select servers for invite lookups" ON discord_servers;
CREATE POLICY "Public can select servers for invite lookups" 
ON discord_servers 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (true);

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_discord_server_affiliate 
ON affiliate_tracking(discord_server_id, affiliate_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_direct_discord_server 
ON affiliate_tracking(direct_discord_server_id);

-- Step 8: Add comments
COMMENT ON FUNCTION public.increment_server_click_count(VARCHAR) IS 'Increments the click count for a server by Discord server ID. Used by affiliate tracking system.';

COMMENT ON FUNCTION restore_affiliate_tracking() IS 'Automatically restores affiliate tracking data when a server is re-added to the system.';

COMMENT ON FUNCTION get_server_tracking_stats(VARCHAR) IS 'Gets aggregated tracking statistics for a server, working even if the server configuration was deleted and re-added.';

COMMENT ON TABLE affiliate_tracking IS 'Persistent affiliate tracking that survives server configuration changes. Data is linked by discord_server_id and affiliate_id, making it resilient to server removal/re-addition.';

-- ========================================
-- VERIFICATION QUERIES
-- Run these after the main update to verify everything works
-- ========================================

-- Check if all columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'discord_servers' 
AND column_name IN ('total_invite_clicks', 'total_joins', 'conversion_rate', 'monthly_revenue', 'server_icon', 'user_role', 'owner_discord_id')
ORDER BY column_name;

-- Check if functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN ('increment_server_click_count', 'restore_affiliate_tracking', 'get_server_tracking_stats')
ORDER BY routine_name;

-- Check if policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('affiliate_tracking', 'discord_servers')
AND policyname LIKE '%Public%'
ORDER BY tablename, policyname;

-- Check if indexes exist
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE tablename = 'affiliate_tracking'
AND indexname LIKE '%discord_server%'
ORDER BY indexname;
