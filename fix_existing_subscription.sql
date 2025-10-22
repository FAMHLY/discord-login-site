-- Fix existing subscription record by adding discord_user_id
-- This updates the subscription created before the discord_user_id column was added

-- First, let's see what subscriptions exist
SELECT * FROM subscriptions;

-- Update the subscription record to include discord_user_id
-- Replace 'YOUR_DISCORD_USER_ID' with your actual Discord user ID (210250076281372673)
UPDATE subscriptions 
SET discord_user_id = '210250076281372673'
WHERE discord_user_id IS NULL 
AND stripe_customer_id IS NOT NULL;

-- Verify the update
SELECT * FROM subscriptions;

