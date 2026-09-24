
create table public.wardrobe_garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (char_length(category) between 1 and 60),
  color text not null check (char_length(color) between 1 and 60),
  season text[] not null default '{}',
  occasions text[] not null default '{}',
  material text,
  description text,
  image_path text,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wardrobe_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  occasion text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.wardrobe_outfit_items (
  outfit_id uuid not null references public.wardrobe_outfits(id) on delete cascade,
  garment_id uuid not null references public.wardrobe_garments(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  primary key (outfit_id, garment_id)
);

create table public.wardrobe_planner_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  outfit_id uuid not null references public.wardrobe_outfits(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create index wardrobe_garments_user_created_idx on public.wardrobe_garments (user_id, created_at desc);
create index wardrobe_outfits_user_created_idx on public.wardrobe_outfits (user_id, created_at desc);
create index wardrobe_outfit_items_garment_idx on public.wardrobe_outfit_items (garment_id);
create index wardrobe_planner_user_date_idx on public.wardrobe_planner_entries (user_id, plan_date);

alter table public.wardrobe_garments enable row level security;
alter table public.wardrobe_outfits enable row level security;
alter table public.wardrobe_outfit_items enable row level security;
alter table public.wardrobe_planner_entries enable row level security;

create policy wardrobe_garments_select on public.wardrobe_garments for select to authenticated using ((select auth.uid()) = user_id);
create policy wardrobe_garments_insert on public.wardrobe_garments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy wardrobe_garments_update on public.wardrobe_garments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy wardrobe_garments_delete on public.wardrobe_garments for delete to authenticated using ((select auth.uid()) = user_id);

create policy wardrobe_outfits_select on public.wardrobe_outfits for select to authenticated using ((select auth.uid()) = user_id);
create policy wardrobe_outfits_insert on public.wardrobe_outfits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy wardrobe_outfits_update on public.wardrobe_outfits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy wardrobe_outfits_delete on public.wardrobe_outfits for delete to authenticated using ((select auth.uid()) = user_id);

create policy wardrobe_outfit_items_select on public.wardrobe_outfit_items for select to authenticated using (
  exists (select 1 from public.wardrobe_outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
);
create policy wardrobe_outfit_items_insert on public.wardrobe_outfit_items for insert to authenticated with check (
  exists (select 1 from public.wardrobe_outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
  and exists (select 1 from public.wardrobe_garments g where g.id = garment_id and g.user_id = (select auth.uid()))
);
create policy wardrobe_outfit_items_update on public.wardrobe_outfit_items for update to authenticated using (
  exists (select 1 from public.wardrobe_outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.wardrobe_outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
  and exists (select 1 from public.wardrobe_garments g where g.id = garment_id and g.user_id = (select auth.uid()))
);
create policy wardrobe_outfit_items_delete on public.wardrobe_outfit_items for delete to authenticated using (
  exists (select 1 from public.wardrobe_outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
);

create policy wardrobe_planner_select on public.wardrobe_planner_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy wardrobe_planner_insert on public.wardrobe_planner_entries for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.wardrobe_outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
);
create policy wardrobe_planner_update on public.wardrobe_planner_entries for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.wardrobe_outfits o where o.id = outfit_id and o.user_id = (select auth.uid()))
);
create policy wardrobe_planner_delete on public.wardrobe_planner_entries for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.wardrobe_garments to authenticated;
grant select, insert, update, delete on public.wardrobe_outfits to authenticated;
grant select, insert, update, delete on public.wardrobe_outfit_items to authenticated;
grant select, insert, update, delete on public.wardrobe_planner_entries to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe-images', 'wardrobe-images', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy wardrobe_images_select on storage.objects for select to authenticated using (
  bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy wardrobe_images_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy wardrobe_images_update on storage.objects for update to authenticated using (
  bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy wardrobe_images_delete on storage.objects for delete to authenticated using (
  bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);
;
