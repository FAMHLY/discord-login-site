-- Create table to track daily subscription counts
-- This allows the bot to compare current subscriptions with previous day's count

CREATE TABLE IF NOT EXISTS daily_subscription_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_date DATE NOT NULL UNIQUE,
    total_active_subscriptions INTEGER NOT NULL,
    subscriptions_created INTEGER DEFAULT 0,
    subscriptions_cancelled INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient date queries
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_subscription_snapshots(snapshot_date DESC);

-- Add comment to document the table
COMMENT ON TABLE daily_subscription_snapshots IS 'Daily snapshots of subscription counts for tracking growth/decline';
COMMENT ON COLUMN daily_subscription_snapshots.snapshot_date IS 'Date of the snapshot (date only, no time)';
COMMENT ON COLUMN daily_subscription_snapshots.total_active_subscriptions IS 'Total number of active subscriptions on this date';
COMMENT ON COLUMN daily_subscription_snapshots.subscriptions_created IS 'Number of new subscriptions created since last snapshot';
COMMENT ON COLUMN daily_subscription_snapshots.subscriptions_cancelled IS 'Number of subscriptions cancelled since last snapshot';


