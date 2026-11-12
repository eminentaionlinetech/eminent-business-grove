-- Roles
create type public.app_role as enum ('admin', 'user');

-- Public seller profiles (no email, no password)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business text not null default '' check (char_length(business) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  shop_open boolean not null default true,
  shop_bio text not null default '' check (char_length(shop_bio) <= 300),
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Seller profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_owner_email(_email text)
returns boolean language sql immutable set search_path = public as $$
  select lower(coalesce(_email, '')) in ('eminentbusinesshubhotmail@gmail.com', 'admin@eminentbusinesshub.com')
$$;

-- New account: profile + role. Admin only for the owner emails once the email is confirmed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, business, phone)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'business', ''), 120), left(coalesce(new.raw_user_meta_data->>'phone', ''), 40))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  if new.email_confirmed_at is not null and public.is_owner_email(new.email) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and public.is_owner_email(new.email) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  elsif not public.is_owner_email(new.email) then
    delete from public.user_roles where user_id = new.id and role = 'admin';
  end if;
  return new;
end $$;
create trigger on_auth_user_updated after update of email, email_confirmed_at on auth.users for each row execute function public.handle_user_updated();

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  price numeric(14,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text not null default '' check (char_length(image_url) <= 2048),
  category text not null default 'Other' check (char_length(category) <= 60),
  description text not null default '' check (char_length(description) <= 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index products_owner_idx on public.products(owner_id);
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Anyone sees shop products" on public.products for select to anon, authenticated using (hidden = false);
create policy "Sellers see own products" on public.products for select to authenticated using (auth.uid() = owner_id);
create policy "Admins see all products" on public.products for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Sellers add own products" on public.products for insert to authenticated with check (auth.uid() = owner_id);
create policy "Sellers or admins update products" on public.products for update to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));
create policy "Sellers or admins delete products" on public.products for delete to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));

-- Orders (one product each)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null default '' check (char_length(customer_phone) <= 40),
  product_id uuid not null,
  product_name text not null default 'Product' check (char_length(product_name) <= 120),
  quantity integer not null check (quantity >= 1),
  total numeric(14,2) not null check (total >= 0),
  status text not null default 'Pending' check (status in ('Pending', 'Completed', 'Cancelled')),
  note text check (char_length(note) <= 500),
  source text not null default 'manual' check (source in ('shop', 'manual')),
  payment_status text check (payment_status in ('paid', 'unpaid')),
  payment_ref text check (char_length(payment_ref) <= 100),
  created_at timestamptz not null default now()
);
create index orders_owner_idx on public.orders(owner_id);
create index orders_payment_ref_idx on public.orders(payment_ref);
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Sellers or admins see orders" on public.orders for select to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));
create policy "Sellers record own manual orders" on public.orders for insert to authenticated
  with check (auth.uid() = owner_id and source = 'manual' and payment_status is null and payment_ref is null);
create policy "Sellers or admins update orders" on public.orders for update to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));
create policy "Sellers or admins delete orders" on public.orders for delete to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));

-- Only the server (after Paystack confirms) may change payment fields
create or replace function public.protect_order_payment()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    new.payment_status := old.payment_status;
    new.payment_ref := old.payment_ref;
    new.owner_id := old.owner_id;
    new.source := old.source;
  end if;
  return new;
end $$;
create trigger orders_protect_payment before update on public.orders for each row execute function public.protect_order_payment();

-- Customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 200),
  created_at timestamptz not null default now()
);
create index customers_owner_idx on public.customers(owner_id);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "Sellers or admins see customers" on public.customers for select to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));
create policy "Sellers add own customers" on public.customers for insert to authenticated with check (auth.uid() = owner_id);
create policy "Sellers or admins update customers" on public.customers for update to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));
create policy "Sellers or admins delete customers" on public.customers for delete to authenticated
  using (auth.uid() = owner_id or public.has_role(auth.uid(), 'admin'));

