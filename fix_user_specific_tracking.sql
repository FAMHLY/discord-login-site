-- Fix user-specific tracking for multiple server owners
-- This allows each user to see their own tracking data

-- Step 1: Add user-specific tracking columns to discord_servers table
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS user_total_invite_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_total_joins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_conversion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS user_paid_conversion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS user_monthly_revenue DECIMAL(10,2) DEFAULT 0.00;

-- Step 2: Create a function to calculate user-specific stats
CREATE OR REPLACE FUNCTION calculate_user_server_stats(
  p_discord_server_id VARCHAR(255),
  p_owner_discord_id VARCHAR(255)
)
RETURNS TABLE (
  total_clicks INTEGER,
  total_joins INTEGER,
  conversion_rate DECIMAL(5,2),
  paid_conversion_rate DECIMAL(5,2),
  monthly_revenue DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH user_tracking AS (
    SELECT 
      COUNT(*) as clicks,
      COUNT(CASE WHEN conversion_status = 'joined' THEN 1 END) as joins,
      COUNT(CASE WHEN conversion_status = 'converted_to_paid' THEN 1 END) as paid_conversions
    FROM affiliate_tracking 
    WHERE discord_server_id = p_discord_server_id 
      AND affiliate_id = p_owner_discord_id
  ),
  user_revenue AS (
    SELECT COALESCE(SUM(
      CASE 
        WHEN s.status = 'active' THEN 10.00  -- $10 per active subscription
        ELSE 0
      END
    ), 0) as revenue
    FROM subscriptions s
    WHERE s.discord_server_id = p_discord_server_id 
      AND s.discord_user_id = p_owner_discord_id
  )
  SELECT 
    ut.clicks::INTEGER,
    ut.joins::INTEGER,
    CASE 
      WHEN ut.clicks > 0 THEN ROUND((ut.joins::DECIMAL / ut.clicks::DECIMAL) * 100, 2)
      ELSE 0
    END,
    CASE 
      WHEN ut.clicks > 0 THEN ROUND((ut.paid_conversions::DECIMAL / ut.clicks::DECIMAL) * 100, 2)
      ELSE 0
    END,
    ur.revenue
  FROM user_tracking ut, user_revenue ur;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a function to update user-specific stats
CREATE OR REPLACE FUNCTION update_user_server_stats(
  p_discord_server_id VARCHAR(255),
  p_owner_discord_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
  stats RECORD;
BEGIN
  -- Calculate user-specific stats
  SELECT * INTO stats FROM calculate_user_server_stats(p_discord_server_id, p_owner_discord_id);
  
  -- Update the user's server record with their specific stats
  UPDATE discord_servers 
  SET 
    user_total_invite_clicks = stats.total_clicks,
    user_total_joins = stats.total_joins,
    user_conversion_rate = stats.conversion_rate,
    user_paid_conversion_rate = stats.paid_conversion_rate,
    user_monthly_revenue = stats.monthly_revenue,
    updated_at = NOW()
  WHERE discord_server_id = p_discord_server_id 
    AND owner_discord_id = p_owner_discord_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a trigger to automatically update user stats when affiliate tracking changes
CREATE OR REPLACE FUNCTION trigger_update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats for the server owner who created this tracking record
  IF NEW.affiliate_id IS NOT NULL THEN
    PERFORM update_user_server_stats(NEW.discord_server_id, NEW.affiliate_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS update_user_stats_trigger ON affiliate_tracking;
CREATE TRIGGER update_user_stats_trigger
  AFTER INSERT OR UPDATE ON affiliate_tracking
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_stats();

-- Step 5: Create a trigger to update user stats when subscriptions change
CREATE OR REPLACE FUNCTION trigger_update_user_stats_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats for the subscription owner
  IF NEW.discord_user_id IS NOT NULL THEN
    PERFORM update_user_server_stats(NEW.discord_server_id, NEW.discord_user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the subscription trigger
DROP TRIGGER IF EXISTS update_user_stats_subscription_trigger ON subscriptions;
CREATE TRIGGER update_user_stats_subscription_trigger
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_stats_subscription();

-- Step 6: Update existing records with user-specific stats
DO $$
DECLARE
  server_record RECORD;
BEGIN
  FOR server_record IN 
    SELECT discord_server_id, owner_discord_id 
    FROM discord_servers 
    WHERE owner_discord_id IS NOT NULL
  LOOP
    PERFORM update_user_server_stats(server_record.discord_server_id, server_record.owner_discord_id);
  END LOOP;
END $$;
