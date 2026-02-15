
-- Migration: Add specialist portfolio images, storage buckets, and profile policies
-- Created: 2026-02-16

-- 1. Create specialist_portfolio_images table
create table if not exists public.specialist_portfolio_images (
  id uuid primary key default gen_random_uuid(),
  specialist_profile_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  title text,
  created_at timestamptz not null default now()
);

-- Add indexes for performance
create index if not exists idx_portfolio_specialist_id
  on public.specialist_portfolio_images(specialist_profile_id);

-- 2. Enable RLS on the table
alter table public.specialist_portfolio_images enable row level security;

-- DROP existing policies if they exist (to allow rerunning migration)
drop policy if exists "Portfolio images are viewable by everyone" on public.specialist_portfolio_images;
drop policy if exists "Specialists can manage their own portfolio images" on public.specialist_portfolio_images;

-- CREATE policies
create policy "Portfolio images are viewable by everyone"
  on public.specialist_portfolio_images for select
  using (true);

create policy "Specialists can manage their own portfolio images"
  on public.specialist_portfolio_images for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = specialist_profile_id
        and p.user_id = auth.uid()
    )
  );

-- 3. Profiles table policies (Ensure users can update their own data)
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- 4. Set up Storage Buckets
-- Note: inserting directly into storage.buckets
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- 5. Enable Storage RLS
-- (Supabase storage.objects has RLS enabled by default)

-- DROP existing storage policies
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Portfolio images are publicly accessible" on storage.objects;
drop policy if exists "Specialists can upload portfolio images" on storage.objects;
drop policy if exists "Specialists can update their own portfolio images" on storage.objects;
drop policy if exists "Specialists can delete their own portfolio images" on storage.objects;

-- CREATE Storage policies

-- -- Avatars
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid()
    )
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid()
    )
  );

-- -- Portfolio
create policy "Portfolio images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'portfolio');

create policy "Specialists can upload portfolio images"
  on storage.objects for insert
  with check (
    bucket_id = 'portfolio' AND
    (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid() and role = 'specialist'
    )
  );

create policy "Specialists can update their own portfolio images"
  on storage.objects for update
  using (
    bucket_id = 'portfolio' AND
    (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid()
    )
  );

create policy "Specialists can delete their own portfolio images"
  on storage.objects for delete
  using (
    bucket_id = 'portfolio' AND
    (storage.foldername(name))[1] in (
      select id::text from public.profiles where user_id = auth.uid()
    )
  );
