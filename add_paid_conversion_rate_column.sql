-- Add paid_conversion_rate column to discord_servers table for Stripe integration
-- This will track the percentage of active members who upgrade to paid tiers

-- Add the paid_conversion_rate column
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS paid_conversion_rate DECIMAL(5,2) DEFAULT 0.00;

-- Add a comment to document the column
COMMENT ON COLUMN discord_servers.paid_conversion_rate IS 'Percentage of active members who have upgraded to paid tiers (for Stripe integration). Calculated as (paid_members / active_members) * 100.';

-- Update existing records to have 0% paid conversion rate (no paid members yet)
UPDATE discord_servers 
SET paid_conversion_rate = 0.00 
WHERE paid_conversion_rate IS NULL;