-- Email logs (welcome emails); only admins read them
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  to_email text not null check (char_length(to_email) <= 200),
  kind text not null check (kind in ('welcome', 'test')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  detail text not null default '' check (char_length(detail) <= 500),
  created_at timestamptz not null default now()
);
grant insert on public.email_logs to anon;
grant select, insert, delete on public.email_logs to authenticated;
grant all on public.email_logs to service_role;
alter table public.email_logs enable row level security;
create policy "Anyone can log a welcome email" on public.email_logs for insert to anon, authenticated with check (true);
create policy "Admins read email logs" on public.email_logs for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins clear email logs" on public.email_logs for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- EmailJS settings (EmailJS public keys are designed to be public); admins edit
create table public.email_settings (
  id integer primary key default 1 check (id = 1),
  public_key text not null default '' check (char_length(public_key) <= 200),
  service_id text not null default '' check (char_length(service_id) <= 200),
  template_id text not null default '' check (char_length(template_id) <= 200),
  reply_to text not null default '' check (char_length(reply_to) <= 200),
  updated_at timestamptz not null default now()
);
grant select on public.email_settings to anon;
grant select, insert, update on public.email_settings to authenticated;
grant all on public.email_settings to service_role;
alter table public.email_settings enable row level security;
create policy "Anyone reads email settings" on public.email_settings for select to anon, authenticated using (true);
create policy "Admins add email settings" on public.email_settings for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins edit email settings" on public.email_settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Admin list of accounts with emails
create or replace function public.admin_list_users()
returns table (id uuid, email text, created_at timestamptz, confirmed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can list accounts';
  end if;
  return query select u.id, u.email::text, u.created_at, (u.email_confirmed_at is not null) from auth.users u order by u.created_at desc;
end $$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Shop checkout: all-or-nothing, one Pending order per cart line, stock taken atomically
create or replace function public.place_shop_order(_items jsonb, _name text, _phone text, _note text, _pay_ref text)
returns setof public.orders
language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  p record;
  q integer;
  o public.orders;
  clean_name text := trim(coalesce(_name, ''));
  clean_phone text := trim(coalesce(_phone, ''));
  clean_note text := nullif(trim(left(coalesce(_note, ''), 500)), '');
begin
  if char_length(clean_name) < 1 or char_length(clean_name) > 120 then raise exception 'Enter your name'; end if;
  if length(regexp_replace(clean_phone, '\D', '', 'g')) < 10 or char_length(clean_phone) > 40 then
    raise exception 'Enter a valid phone number so the seller can reach you';
  end if;
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) < 1 then raise exception 'Your cart is empty'; end if;
  if jsonb_array_length(_items) > 50 then raise exception 'Too many items in one order'; end if;
  if _pay_ref is not null and _pay_ref !~ '^[A-Za-z0-9_]{6,60}$' then raise exception 'Invalid payment reference'; end if;

  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'quantity')::integer;
    select pr.* into p from public.products pr
      join public.profiles pf on pf.id = pr.owner_id
      where pr.id = (it->>'productId')::uuid and pr.hidden = false and pf.shop_open = true
      for update of pr;
    if not found then raise exception 'An item in your cart is no longer available'; end if;
    if q is null or q < 1 then raise exception 'Quantity must be at least 1'; end if;
    if p.stock <= 0 then raise exception '%: sold out', p.name; end if;
    if q > p.stock then raise exception '%: only % left in stock', p.name, p.stock; end if;

    update public.products set stock = stock - q where id = p.id;
    insert into public.orders (owner_id, customer_name, customer_phone, product_id, product_name, quantity, total, status, note, source, payment_status, payment_ref)
      values (p.owner_id, clean_name, clean_phone, p.id, p.name, q, p.price * q, 'Pending', clean_note, 'shop', 'unpaid', _pay_ref)
      returning * into o;
    insert into public.customers (owner_id, name, phone)
      select p.owner_id, clean_name, clean_phone
      where not exists (select 1 from public.customers c where c.owner_id = p.owner_id and lower(c.name) = lower(clean_name));
    return next o;
  end loop;
  return;
end $$;
revoke all on function public.place_shop_order(jsonb, text, text, text, text) from public;
grant execute on function public.place_shop_order(jsonb, text, text, text, text) to anon, authenticated;

-- Product photos: sellers upload into their own folder
create policy "Sellers upload own product photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Sellers update own product photos" on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Sellers delete own product photos" on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Live updates
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.profiles;
