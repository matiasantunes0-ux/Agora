-- News & Opportunity Alerts schema.
-- App users sign in anonymously (one account per device), so auth.uid() identifies the device.
-- The scan function uses the service-role key and bypasses RLS; the app only sees what the
-- policies below allow.

-- ── Watchlist (max 5 per user) ──────────────────────────────────────────────
create table public.watchlist_items (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  ticker     text not null check (ticker ~ '^[A-Z0-9]{1,6}([.-][A-Z0-9]{1,3})?(\.(TO|V|CN|NE))?$'),
  created_at timestamptz not null default now(),
  primary key (user_id, ticker)
);
create index watchlist_items_ticker_idx on public.watchlist_items (ticker);

create function public.enforce_watchlist_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.watchlist_items where user_id = new.user_id) >= 5 then
    raise exception 'Watchlist is limited to 5 tickers' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger watchlist_limit before insert on public.watchlist_items
  for each row execute function public.enforce_watchlist_limit();

-- ── Push tokens (Expo) ──────────────────────────────────────────────────────
create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  platform   text,
  updated_at timestamptz not null default now()
);

-- ── Pipeline tables (server-only) ───────────────────────────────────────────
create table public.event_clusters (
  id         text primary key,
  ticker     text not null,
  title      text not null,
  first_seen timestamptz not null,
  last_seen  timestamptz not null,
  urls       text[] not null default '{}',
  accessions text[] not null default '{}',
  event_ids  text[] not null default '{}',
  status     text not null default 'pending' check (status in ('pending', 'alerted', 'dismissed'))
);
create index event_clusters_recent_idx on public.event_clusters (ticker, last_seen desc);

create table public.events (
  id           text primary key,
  ticker       text not null,
  source       text not null,
  type         text not null,
  title        text not null,
  summary      text not null default '',
  url          text not null,
  publisher    text not null,
  published_at timestamptz not null,
  accession    text,
  facts        jsonb not null default '{}',
  cluster_id   text references public.event_clusters (id),
  created_at   timestamptz not null default now()
);
create index events_ticker_idx on public.events (ticker, published_at desc);

create table public.source_health (
  source               text primary key,
  consecutive_failures int not null default 0,
  open_until           timestamptz,
  last_success         timestamptz,
  last_error           text,
  updated_at           timestamptz not null default now()
);

-- ── Alerts (what the app shows) ─────────────────────────────────────────────
create table public.alerts (
  id             text primary key,
  -- unique: one story → at most one alert, even if two scans race.
  cluster_id     text not null unique references public.event_clusters (id),
  ticker         text not null,
  kind           text not null check (kind in ('opportunity', 'threat')),
  headline       text not null,
  why_it_matters text not null,
  classifier     text not null,
  created_at     timestamptz not null default now()
);
create index alerts_feed_idx on public.alerts (ticker, created_at desc);

create table public.alert_sources (
  id           bigint generated always as identity primary key,
  alert_id     text not null references public.alerts (id) on delete cascade,
  title        text not null,
  url          text not null,
  publisher    text not null,
  published_at timestamptz not null
);
create index alert_sources_alert_idx on public.alert_sources (alert_id);

-- Inserts an alert and its sources in one transaction. Refuses alerts without a
-- source. Returns false (instead of erroring) if the story already has an alert.
create function public.insert_alert(alert jsonb, sources jsonb) returns boolean
language plpgsql as $$
begin
  if jsonb_array_length(coalesce(sources, '[]'::jsonb)) = 0 then
    raise exception 'alert % has no source', alert->>'id';
  end if;

  insert into public.alerts (id, cluster_id, ticker, kind, headline, why_it_matters, classifier, created_at)
  values (alert->>'id', alert->>'cluster_id', alert->>'ticker', alert->>'kind', alert->>'headline',
          alert->>'why_it_matters', alert->>'classifier', (alert->>'created_at')::timestamptz);

  insert into public.alert_sources (alert_id, title, url, publisher, published_at)
  select alert->>'id', s->>'title', s->>'url', s->>'publisher', (s->>'published_at')::timestamptz
  from jsonb_array_elements(sources) s;

  return true;
exception when unique_violation then
  return false;
end $$;

-- Only the scan function (service role) may create alerts.
revoke execute on function public.insert_alert(jsonb, jsonb) from public, anon, authenticated;

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.watchlist_items enable row level security;
alter table public.push_tokens     enable row level security;
alter table public.event_clusters  enable row level security;
alter table public.events          enable row level security;
alter table public.source_health   enable row level security;
alter table public.alerts          enable row level security;
alter table public.alert_sources   enable row level security;

create policy "own watchlist: read"   on public.watchlist_items for select using (user_id = auth.uid());
create policy "own watchlist: add"    on public.watchlist_items for insert with check (user_id = auth.uid());
create policy "own watchlist: remove" on public.watchlist_items for delete using (user_id = auth.uid());

create policy "own push tokens: read"   on public.push_tokens for select using (user_id = auth.uid());
create policy "own push tokens: add"    on public.push_tokens for insert with check (user_id = auth.uid());
create policy "own push tokens: update" on public.push_tokens for update using (user_id = auth.uid());

-- Users see alerts only for tickers on their own watchlist.
create policy "alerts for my tickers" on public.alerts for select using (
  exists (select 1 from public.watchlist_items w where w.user_id = auth.uid() and w.ticker = alerts.ticker)
);
create policy "sources of visible alerts" on public.alert_sources for select using (
  exists (select 1 from public.alerts a where a.id = alert_sources.alert_id)
);

-- Lets the app show "News source delayed" when a provider is down.
create policy "source status is public" on public.source_health for select to authenticated using (true);

-- events / event_clusters: no policies → only the service role can touch them.

-- Live updates in the app when a new alert is inserted.
alter publication supabase_realtime add table public.alerts;
