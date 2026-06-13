-- Mirror of the Next.js app's snapshot table, in case this service runs first.
create table if not exists radar_snapshots (
  id text primary key,
  source text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text,
  first_name text,
  last_name text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_approvals (
  user_id text not null references users(id) on delete cascade,
  finding_id text not null,
  status text not null check (status in ('pending','approved','needs_info')),
  note text,
  updated_at timestamptz not null default now(),
  primary key (user_id, finding_id)
);

create table if not exists user_watchlist (
  user_id text not null references users(id) on delete cascade,
  finding_id text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, finding_id)
);

create table if not exists user_dismissals (
  user_id text not null references users(id) on delete cascade,
  finding_id text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, finding_id)
);

create table if not exists user_read_state (
  user_id text not null references users(id) on delete cascade,
  finding_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, finding_id)
);

create index if not exists user_approvals_user_idx on user_approvals(user_id);
create index if not exists user_watchlist_user_idx on user_watchlist(user_id);
create index if not exists user_dismissals_user_idx on user_dismissals(user_id);
create index if not exists user_read_state_user_idx on user_read_state(user_id);
