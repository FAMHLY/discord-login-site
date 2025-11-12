-- Create member_affiliates table to tie members to affiliates/invites
CREATE TABLE IF NOT EXISTS member_affiliates (
  id BIGSERIAL PRIMARY KEY,
  discord_server_id TEXT NOT NULL,
  discord_user_id  TEXT NOT NULL,
  affiliate_id     TEXT,
  invite_code      TEXT,
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  left_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure we only keep one active row per member/server
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_affiliates_server_user
  ON member_affiliates(discord_server_id, discord_user_id);

-- Keep recent lookups fast
CREATE INDEX IF NOT EXISTS idx_member_affiliates_affiliate
  ON member_affiliates(affiliate_id)
  WHERE affiliate_id IS NOT NULL;

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION update_member_affiliates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_affiliates_updated_at ON member_affiliates;
CREATE TRIGGER trg_member_affiliates_updated_at
BEFORE UPDATE ON member_affiliates
FOR EACH ROW
EXECUTE FUNCTION update_member_affiliates_updated_at();

-- Enable row level security and ensure service role has access
ALTER TABLE member_affiliates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'member_affiliates'
      AND policyname = 'Service role full access'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Service role full access"
      ON member_affiliates
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    $policy$;
  END IF;
END;
$$;

