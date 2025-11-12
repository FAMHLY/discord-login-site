-- Recalculate user-specific stats using member_affiliates and subscription affiliate links
CREATE OR REPLACE FUNCTION calculate_user_server_stats(
  p_discord_server_id TEXT,
  p_owner_discord_id TEXT
)
RETURNS TABLE (
  total_clicks INTEGER,
  total_joins INTEGER,
  conversion_rate DECIMAL(5,2),
  paid_conversion_rate DECIMAL(5,2),
  monthly_revenue DECIMAL(10,2)
) AS $$
DECLARE
  clicks INTEGER;
  joins INTEGER;
  active_member_count INTEGER;
  paid_members INTEGER;
BEGIN
  SELECT COUNT(*) INTO clicks
  FROM affiliate_tracking
  WHERE discord_server_id = p_discord_server_id
    AND affiliate_id = p_owner_discord_id;

  SELECT COUNT(*) INTO joins
  FROM affiliate_tracking
  WHERE discord_server_id = p_discord_server_id
    AND affiliate_id = p_owner_discord_id
    AND conversion_status = 'joined';

  SELECT COUNT(*) INTO active_member_count
  FROM member_affiliates
  WHERE discord_server_id = p_discord_server_id
    AND affiliate_id = p_owner_discord_id
    AND left_at IS NULL;

  SELECT COUNT(*) INTO paid_members
  FROM subscriptions
  WHERE discord_server_id = p_discord_server_id
    AND status = 'active'
    AND affiliate_id = p_owner_discord_id;

  RETURN QUERY
  SELECT
    COALESCE(clicks, 0)::INTEGER,
    COALESCE(joins, 0)::INTEGER,
    CASE 
      WHEN COALESCE(clicks, 0) > 0 
        THEN ROUND((COALESCE(joins, 0)::DECIMAL / clicks::DECIMAL) * 100, 2)
      ELSE 0
    END,
    CASE 
      WHEN COALESCE(active_member_count, 0) > 0 
        THEN ROUND((COALESCE(paid_members, 0)::DECIMAL / active_member_count::DECIMAL) * 100, 2)
      ELSE 0
    END,
    -- Placeholder revenue calculation: $10 per active subscription
    COALESCE(paid_members, 0) * 10.00;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_server_stats(
  p_discord_server_id TEXT,
  p_owner_discord_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  stats RECORD;
BEGIN
  SELECT * INTO stats FROM calculate_user_server_stats(p_discord_server_id, p_owner_discord_id);

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

CREATE OR REPLACE FUNCTION trigger_update_user_stats_subscription()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.affiliate_id IS NOT NULL THEN
    PERFORM update_user_server_stats(NEW.discord_server_id, NEW.affiliate_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_stats_subscription_trigger ON subscriptions;
CREATE TRIGGER update_user_stats_subscription_trigger
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_stats_subscription();

-- Recalculate existing records with the new logic
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
END;
$$;

