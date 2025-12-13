-- Add role_name column to subscriptions table
-- This stores which role should be assigned for each subscription

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS role_name TEXT;

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_role_name ON subscriptions(role_name);

-- Add comment to document the column
COMMENT ON COLUMN subscriptions.role_name IS 'Discord role name to assign when this subscription is active';

