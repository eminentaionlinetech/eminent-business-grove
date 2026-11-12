drop policy if exists "Sellers upload own product photos" on storage.objects;
drop policy if exists "Sellers update own product photos" on storage.objects;
drop policy if exists "Sellers delete own product photos" on storage.objects;

-- Phone photos are shrunk to small JPEG data and kept here, loaded only when a product card is shown.
create table public.product_photos (
  product_id uuid primary key references public.products(id) on delete cascade,
  data text not null check (char_length(data) <= 400000 and data like 'data:image/%'),
  updated_at timestamptz not null default now()
);
grant select on public.product_photos to anon;
grant select, insert, update, delete on public.product_photos to authenticated;
grant all on public.product_photos to service_role;
alter table public.product_photos enable row level security;
create policy "Photos follow product visibility" on public.product_photos for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy "Sellers add photos to own products" on public.product_photos for insert to authenticated
  with check (exists (select 1 from public.products p where p.id = product_id and (p.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "Sellers change photos of own products" on public.product_photos for update to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))))
  with check (exists (select 1 from public.products p where p.id = product_id and (p.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "Sellers remove photos of own products" on public.product_photos for delete to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
