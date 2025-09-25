-- Affiliate tracking system for Discord server monetization
-- This allows tracking which affiliate referred each user

-- Create affiliate_tracking table
CREATE TABLE IF NOT EXISTS affiliate_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID REFERENCES discord_servers(id) ON DELETE CASCADE,
  discord_server_id VARCHAR(255) NOT NULL,
  invite_code VARCHAR(255) NOT NULL,
  affiliate_id VARCHAR(255), -- Discord user ID of the affiliate (null for direct/organic)
  click_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  join_timestamp TIMESTAMP WITH TIME ZONE, -- Set when user actually joins
  user_discord_id VARCHAR(255), -- Discord ID of the person who joined
  conversion_status VARCHAR(50) DEFAULT 'clicked', -- 'clicked', 'joined', 'converted_to_paid'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_server_id ON affiliate_tracking(discord_server_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_invite_code ON affiliate_tracking(invite_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_affiliate_id ON affiliate_tracking(affiliate_id);

-- Add stats columns to discord_servers table
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS total_invite_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_joins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS monthly_revenue DECIMAL(10,2) DEFAULT 0.00;

-- Enable RLS on affiliate_tracking table
ALTER TABLE affiliate_tracking ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to affiliate tracking (for invite redirects)
CREATE POLICY "Public can read affiliate tracking for invite redirects" 
ON affiliate_tracking 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (invite_code IS NOT NULL);

-- Create policy for authenticated users to manage their own affiliate tracking
CREATE POLICY "Users can manage their own affiliate tracking" 
ON affiliate_tracking 
AS PERMISSIVE 
FOR ALL 
TO authenticated 
USING (
  discord_server_id IN (
    SELECT discord_server_id 
    FROM discord_servers 
    WHERE owner_id = auth.uid()
  )
);
