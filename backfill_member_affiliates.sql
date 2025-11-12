INSERT INTO member_affiliates (
  discord_server_id,
  discord_user_id,
  affiliate_id,
  invite_code,
  joined_at,
  left_at,
  created_at,
  updated_at
)
SELECT DISTINCT ON (discord_server_id, user_discord_id)
  discord_server_id,
  user_discord_id,
  affiliate_id,
  invite_code,
  COALESCE(join_timestamp, click_timestamp, NOW()) AS joined_at,
  leave_timestamp,
  NOW(),
  NOW()
FROM affiliate_tracking
WHERE user_discord_id IS NOT NULL
ORDER BY discord_server_id, user_discord_id, join_timestamp DESC NULLS LAST, click_timestamp DESC NULLS LAST
ON CONFLICT (discord_server_id, discord_user_id) DO UPDATE
SET
  affiliate_id = EXCLUDED.affiliate_id,
  invite_code = EXCLUDED.invite_code,
  joined_at = EXCLUDED.joined_at,
  left_at = EXCLUDED.left_at,
  updated_at = NOW();

