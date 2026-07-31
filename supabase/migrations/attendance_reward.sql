-- 팔레오 출석체크 적립금 이벤트: 회원 매장방문 QR → 1일 1회 100원 적립
create table if not exists public.attendance_rewards (
  id          bigint generated always as identity primary key,
  customer_id bigint not null,
  store_name  text,
  branch_name text,
  reward_date date not null,
  points      int  not null default 100,
  created_at  timestamptz not null default now(),
  unique (customer_id, reward_date)   -- 1일 1회 보장
);
alter table public.attendance_rewards enable row level security;
drop policy if exists attendance_rewards_read on public.attendance_rewards;
create policy attendance_rewards_read on public.attendance_rewards
  for select to authenticated using (true);   -- 조회는 본사(인증)만, 삽입은 RPC(정의자권한)로만

-- 공개(anon) 출석체크 처리 RPC — 이름+휴대폰으로 회원확인 후 1일 1회 100원 적립
create or replace function public.attend_reward(p_store uuid, p_name text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cust  customers%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_store text; v_branch text;
  v_pts   int;
begin
  select * into v_cust from customers
   where btrim(name) = btrim(p_name)
     and regexp_replace(coalesce(phone,''),  '[^0-9]', '', 'g')
       = regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
   order by id limit 1;
  if not found then
    return json_build_object('status','not_found');
  end if;

  select department, branch into v_store, v_branch from profiles where id = p_store;

  begin
    insert into attendance_rewards(customer_id, store_name, branch_name, reward_date, points)
    values (v_cust.id, v_store, v_branch, v_today, 100);
  exception when unique_violation then
    return json_build_object('status','already');
  end;

  update customers set total_points = coalesce(total_points,0) + 100 where id = v_cust.id;
  select total_points into v_pts from customers where id = v_cust.id;
  return json_build_object('status','ok','points',v_pts,'name',v_cust.name);
end;
$$;
grant execute on function public.attend_reward(uuid, text, text) to anon, authenticated;
