-- Discord Server Monetization Platform Database Schema
-- Phase 1: Server Management and Free Tier Invites

-- Server owners table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS server_owners (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  discord_user_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discord servers table
CREATE TABLE IF NOT EXISTS discord_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES server_owners(id) ON DELETE CASCADE,
  discord_server_id VARCHAR(255) NOT NULL UNIQUE,
  server_name VARCHAR(255) NOT NULL,
  invite_code VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discord_servers_owner_id ON discord_servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_discord_servers_discord_id ON discord_servers(discord_server_id);
CREATE INDEX IF NOT EXISTS idx_discord_servers_invite_code ON discord_servers(invite_code);

-- Enable Row Level Security (RLS)
ALTER TABLE server_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_servers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for server_owners
CREATE POLICY "Users can view their own server owner record" ON server_owners
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own server owner record" ON server_owners
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own server owner record" ON server_owners
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for discord_servers
CREATE POLICY "Users can view their own servers" ON discord_servers
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own servers" ON discord_servers
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own servers" ON discord_servers
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own servers" ON discord_servers
  FOR DELETE USING (auth.uid() = owner_id);

-- Function to automatically create server_owner record when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.server_owners (id, email, discord_user_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'discord_id');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create server_owner record
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_server_owners_updated_at
  BEFORE UPDATE ON server_owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discord_servers_updated_at
  BEFORE UPDATE ON discord_servers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
