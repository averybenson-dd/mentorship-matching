-- Mentorship program: applications + program state.
-- All reads/writes from the web app go through the mentor-backend Edge Function (service role),
-- except you may optionally grant anon access later — default is no direct table access.

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  role text not null check (role in ('mentor', 'mentee')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_unique_email_role unique (email_normalized, role)
);

create index if not exists applications_created_at_idx on public.applications (created_at desc);

create table if not exists public.program_state (
  id int primary key default 1 check (id = 1),
  published boolean not null default false,
  matches jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.program_state (id, published, matches)
values (1, false, '[]'::jsonb)
on conflict (id) do nothing;

alter table public.applications enable row level security;
alter table public.program_state enable row level security;

-- Deny anonymous/authenticated direct access; Edge Function uses service role.
-- (No policies => only service role can access.)
