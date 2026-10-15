create table public.shops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{1,19}$'),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.shop_memberships (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  role text not null default 'staff' check (role in ('owner', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, username)
);

create table public.store_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  name_kn text,
  price numeric(12, 2) not null check (price >= 0),
  quantity numeric(12, 3) not null default 0 check (quantity >= 0),
  unit text not null default 'pcs',
  category text,
  created_at bigint not null,
  updated_at bigint not null,
  check (length(trim(name)) > 0)
);
create unique index products_shop_name_ci on public.products (shop_id, lower(name));
create index products_shop_id_idx on public.products (shop_id);

create table public.invoices (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  invoice_number text not null,
  date_ms bigint not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  gst_rate numeric(5, 2) not null default 0,
  gst_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null check (total >= 0),
  customer_name text,
  customer_phone text,
  payment_method text not null check (payment_method in ('cash', 'card', 'upi', 'other')),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (shop_id, invoice_number)
);
create index invoices_shop_date_idx on public.invoices (shop_id, date_ms desc);

create table public.custom_units (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at bigint not null
);
create unique index custom_units_shop_name_ci on public.custom_units (shop_id, lower(name));

create table public.activity_log (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource text not null,
  resource_id text,
  created_at timestamptz not null default now()
);
create index activity_log_shop_created_idx on public.activity_log (shop_id, created_at desc);

alter table public.shops enable row level security;
alter table public.app_admins enable row level security;
alter table public.shop_memberships enable row level security;
alter table public.store_settings enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;
alter table public.custom_units enable row level security;
alter table public.activity_log enable row level security;

create policy "admins and shop members read shops"
  on public.shops for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or (active and exists (
      select 1 from public.shop_memberships m
      where m.shop_id = shops.id and m.user_id = (select auth.uid()) and m.active
    ))
  );

create policy "admins read their admin record"
  on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users and admins read memberships"
  on public.shop_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
  );

create policy "admins and members read store settings"
  on public.store_settings for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = store_settings.shop_id and m.user_id = (select auth.uid())
        and m.active and s.active
    )
  );
create policy "active shop members create store settings"
  on public.store_settings for insert to authenticated
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = store_settings.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));
create policy "active shop members update store settings"
  on public.store_settings for update to authenticated
  using (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = store_settings.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ))
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = store_settings.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));

create policy "admins and members read products"
  on public.products for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = products.shop_id and m.user_id = (select auth.uid())
        and m.active and s.active
    )
  );
create policy "active shop members create products"
  on public.products for insert to authenticated
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = products.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));
create policy "active shop members update products"
  on public.products for update to authenticated
  using (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = products.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ))
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = products.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));
create policy "active shop members delete products"
  on public.products for delete to authenticated
  using (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = products.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));

create policy "admins and members read invoices"
  on public.invoices for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = invoices.shop_id and m.user_id = (select auth.uid())
        and m.active and s.active
    )
  );
create policy "active shop members create invoices"
  on public.invoices for insert to authenticated
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = invoices.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));
create policy "active shop members update invoices"
  on public.invoices for update to authenticated
  using (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = invoices.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ))
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = invoices.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));

create policy "admins and members read custom units"
  on public.custom_units for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = custom_units.shop_id and m.user_id = (select auth.uid())
        and m.active and s.active
    )
  );
create policy "active shop members create custom units"
  on public.custom_units for insert to authenticated
  with check (exists (
    select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
    where m.shop_id = custom_units.shop_id and m.user_id = (select auth.uid())
      and m.active and s.active
  ));

create policy "admins and members read activity"
  on public.activity_log for select to authenticated
  using (
    exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = activity_log.shop_id and m.user_id = (select auth.uid())
        and m.active and s.active
    )
  );
create policy "active shop members write own activity"
  on public.activity_log for insert to authenticated
  with check (
    actor_id = (select auth.uid()) and exists (
      select 1 from public.shop_memberships m join public.shops s on s.id = m.shop_id
      where m.shop_id = activity_log.shop_id and m.user_id = (select auth.uid())
        and m.active and s.active
    )
  );

create or replace function public.log_shop_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row_data jsonb;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  insert into public.activity_log (shop_id, actor_id, action, resource, resource_id)
  values (
    (row_data ->> 'shop_id')::uuid,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    row_data ->> 'id'
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger products_activity_log
  after insert or update or delete on public.products
  for each row execute function public.log_shop_activity();
create trigger invoices_activity_log
  after insert or update or delete on public.invoices
  for each row execute function public.log_shop_activity();
create trigger store_settings_activity_log
  after insert or update or delete on public.store_settings
  for each row execute function public.log_shop_activity();
create trigger custom_units_activity_log
  after insert or update or delete on public.custom_units
  for each row execute function public.log_shop_activity();

grant usage on schema public to authenticated;
grant select on public.shops, public.app_admins, public.shop_memberships,
  public.store_settings, public.products, public.invoices, public.custom_units,
  public.activity_log to authenticated;
grant insert, update on public.store_settings to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update on public.invoices to authenticated;
grant insert on public.custom_units, public.activity_log to authenticated;
grant usage, select on sequence public.shop_memberships_id_seq,
  public.products_id_seq, public.invoices_id_seq, public.custom_units_id_seq,
  public.activity_log_id_seq to authenticated;
