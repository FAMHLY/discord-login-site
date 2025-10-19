-- Add discord_user_id column to subscriptions table for role assignment
-- This enables the bot to assign roles based on Discord user ID instead of Stripe customer ID

-- Add the discord_user_id column
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS discord_user_id TEXT;

-- Add an index for better performance on discord_user_id queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_discord_user_id 
ON subscriptions(discord_user_id) 
WHERE discord_user_id IS NOT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN subscriptions.discord_user_id IS 'Discord user ID for role assignment. Links Stripe customers to Discord users.';
