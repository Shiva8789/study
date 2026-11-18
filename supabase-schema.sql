-- STUDORA Supabase PostgreSQL Schema for Project: gsgvzpatttluwlpihawy
-- REST Endpoint: https://gsgvzpatttluwlpihawy.supabase.co/rest/v1/
-- Run this SQL in your Supabase Dashboard -> SQL Editor to create all tables.

create table if not exists public.studora_profiles (
  uid text primary key,
  display_name text not null,
  photo_url text default '',
  branch text default 'General Studies',
  semester text default 'Semester 1',
  bio text default '',
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studora_subjects (
  id text primary key,
  owner_id text not null,
  name text not null,
  category text default 'Custom Subject',
  description text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studora_courses (
  id text primary key,
  owner_id text not null,
  code text not null,
  title text not null,
  instructor text default '',
  term text default 'Fall 2026',
  color text default '#1D4ED8',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studora_tasks (
  id text primary key,
  owner_id text not null,
  title text not null,
  course_id text not null default 'general',
  due_date text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'completed')),
  notes text default '',
  attachment_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studora_public_contents (
  id text primary key,
  owner_id text not null,
  author_name text not null,
  kind text not null default 'file' check (kind in ('file', 'note', 'link', 'portrait')),
  title text not null,
  description text default '',
  course_code text not null default 'GENERAL',
  subject text not null default 'Other Subjects',
  course_branch text not null default 'General',
  semester text not null default 'General',
  topic text not null default 'General',
  file_type text not null default 'OTHER',
  original_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  file_path text,
  content_text text,
  url text,
  era_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studora_tasks_owner on public.studora_tasks (owner_id, due_date);
create index if not exists idx_studora_contents_subject on public.studora_public_contents (subject, semester, created_at desc);

alter table public.studora_profiles enable row level security;
alter table public.studora_subjects enable row level security;
alter table public.studora_courses enable row level security;
alter table public.studora_tasks enable row level security;
alter table public.studora_public_contents enable row level security;

-- Public read access for shared Study Library & Subjects
drop policy if exists "Public read studora_public_contents" on public.studora_public_contents;
create policy "Public read studora_public_contents"
  on public.studora_public_contents for select
  using (true);

drop policy if exists "Public read studora_subjects" on public.studora_subjects;
create policy "Public read studora_subjects"
  on public.studora_subjects for select
  using (true);
