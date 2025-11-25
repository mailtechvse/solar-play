-- Equipment Types Table
CREATE TABLE IF NOT EXISTS equipment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  key_specs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Table
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id UUID NOT NULL REFERENCES equipment_types(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  model_number VARCHAR(255),
  specifications JSONB NOT NULL DEFAULT '{}',
  cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  depth DECIMAL(10, 2),
  unit_of_measurement VARCHAR(50) DEFAULT 'meters',
  color VARCHAR(7) DEFAULT '#1e3a8a',
  image_url VARCHAR(500),
  spec_sheet_url VARCHAR(500),
  is_custom BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Spec Sheets Table
CREATE TABLE IF NOT EXISTS spec_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  extracted_specs JSONB DEFAULT '{}',
  extraction_status VARCHAR(50) DEFAULT 'pending',
  extraction_error TEXT,
  gemini_response JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Presets Table (for quick access)
CREATE TABLE IF NOT EXISTS equipment_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  equipment_ids UUID[] NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes
CREATE INDEX idx_equipment_type_id ON equipment(type_id);
CREATE INDEX idx_equipment_is_active ON equipment(is_active);
CREATE INDEX idx_equipment_created_by ON equipment(created_by);
CREATE INDEX idx_spec_sheets_equipment_id ON spec_sheets(equipment_id);
CREATE INDEX idx_spec_sheets_status ON spec_sheets(extraction_status);
CREATE INDEX idx_presets_created_by ON equipment_presets(created_by);
CREATE INDEX idx_presets_category ON equipment_presets(category);

-- Insert Default Equipment Types
INSERT INTO equipment_types (name, description, key_specs) VALUES
  ('Solar Panel', 'Photovoltaic panel for solar energy generation', '{"watts": "numeric", "efficiency": "percentage", "technology": "text", "temperature_coefficient": "numeric"}'::jsonb),
  ('Inverter', 'Device to convert DC power to AC power', '{"capacity_kw": "numeric", "efficiency": "percentage", "input_voltage": "text", "output_voltage": "text"}'::jsonb),
  ('Battery', 'Energy storage device', '{"capacity_kwh": "numeric", "chemistry": "text", "voltage": "text", "charge_rate": "numeric"}'::jsonb),
  ('BOS', 'Balance of System components (switches, panels, meters)', '{"voltage_rating": "text", "current_rating": "numeric", "protection_type": "text"}'::jsonb),
  ('Transformer', 'Step-up/Step-down transformer', '{"voltage_ratio": "text", "capacity_kva": "numeric", "cooling_type": "text"}'::jsonb),
  ('Safety', 'Safety equipment (LA, earthing, etc)', '{"protection_type": "text", "rating": "numeric"}'::jsonb),
  ('Structure', 'Mounting structure for components', '{"material": "text", "weight_capacity_kg": "numeric", "adjustable": "boolean"}'::jsonb),
  ('Load', 'Load/Consumer equipment', '{"rated_power_kw": "numeric", "voltage": "text", "frequency_hz": "numeric"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Sample Equipment Data
INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Solar Panel'),
  'Solar Panel 330W',
  'Sunwatt Solar',
  'SW-330',
  '{"watts": 330, "efficiency": 18.5, "technology": "Monocrystalline", "temperature_coefficient": -0.43}'::jsonb,
  9000,
  1.0,
  2.0,
  '#1e3a8a'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'SW-330');

INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Inverter'),
  'Micro Inverter 500W',
  'APSystems',
  'APM0500',
  '{"capacity_kw": 0.5, "efficiency": 96.5, "input_voltage": "200-450V DC", "output_voltage": "220V AC"}'::jsonb,
  8000,
  0.3,
  0.3,
  '#ef4444'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'APM0500');

INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Battery'),
  'Lithium Battery 5kWh',
  'BYD',
  'HMT5.12',
  '{"capacity_kwh": 5, "chemistry": "LiFePO4", "voltage": "51.2V", "charge_rate": 50}'::jsonb,
  120000,
  0.8,
  1.2,
  '#22c55e'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'HMT5.12');

-- Enable RLS
ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment_types (public read)
CREATE POLICY "Public can read equipment types"
  ON equipment_types FOR SELECT
  USING (true);

-- RLS Policies for equipment (public read, authenticated write)
CREATE POLICY "Public can read active equipment"
  ON equipment FOR SELECT
  USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Users can insert equipment"
  ON equipment FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their equipment"
  ON equipment FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their equipment"
  ON equipment FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for spec_sheets
CREATE POLICY "Users can read spec sheets"
  ON spec_sheets FOR SELECT
  USING (created_by = auth.uid() OR (SELECT created_by FROM equipment WHERE id = equipment_id) = auth.uid());

CREATE POLICY "Users can insert spec sheets"
  ON spec_sheets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their spec sheets"
  ON spec_sheets FOR UPDATE
  USING (created_by = auth.uid());

-- RLS Policies for equipment_presets
CREATE POLICY "Users can read their presets"
  ON equipment_presets FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert presets"
  ON equipment_presets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their presets"
  ON equipment_presets FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their presets"
  ON equipment_presets FOR DELETE
  USING (created_by = auth.uid());
