-- Add stats tracking columns to discord_servers table
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS invite_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invites_accepted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS monthly_revenue DECIMAL(10,2) DEFAULT 0.00;

-- Update conversion rate calculation (this will be calculated dynamically in the future)
-- For now, we'll set it to 0 and calculate it in the application
UPDATE discord_servers 
SET conversion_rate = CASE 
  WHEN invite_clicks > 0 THEN (invites_accepted::DECIMAL / invite_clicks::DECIMAL) * 100
  ELSE 0
END;
