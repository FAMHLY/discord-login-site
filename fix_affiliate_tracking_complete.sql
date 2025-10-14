-- Complete fix for affiliate tracking RLS policies
-- This allows unauthenticated users to create tracking records when clicking invite links

-- First, ensure the affiliate_tracking table exists with all necessary columns
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_server_id ON affiliate_tracking(discord_server_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_invite_code ON affiliate_tracking(invite_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_affiliate_id ON affiliate_tracking(affiliate_id);

-- Add stats columns to discord_servers table if they don't exist
ALTER TABLE discord_servers 
ADD COLUMN IF NOT EXISTS total_invite_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_joins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS monthly_revenue DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS owner_discord_id VARCHAR(255);

-- Enable RLS on affiliate_tracking table
ALTER TABLE affiliate_tracking ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Public can read affiliate tracking for invite redirects" ON affiliate_tracking;
DROP POLICY IF EXISTS "Users can manage their own affiliate tracking" ON affiliate_tracking;
DROP POLICY IF EXISTS "Public can insert affiliate tracking" ON affiliate_tracking;
DROP POLICY IF EXISTS "Users can insert their own affiliate tracking" ON affiliate_tracking;

-- Create policy for public read access to affiliate tracking (for invite redirects)
CREATE POLICY "Public can read affiliate tracking for invite redirects" 
ON affiliate_tracking 
AS PERMISSIVE 
FOR SELECT 
TO public 
USING (invite_code IS NOT NULL);

-- Create policy for public inserts (this is the key fix!)
CREATE POLICY "Public can insert affiliate tracking"
ON affiliate_tracking
AS PERMISSIVE 
FOR INSERT
TO public
WITH CHECK (true);

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

-- Grant necessary permissions
GRANT SELECT ON affiliate_tracking TO public;
GRANT INSERT ON affiliate_tracking TO public;
GRANT ALL ON affiliate_tracking TO authenticated;

-- Verify the setup
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'affiliate_tracking';
