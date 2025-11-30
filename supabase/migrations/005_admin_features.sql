-- Add role to authorized_users
ALTER TABLE authorized_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Allow users to read their own authorization data (needed for admin checks)
CREATE POLICY "Users can read own authorization" ON authorized_users FOR SELECT TO authenticated USING (email = auth.email());

-- Add margin to equipment
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS margin DECIMAL(5, 2) DEFAULT 0;

-- Create Tax Slabs Table
CREATE TABLE IF NOT EXISTS tax_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  percentage DECIMAL(5, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Additional Items Table (for things like Net Metering, Installation)
CREATE TABLE IF NOT EXISTS additional_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  margin DECIMAL(5, 2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Plans Table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Plan Items Table (linking plans to equipment or additional items)
CREATE TABLE IF NOT EXISTS plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('equipment', 'additional')),
  item_id UUID NOT NULL, -- Can reference equipment.id or additional_items.id
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE tax_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE additional_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated Read Access
CREATE POLICY "Authenticated users can read tax slabs" ON tax_slabs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read additional items" ON additional_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read plans" ON plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read plan items" ON plan_items FOR SELECT TO authenticated USING (true);

-- Admin Write Access (using authorized_users table)
-- Note: This assumes the user is authenticated and their email is in authorized_users with role 'admin'
-- Since Supabase auth.email() is available, we can check against authorized_users

CREATE POLICY "Admins can manage tax slabs" ON tax_slabs
  USING (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'));

CREATE POLICY "Admins can manage additional items" ON additional_items
  USING (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'));

CREATE POLICY "Admins can manage plans" ON plans
  USING (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'));

CREATE POLICY "Admins can manage plan items" ON plan_items
  USING (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'));

-- Update Equipment Policies to allow Admins to manage
CREATE POLICY "Admins can manage equipment" ON equipment
  USING (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM authorized_users WHERE email = auth.email() AND role = 'admin'));
