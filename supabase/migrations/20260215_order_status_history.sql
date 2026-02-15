
-- 1. Create history table
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Index for performance
create index if not exists idx_order_status_history_order_id
  on public.order_status_history(order_id, created_at desc);

-- De-duplication constraint: prevent same status at same time for same order
create unique index if not exists uniq_order_status_history_event
  on public.order_status_history(order_id, new_status, created_at);

-- 2. Auto-write history on ANY status update (trigger)
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_by_profile_id uuid;
begin
  if new.status is distinct from old.status then
    -- Find the profile ID for the current authenticated user (who is a user_id)
    select id into v_changed_by_profile_id 
    from public.profiles 
    where user_id = auth.uid();

    insert into public.order_status_history(order_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, v_changed_by_profile_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_order_status_change on public.orders;

create trigger trg_log_order_status_change
after update of status on public.orders
for each row
execute function public.log_order_status_change();

-- 3. Auto-write history on order CREATION
create or replace function public.log_order_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Use consumer_profile_id as the creator to guarantee FK validity during booking
  insert into public.order_status_history(order_id, old_status, new_status, changed_by, created_at)
  values (new.id, null, new.status, new.consumer_profile_id, now());
  return new;
end;
$$;

drop trigger if exists trg_log_order_created on public.orders;

create trigger trg_log_order_created
after insert on public.orders
for each row
execute function public.log_order_created();

-- 4. Backfill initial status row for existing orders
insert into public.order_status_history(order_id, old_status, new_status, changed_by, created_at)
select o.id, null, o.status, o.consumer_profile_id, o.created_at
from public.orders o
where not exists (
  select 1 from public.order_status_history h where h.order_id = o.id
);

-- 5. RLS policies
alter table public.order_status_history enable row level security;

drop policy if exists "order_status_history_select_participants" on public.order_status_history;

create policy "order_status_history_select_participants"
on public.order_status_history
for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    join public.profiles p_current on (p_current.user_id = auth.uid())
    where o.id = order_status_history.order_id
      and (o.consumer_profile_id = p_current.id or o.specialist_profile_id = p_current.id)
  )
);

drop policy if exists "order_status_history_insert_none" on public.order_status_history;

create policy "order_status_history_insert_none"
on public.order_status_history
for insert
to authenticated
with check (false);
