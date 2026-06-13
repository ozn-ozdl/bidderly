create table sources (
  id text primary key,
  name text not null,
  type text not null,
  url text not null,
  geography text not null,
  cadence text not null,
  status text not null default 'healthy',
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table scout_runs (
  id text primary key,
  mode text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  sources_scanned integer not null default 0,
  findings_discovered integer not null default 0
);

create table findings (
  id text primary key,
  scout_run_id text references scout_runs(id),
  source_id text references sources(id),
  title text not null,
  url text not null,
  raw_text text not null,
  detected_language text not null,
  published_at timestamptz,
  stage text not null,
  content_hash text unique,
  created_at timestamptz not null default now()
);

create table extractions (
  id text primary key,
  finding_id text not null references findings(id) on delete cascade,
  model text not null,
  confidence numeric(4, 3) not null,
  entities jsonb not null,
  clue_tags text[] not null default '{}',
  spans jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table model_scores (
  id text primary key,
  finding_id text not null references findings(id) on delete cascade,
  model text not null,
  worth_outreach_score integer not null check (worth_outreach_score between 0 and 100),
  urgency text not null,
  route text not null,
  rationale text not null,
  created_at timestamptz not null default now()
);

create table gemini_analyses (
  id text primary key,
  finding_id text not null references findings(id) on delete cascade,
  model text not null,
  summary text not null,
  risks jsonb not null default '[]',
  recommended_next_steps jsonb not null default '[]',
  blocker text,
  created_at timestamptz not null default now()
);

create table opportunities (
  id text primary key,
  finding_id text not null references findings(id) on delete cascade,
  title text not null,
  buyer text not null,
  owner text not null,
  value_band text,
  deadline date,
  next_action text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table approval_requests (
  id text primary key,
  finding_id text not null references findings(id) on delete cascade,
  opportunity_id text references opportunities(id) on delete cascade,
  title text not null,
  requester text not null,
  blocker text not null,
  requested_action text not null,
  due_at timestamptz,
  status text not null default 'pending',
  alert_eligible boolean not null default false,
  created_at timestamptz not null default now()
);

create table agent_events (
  id text primary key,
  scout_run_id text references scout_runs(id),
  finding_id text references findings(id) on delete set null,
  role text not null,
  type text not null,
  title text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index findings_source_idx on findings(source_id);
create index findings_stage_idx on findings(stage);
create index model_scores_route_idx on model_scores(route, urgency);
create index approval_requests_status_idx on approval_requests(status, alert_eligible);
create index agent_events_created_at_idx on agent_events(created_at desc);

create table if not exists radar_snapshots (
  id text primary key,
  source text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
