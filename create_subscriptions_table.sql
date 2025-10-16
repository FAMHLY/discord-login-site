-- Create subscriptions table for Stripe integration
-- This table tracks paid subscriptions for Discord servers

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    discord_server_id TEXT NOT NULL,
    discord_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    price_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_discord_server_id ON subscriptions(discord_server_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(discord_server_id, status) WHERE status = 'active';

-- Add foreign key constraint to discord_servers table
ALTER TABLE subscriptions 
ADD CONSTRAINT fk_subscriptions_discord_server 
FOREIGN KEY (discord_server_id) 
REFERENCES discord_servers(discord_server_id) 
ON DELETE CASCADE;

-- Add comments to document the table
COMMENT ON TABLE subscriptions IS 'Tracks Stripe subscriptions for Discord server monetization';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe subscription ID (unique identifier)';
COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN subscriptions.discord_server_id IS 'Discord server ID this subscription is for';
COMMENT ON COLUMN subscriptions.discord_user_id IS 'Discord user ID of the subscriber (if available)';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, cancelled, past_due, etc.';
COMMENT ON COLUMN subscriptions.price_id IS 'Stripe price ID for the subscription plan';
COMMENT ON COLUMN subscriptions.current_period_start IS 'When the current billing period started';
COMMENT ON COLUMN subscriptions.current_period_end IS 'When the current billing period ends';
COMMENT ON COLUMN subscriptions.cancelled_at IS 'When the subscription was cancelled (if applicable)';
COMMENT ON COLUMN subscriptions.metadata IS 'Additional metadata from Stripe';

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();

-- Create RLS policies for subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR SELECT USING (
        discord_user_id IN (
            SELECT user_metadata->>'provider_id'
            FROM auth.users 
            WHERE id = auth.uid()
        )
    );

-- Policy: Service role can do everything (for webhooks)
CREATE POLICY "Service role full access" ON subscriptions
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Policy: Users can view subscriptions for servers they own
CREATE POLICY "Server owners can view subscriptions" ON subscriptions
    FOR SELECT USING (
        discord_server_id IN (
            SELECT discord_server_id 
            FROM discord_servers 
            WHERE owner_id = auth.uid()
        )
    );
