-- Create server_roles table to map Discord server roles to Stripe price IDs
-- This allows each server to have custom subscription roles

CREATE TABLE IF NOT EXISTS server_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discord_server_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    stripe_price_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure one role per server/price combination
    UNIQUE(discord_server_id, stripe_price_id),
    -- Allow multiple roles per server but each role must be unique per server
    UNIQUE(discord_server_id, role_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_server_roles_server_id ON server_roles(discord_server_id);
CREATE INDEX IF NOT EXISTS idx_server_roles_price_id ON server_roles(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_server_roles_role_name ON server_roles(role_name);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_server_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_server_roles_updated_at ON server_roles;
CREATE TRIGGER trigger_update_server_roles_updated_at
    BEFORE UPDATE ON server_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_server_roles_updated_at();

-- Enable Row Level Security
ALTER TABLE server_roles ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON server_roles
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Server owners can view/manage roles for their servers
CREATE POLICY "Server owners can manage roles" ON server_roles
    FOR ALL USING (
        discord_server_id IN (
            SELECT discord_server_id 
            FROM discord_servers 
            WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        discord_server_id IN (
            SELECT discord_server_id 
            FROM discord_servers 
            WHERE owner_id = auth.uid()
        )
    );

-- Add comment to document the table
COMMENT ON TABLE server_roles IS 'Maps Discord server roles to Stripe price IDs for subscription management';
COMMENT ON COLUMN server_roles.discord_server_id IS 'Discord server ID this role is for';
COMMENT ON COLUMN server_roles.role_name IS 'Name of the Discord role to assign when subscribed';
COMMENT ON COLUMN server_roles.stripe_price_id IS 'Stripe price ID that grants this role';

