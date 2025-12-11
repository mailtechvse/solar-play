-- Secure Function to Assign Users by Email
-- This avoids exposing the entire auth.users table to the client
create or replace function public.assign_user_to_customer_by_email(
    p_email text,
    p_customer_id uuid,
    p_role text default 'viewer'
)
returns jsonb
language plpgsql
security definer -- Runs with privileges of the creator (likely admin/postgres), bypassing RLS
as $$
declare
    target_user_id uuid;
begin
    -- 1. Find the User ID from auth.users
    select id into target_user_id
    from auth.users
    where email = p_email;

    if target_user_id is null then
        return jsonb_build_object('success', false, 'message', 'User not found');
    end if;

    -- 2. Insert or Update the mapping
    insert into public.user_customers (user_id, customer_id, role)
    values (target_user_id, p_customer_id, p_role)
    on conflict (user_id, customer_id) 
    do update set role = excluded.role;

    return jsonb_build_object('success', true, 'user_id', target_user_id);
end;
$$;

-- Secure Function to List Users assigned to a Customer (returning emails)
create or replace function public.get_customer_users(p_customer_id uuid)
returns table (
    user_id uuid,
    email varchar,
    role text,
    assigned_at timestamptz
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        uc.user_id,
        au.email::varchar, -- Cast to ensure type compatibility
        uc.role,
        uc.created_at as assigned_at
    from public.user_customers uc
    join auth.users au on au.id = uc.user_id
    where uc.customer_id = p_customer_id;
end;
$$;
