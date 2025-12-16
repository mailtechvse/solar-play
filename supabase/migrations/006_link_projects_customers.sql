-- Link Projects to Customers
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE CASCADE;

-- Add Battery Config to Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS battery_config jsonb DEFAULT '{}'::jsonb;

-- Update RLS for projects to allow access based on customer assignment
CREATE POLICY "Users can view projects for their customers" ON projects
  FOR SELECT
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects for their customers" ON projects
  FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT customer_id FROM user_customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects for their customers" ON projects
  FOR UPDATE
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT customer_id FROM user_customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects for their customers" ON projects
  FOR DELETE
  USING (
    customer_id IN (
      SELECT customer_id FROM user_customers WHERE user_id = auth.uid()
    )
  );
