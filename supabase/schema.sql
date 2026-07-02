-- Ejecutar una vez en Supabase > SQL Editor.
-- Modelo, seguridad RLS y automatizaciones para Justifica Admin.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'user');
create type public.profile_status as enum ('active', 'inactive');
create type public.justification_status as enum ('pending', 'approved', 'rejected');
create sequence if not exists public.justification_number_seq start 1001;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  department text,
  role public.app_role not null default 'user',
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null check (status in ('present', 'absent', 'late', 'leave')),
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, attendance_date)
);

create table public.justifications (
  id text primary key default ('JUS-' || lpad(nextval('public.justification_number_seq'::regclass)::text, 6, '0')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  reason text not null,
  description text,
  document_url text,
  status public.justification_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_settings (
  id bigint primary key default 1 check (id = 1),
  recipients text[] not null default '{}',
  enabled boolean not null default true,
  send_time time not null default '18:00',
  timezone text not null default 'America/Lima',
  weekdays_only boolean not null default true,
  report_sections jsonb not null default '{"summary":true,"justifications":true,"pending":true,"attendance":true,"recurrent":false}',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.report_deliveries (
  id bigint generated always as identity primary key,
  report_date date not null,
  recipients text[] not null,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  sent_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    'user'::public.app_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger justifications_updated_at before update on public.justifications
for each row execute function public.touch_updated_at();

create or replace function public.log_justification_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'status_changed', 'justification', new.id,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger justification_review_audit after update on public.justifications
for each row execute function public.log_justification_review();

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.justifications enable row level security;
alter table public.notification_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.report_deliveries enable row level security;

create policy "Admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "Users read own profile" on public.profiles for select using (id = auth.uid());
create policy "Admins manage attendance" on public.attendance for all using (public.is_admin()) with check (public.is_admin());
create policy "Users read own attendance" on public.attendance for select using (user_id = auth.uid());
create policy "Admins manage justifications" on public.justifications for all using (public.is_admin()) with check (public.is_admin());
create policy "Users read own justifications" on public.justifications for select using (user_id = auth.uid());
create policy "Users create own justifications" on public.justifications for insert with check (user_id = auth.uid());
create policy "Admins manage notification settings" on public.notification_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins read audit logs" on public.audit_logs for select using (public.is_admin());
create policy "Admins read report deliveries" on public.report_deliveries for select using (public.is_admin());

create index profiles_department_idx on public.profiles(department);
create index attendance_user_date_idx on public.attendance(user_id, attendance_date desc);
create index justifications_status_date_idx on public.justifications(status, date desc);
create index justifications_user_idx on public.justifications(user_id, created_at desc);

-- IMPORTANTE: crea el primer usuario en Authentication > Users y luego promuévelo:
-- update public.profiles set role = 'admin' where email = 'tu-correo@empresa.pe';
