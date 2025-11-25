-- Add default Load Box equipment
INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Load'),
  'Single Phase Load Box',
  'Solar Architect',
  'LOADBOX-1PH',
  '{"rated_power_kw": 5, "voltage": "220V", "frequency_hz": 50}'::jsonb,
  15000,
  0.5,
  0.6,
  '#f59e0b'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'LOADBOX-1PH');

INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Load'),
  'Three Phase Load Box',
  'Solar Architect',
  'LOADBOX-3PH',
  '{"rated_power_kw": 10, "voltage": "415V", "frequency_hz": 50}'::jsonb,
  25000,
  0.6,
  0.8,
  '#f59e0b'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'LOADBOX-3PH');

INSERT INTO equipment (type_id, name, manufacturer, model_number, specifications, cost, width, height, color)
SELECT
  (SELECT id FROM equipment_types WHERE name = 'Load'),
  'Industrial Load Box 30kW',
  'Solar Architect',
  'LOADBOX-30KW',
  '{"rated_power_kw": 30, "voltage": "415V", "frequency_hz": 50}'::jsonb,
  45000,
  1.0,
  1.2,
  '#f59e0b'
WHERE NOT EXISTS (SELECT 1 FROM equipment WHERE model_number = 'LOADBOX-30KW');
