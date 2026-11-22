-- RedBookPrep Digital SAT Platform — Core PostgreSQL & RLS Schema
-- Covers Phases 0–5: Auth profiles, native R&W/Math (MCQ + SPR) question bank,
-- attempts & mistake tracking, adaptive mock exams, study planner, redCoach AI
-- threads & student memory, SM-2 vocab progress, collections, daily drops,
-- Stripe subscriptions, and guardian read-only portal.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. PROFILES & SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default 'Student',
  avatar_url text,
  exam_track text not null default 'sat' check (exam_track in ('sat', 'psat', 'gre')),
  target_score integer not null default 1400 check (target_score between 400 and 1600),
  target_rw integer not null default 700 check (target_rw between 200 and 800),
  target_math integer not null default 700 check (target_math between 200 and 800),
  test_date date,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'plus', 'pro')),
  sparks_balance integer not null default 10,
  sparks_weekly_used integer not null default 0,
  sparks_week_key text,
  streak_count integer not null default 0,
  longest_streak integer not null default 0,
  streak_freezes integer not null default 1,
  last_study_date date,
  sound_enabled boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  status text not null default 'inactive',
  billing_interval text check (billing_interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  sponsored_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast cross-device study workspace snapshot for instant hydration + merge
create table if not exists public.user_study_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  attempts jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  goals jsonb not null default '{}'::jsonb,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. NATIVE QUESTION REPOSITORY (MCQ + SPR) & ATTEMPTS
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id text primary key,
  exam_track text not null default 'sat' check (exam_track in ('sat', 'psat', 'gre')),
  section text not null check (section in ('Reading and Writing', 'Math')),
  domain text not null,
  skill text not null,
  module_id text,
  module_title text,
  question_type text not null default 'mcq' check (question_type in ('mcq', 'spr')),
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  is_challenge boolean not null default false,
  passage_title text default '',
  passage_markdown text default '',
  prompt_markdown text not null,
  svg_diagram text,
  image_url text,
  choices jsonb not null default '[]'::jsonb,
  correct_choice smallint,
  spr_answers text[] not null default '{}',
  explanation_methods jsonb not null default '[]'::jsonb,
  desmos_expressions jsonb not null default '[]'::jsonb,
  peer_time_p25 integer,
  peer_time_p50 integer,
  peer_time_p75 integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_questions_filter
  on public.questions (exam_track, section, domain, skill, difficulty);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null,
  selected_choice smallint,
  spr_response text,
  is_correct boolean not null default false,
  time_seconds integer not null default 0 check (time_seconds >= 0),
  error_cause text not null default '',
  personal_note text not null default '',
  review_date date,
  resolved_at timestamptz,
  attempted_at timestamptz not null default now(),
  unique (user_id, question_id, attempted_at)
);

create index if not exists idx_question_attempts_user
  on public.question_attempts (user_id, attempted_at desc);

