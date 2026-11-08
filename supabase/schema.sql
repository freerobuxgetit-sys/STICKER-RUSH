-- Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,18}$'),
  role text not null default 'player' check (role in ('player','admin')),
  pity_count integer not null default 0 check (pity_count between 0 and 49),
  created_at timestamptz not null default now()
);

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rarity text not null check (rarity in ('rare','epic','legendary')),
  image_url text not null,
  storage_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sticker_id uuid not null references public.stickers(id),
  created_at timestamptz not null default now()
);

create index if not exists collections_user_idx on public.collections(user_id);
create index if not exists stickers_rarity_active_idx on public.stickers(rarity) where active;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  insert into public.profiles(id, username) values(new.id, uname);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace view public.leaderboard as
select p.username,
       count(c.id)::integer as total,
       count(c.id) filter (where s.rarity='legendary')::integer as legendary
from public.profiles p
left join public.collections c on c.user_id=p.id
left join public.stickers s on s.id=c.sticker_id
group by p.id,p.username;

alter table public.profiles enable row level security;
alter table public.stickers enable row level security;
alter table public.collections enable row level security;

create policy "profiles are readable" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id and role='player');
create policy "active stickers visible" on public.stickers for select to authenticated using (active=true);
create policy "admins manage stickers" on public.stickers for all to authenticated
using (exists(select 1 from public.profiles where id=auth.uid() and role='admin'))
with check (exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
create policy "collections readable by players" on public.collections for select to authenticated using (true);
-- Inserts happen only inside the spin RPC, which runs with definer privileges.

grant select on public.leaderboard to authenticated;

-- Security-definer function: rarity selection and inventory insert happen atomically on the server.
create or replace function public.spin_sticker()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  current_pity integer;
  spin_no integer;
  target_rarity text;
  chosen public.stickers%rowtype;
  new_pity integer;
begin
  if uid is null then raise exception 'Please log in to spin.'; end if;
  select pity_count into current_pity from public.profiles where id=uid for update;
  if current_pity is null then raise exception 'Player profile not found.'; end if;

  spin_no := current_pity + 1;
  if spin_no >= 50 then
    target_rarity := 'legendary';
  elsif spin_no in (10,20,30,40) then
    target_rarity := case
      when random() < 0.10 then 'legendary'
      when random() < (0.30 / 0.90) then 'epic'
      else 'rare' end;
  else
    target_rarity := case
      when random() < 0.01 then 'legendary'
      when random() < (0.33 / 0.99) then 'epic'
      else 'rare' end;
  end if;

  select * into chosen from public.stickers
  where active=true and rarity=target_rarity
  order by random() limit 1;

  if not found then raise exception 'No active % stickers are available. Ask an admin to upload one.', target_rarity; end if;

  insert into public.collections(user_id,sticker_id) values(uid,chosen.id);
  if target_rarity='legendary' then new_pity:=0; else new_pity:=current_pity+1; end if;
  update public.profiles set pity_count=new_pity where id=uid;

  return jsonb_build_object(
    'sticker', jsonb_build_object('id',chosen.id,'name',chosen.name,'rarity',chosen.rarity,'image_url',chosen.image_url),
    'pity_count',new_pity,
    'spin_number',spin_no
  );
end;
$$;

revoke all on function public.spin_sticker() from public;
grant execute on function public.spin_sticker() to authenticated;

-- Storage bucket for sticker images. Public read; admin-only uploads/deletes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('stickers','stickers',true,5242880,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "sticker images public read" on storage.objects for select using (bucket_id='stickers');
create policy "admin upload sticker images" on storage.objects for insert to authenticated
with check (bucket_id='stickers' and exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
create policy "admin delete sticker images" on storage.objects for delete to authenticated
using (bucket_id='stickers' and exists(select 1 from public.profiles where id=auth.uid() and role='admin'));

-- After registering your own account, promote it to admin by running:
-- update public.profiles set role='admin' where username='YOUR_USERNAME';
