create table if not exists authorized_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table authorized_users enable row level security;

-- Remove any previously created public policies to ensure security
drop policy if exists "Allow read access to authenticated users" on authorized_users;

-- Only Service Role can access this table now.
