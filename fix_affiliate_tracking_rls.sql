-- Fix RLS policy for affiliate_tracking table to allow public inserts
-- This allows unauthenticated users to create tracking records when clicking invite links

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert their own affiliate tracking" ON affiliate_tracking;

-- Create a new policy that allows public inserts for tracking
CREATE POLICY "Public can insert affiliate tracking"
ON affiliate_tracking
FOR INSERT
TO public
WITH CHECK (true);

-- Ensure the table allows public access for inserts
ALTER TABLE affiliate_tracking ENABLE ROW LEVEL SECURITY;

