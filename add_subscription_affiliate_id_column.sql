ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS affiliate_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_affiliate
  ON subscriptions(affiliate_id)
  WHERE affiliate_id IS NOT NULL;

