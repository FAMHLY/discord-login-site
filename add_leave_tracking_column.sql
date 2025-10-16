-- Add leave_timestamp column to affiliate_tracking table for member leave tracking
-- This enables accurate counting of active vs inactive members

-- Add the leave_timestamp column
ALTER TABLE affiliate_tracking 
ADD COLUMN IF NOT EXISTS leave_timestamp TIMESTAMPTZ;

-- Add an index for better performance on leave_timestamp queries
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_leave_timestamp 
ON affiliate_tracking(leave_timestamp) 
WHERE leave_timestamp IS NOT NULL;

-- Add an index for active member queries (joined but not left)
CREATE INDEX IF NOT EXISTS idx_affiliate_tracking_active_members 
ON affiliate_tracking(discord_server_id, conversion_status, leave_timestamp) 
WHERE conversion_status = 'joined' AND leave_timestamp IS NULL;

-- Update any existing 'joined' records to have NULL leave_timestamp (they're still active)
UPDATE affiliate_tracking 
SET leave_timestamp = NULL 
WHERE conversion_status = 'joined' AND leave_timestamp IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN affiliate_tracking.leave_timestamp IS 'Timestamp when the user left the Discord server. NULL means they are still active.';
