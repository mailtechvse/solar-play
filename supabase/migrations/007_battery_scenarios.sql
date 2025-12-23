-- Create Battery Scenarios Table
CREATE TABLE IF NOT EXISTS public.battery_scenarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.battery_scenarios ENABLE ROW LEVEL SECURITY;

-- 1. Users can view scenarios for customers they are assigned to
CREATE POLICY "Users can view scenarios for assigned customers" ON public.battery_scenarios
    FOR SELECT USING (
        customer_id IN (
            SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid()
        )
    );

-- 2. Users can create scenarios for customers they are assigned to
CREATE POLICY "Users can create scenarios for assigned customers" ON public.battery_scenarios
    FOR INSERT WITH CHECK (
        customer_id IN (
            SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid()
        )
    );

-- 3. Users can update scenarios for customers they are assigned to
CREATE POLICY "Users can update scenarios for assigned customers" ON public.battery_scenarios
    FOR UPDATE USING (
        customer_id IN (
            SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        customer_id IN (
            SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid()
        )
    );

-- 4. Users can delete scenarios for customers they are assigned to
CREATE POLICY "Users can delete scenarios for assigned customers" ON public.battery_scenarios
    FOR DELETE USING (
        customer_id IN (
            SELECT customer_id FROM public.user_customers WHERE user_id = auth.uid()
        )
    );

-- 5. Admins can manage all scenarios
CREATE POLICY "Admins can manage all scenarios" ON public.battery_scenarios
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.authorized_users WHERE email = auth.email() AND role = 'admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.authorized_users WHERE email = auth.email() AND role = 'admin')
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_battery_scenarios_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS battery_scenarios_updated_at_trigger ON public.battery_scenarios;
CREATE TRIGGER battery_scenarios_updated_at_trigger
  BEFORE UPDATE ON public.battery_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_battery_scenarios_timestamp();