-- ---------------------------------------------------------------------------
-- 3. FULL-LENGTH ADAPTIVE MOCK TESTS
-- ---------------------------------------------------------------------------
create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_track text not null default 'sat',
  test_code text not null,
  mode text not null default 'full' check (mode in ('full', 'rw_only', 'math_only', 'rush')),
  status text not null default 'in_progress' check (status in ('in_progress', 'paused', 'completed')),
  current_section text not null default 'rw',
  current_module smallint not null default 1,
  answers jsonb not null default '{}'::jsonb,
  flagged text[] not null default '{}',
  eliminated jsonb not null default '{}'::jsonb,
  module1_rw_raw smallint,
  module2_rw_path text check (module2_rw_path in ('easier', 'harder')),
  module2_rw_raw smallint,
  module1_math_raw smallint,
  module2_math_path text check (module2_math_path in ('easier', 'harder')),
  module2_math_raw smallint,
  rw_score smallint,
  math_score smallint,
  total_score smallint,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_test_attempts_user
  on public.test_attempts (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 4. ADAPTIVE STUDY PLANNER
-- ---------------------------------------------------------------------------
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_date date,
  daily_minutes integer not null default 30,
  study_days integer[] not null default '{1,2,3,4,5,6}',
  baseline_rw integer,
  baseline_math integer,
  target_score integer not null default 1400,
  focus_domains text[] not null default '{}',
  auto_adapt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  domain text,
  skill text,
  task_type text not null default 'drill' check (task_type in ('drill', 'vocab', 'review', 'mock', 'lesson')),
  estimated_minutes integer not null default 15,
  scheduled_date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_study_tasks_user_date
  on public.study_tasks (user_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- 5. ASK REDCOACH AI THREADS & STUDENT MEMORY
-- ---------------------------------------------------------------------------
create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New SAT coaching session',
  persona text not null default 'socratic' check (persona in ('socratic', 'direct', '5yo', 'speedrun')),
  linked_question_id text,
  is_bookmarked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  effort text,
  desmos_expressions jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.student_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  memory_type text not null default 'weakness',
  summary text not null,
  source_thread_id uuid references public.ai_threads(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. VOCABULARY SM-2 PROGRESS & CUSTOM DECKS
-- ---------------------------------------------------------------------------
create table if not exists public.vocab_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null,
  deck_id text not null,
  ease_factor real not null default 2.5,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  mastered boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- ---------------------------------------------------------------------------
-- 7. COLLECTIONS (BOOKMARKS) & DAILY DROPS
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default 'amber',
  created_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null,
  note text default '',
  added_at timestamptz not null default now(),
  primary key (collection_id, question_id)
);

create table if not exists public.daily_drops (
  drop_date date primary key,
  rw_question_id text not null,
  math_question_id text not null,
  is_challenge_sunday boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  drop_date date not null references public.daily_drops(drop_date) on delete cascade,
  rw_completed boolean not null default false,
  math_completed boolean not null default false,
  bonus_sparks_awarded boolean not null default false,
  completed_at timestamptz not null default now(),
  primary key (user_id, drop_date)
);

-- ---------------------------------------------------------------------------
-- 8. GUARDIAN READ-ONLY PORTAL & SPONSORS
-- ---------------------------------------------------------------------------
create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.profiles(id) on delete cascade,
  guardian_email text not null,
  relationship text not null default 'parent',
  weekly_summary_opt_in boolean not null default true,
  share_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_user_id, guardian_email)
);

-- ---------------------------------------------------------------------------
-- 9. UPDATED_AT TRIGGERS & AUTO-PROFILE SIGNUP HOOK
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists trg_study_state_updated_at on public.user_study_state;
create trigger trg_study_state_updated_at
  before update on public.user_study_state
  for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'Student'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. ROW-LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_study_state enable row level security;
alter table public.questions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.test_attempts enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.student_memory enable row level security;
alter table public.vocab_progress enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.daily_drops enable row level security;
alter table public.daily_completions enable row level security;
alter table public.guardian_links enable row level security;

create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users view own subscription" on public.subscriptions for select using (auth.uid() = user_id);

create policy "Users manage own study state" on public.user_study_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Authenticated users read questions metadata" on public.questions
  for select using (true);

create policy "Users manage own attempts" on public.question_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own test attempts" on public.test_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own study plans" on public.study_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own study tasks" on public.study_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own ai threads" on public.ai_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own ai messages" on public.ai_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own student memory" on public.student_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own vocab progress" on public.vocab_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own collections" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own collection items" on public.collection_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Anyone can read daily drops" on public.daily_drops
  for select using (true);

create policy "Users manage own daily completions" on public.daily_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Students manage own guardian links" on public.guardian_links
  for all using (auth.uid() = student_user_id) with check (auth.uid() = student_user_id);

-- Storage buckets (SVGs + College Board PDF score reports)
insert into storage.buckets (id, name, public)
values ('question-diagrams', 'question-diagrams', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('score-reports', 'score-reports', false)
on conflict (id) do nothing;
