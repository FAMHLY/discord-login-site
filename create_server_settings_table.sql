-- Create a dedicated table to store per-server shared settings (one row per Discord server)
CREATE TABLE IF NOT EXISTS server_settings (
    discord_server_id TEXT PRIMARY KEY,
    stripe_price_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION update_server_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_server_settings_updated_at ON server_settings;
CREATE TRIGGER trigger_update_server_settings_updated_at
BEFORE UPDATE ON server_settings
FOR EACH ROW
EXECUTE FUNCTION update_server_settings_updated_at();

ALTER TABLE server_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role full access" ON server_settings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed settings from existing discord_servers records (handles duplicates)
INSERT INTO server_settings (discord_server_id, stripe_price_id)
SELECT ds.discord_server_id,
       MAX(ds.stripe_price_id) FILTER (WHERE ds.stripe_price_id IS NOT NULL) AS stripe_price_id
FROM discord_servers ds
GROUP BY ds.discord_server_id
ON CONFLICT (discord_server_id) DO UPDATE
SET stripe_price_id = EXCLUDED.stripe_price_id,
    updated_at = NOW();


