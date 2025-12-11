-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";
create extension if not exists "supabase_vault" with schema "vault";

-- Customers Table
create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text,
    phone text,
    email text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Manufacturer Integrations (storing secrets)
-- We use a table to link customers to manufacturers, and credential IDs point to Vault
create table if not exists public.customer_integrations (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references public.customers(id) on delete cascade,
    manufacturer text not null check (manufacturer in ('growatt', 'goodwe', 'deye', 'sungrow')),
    api_endpoint text, -- Optional override
    
    -- Keys for Vault secrets (we store the secret ID here)
    api_key_secret_id uuid, 
    api_secret_secret_id uuid,
    
    -- Status
    is_active boolean default true,
    last_sync_at timestamptz,
    sync_status text default 'pending', -- success, error, pending
    
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Devices Table (Inverters, Meters, etc.)
create table if not exists public.devices (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references public.customers(id) on delete cascade,
    integration_id uuid references public.customer_integrations(id) on delete cascade,
    
    external_id text not null, -- Serial number or ID from manufacturer
    name text not null,
    type text not null, -- Inverter, Meter, Battery
    model text,
    
    status text default 'offline',
    metadata jsonb default '{}'::jsonb, -- Store extra info like firmware version
    
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    unique(integration_id, external_id)
);

-- Telemetry Data (Time-series)
create table if not exists public.device_readings (
    id uuid primary key default gen_random_uuid(),
    device_id uuid references public.devices(id) on delete cascade,
    
    timestamp timestamptz not null default now(),
    
    -- Common metrics
    power_watts numeric, -- Current power
    energy_day_wh numeric, -- Daily generation
    energy_total_wh numeric, -- Lifetime generation
    
    -- Battery specifics
    battery_soc numeric, -- %
    battery_power_watts numeric, -- + charge, - discharge
    
    -- Grid specifics
    grid_voltage numeric,
    grid_frequency numeric,
    grid_import_total_wh numeric,
    grid_export_total_wh numeric,
    
    raw_data jsonb default '{}'::jsonb -- Store full raw payload just in case
);

-- Create index for time-series queries
create index if not exists idx_device_readings_device_time on public.device_readings(device_id, timestamp desc);

-- User-Customer Mapping (Many-to-Many with Roles)
create table if not exists public.user_customers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    customer_id uuid references public.customers(id) on delete cascade not null,
    role text default 'viewer', -- 'admin', 'editor', 'viewer'
    created_at timestamptz default now(),
    unique(user_id, customer_id)
);

-- RLS Policies
alter table public.user_customers enable row level security;
alter table public.customers enable row level security;
alter table public.customer_integrations enable row level security;
alter table public.devices enable row level security;
alter table public.device_readings enable row level security;

-- Policy Helper Function (Optional but cleaner, using direct subqueries for performance awareness in Supabase)

-- 1. User Customers: Users can see their own assignments
create policy "Users can view their own assignments" on public.user_customers
    for select using (auth.uid() = user_id);

-- Admin Management for User Customers
create policy "Admins can manage user customers" on public.user_customers
    for all 
    using (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'))
    with check (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'));

-- 2. Customers: Users can view customers they are assigned to
create policy "Users can view assigned customers" on public.customers
    for select using (
        id in (select customer_id from public.user_customers where user_id = auth.uid())
    );

-- Admin Management for Customers
create policy "Admins can manage customers" on public.customers
    for all 
    using (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'))
    with check (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'));

-- 3. Integrations: Access based on customer assignment
create policy "Users can view assigned customer integrations" on public.customer_integrations
    for select using ( -- Changed from 'all' to 'select' for non-admins
        customer_id in (select customer_id from public.user_customers where user_id = auth.uid())
    );

create policy "Admins can manage integrations" on public.customer_integrations
    for all 
    using (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'))
    with check (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'));

-- 4. Devices: Access based on customer assignment
create policy "Users can view assigned customer devices" on public.devices
    for select using (
        customer_id in (select customer_id from public.user_customers where user_id = auth.uid())
    );

create policy "Admins can manage devices" on public.devices
    for all 
    using (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'))
    with check (exists (select 1 from authorized_users where email = auth.email() and role = 'admin'));

-- 5. Readings: Access based on device -> customer assignment
create policy "Users can view assigned device readings" on public.device_readings
    for select using (
        device_id in (
            select id from public.devices where customer_id in (
                select customer_id from public.user_customers where user_id = auth.uid()
            )
        )
    );

-- Cron Job Setup
-- IMPORTANT: The Authorization header requires a valid Service Role Key to invoke the Edge Function securely.
-- Since we cannot hardcode secrets in migrations, you must update this cron job manually in the Supabase Dashboard
-- or use a Vault secret if configured to inject it.
--
-- Below is the template. Replace 'YOUR_SERVICE_ROLE_KEY' with the actual key.

-- Cron Job Template
-- select cron.schedule(
--    'fetch-solar-data',
--    '* * * * *', -- Every minute (changed to avoid block comment issue) or use 5 mins
--    $$
--    select
--      net.http_post(
--          url:='https://project-ref.supabase.co/functions/v1/fetch-manufacturer-data',
--          headers:=jsonb_build_object(
--              'Content-Type', 'application/json',
--              'Authorization', 'Bearer ' || 'YOUR_SERVICE_ROLE_KEY'
--          ),
--          body:='{}'::jsonb
--      ) as request_id;
--    $$
-- );
