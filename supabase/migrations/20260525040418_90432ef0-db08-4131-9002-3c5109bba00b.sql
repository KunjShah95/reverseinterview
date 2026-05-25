
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  company text,
  source_type text not null,
  source_text text,
  source_file_url text,
  structured_input jsonb default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analyses_session_id_idx on public.analyses(session_id);
create index analyses_created_at_idx on public.analyses(created_at desc);

alter table public.analyses enable row level security;

-- Anonymous demo: anyone can insert / read / update by id.
create policy "anyone can insert analyses"
  on public.analyses for insert
  to anon, authenticated
  with check (true);

create policy "anyone can read analyses"
  on public.analyses for select
  to anon, authenticated
  using (true);

create policy "anyone can update analyses"
  on public.analyses for update
  to anon, authenticated
  using (true)
  with check (true);

-- Storage bucket for uploaded PDFs / screenshots
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "anyone can upload to uploads"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'uploads');

create policy "anyone can read uploads"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'uploads');
