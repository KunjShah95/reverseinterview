alter table public.analyses
  add column if not exists progress jsonb not null default '{}'::jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

