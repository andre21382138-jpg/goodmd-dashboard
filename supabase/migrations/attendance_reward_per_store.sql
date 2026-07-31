-- 출석체크 적립을 '회원당 하루 1회 전체' → '매장별 하루 1회'로 변경 (모든 매장에서 참여 가능)
alter table public.attendance_rewards add column if not exists store_id uuid;

-- 기존 (customer_id, reward_date) 유니크 제거 후 매장 포함 유니크로 교체
alter table public.attendance_rewards drop constraint if exists attendance_rewards_customer_id_reward_date_key;
create unique index if not exists uq_attendance_per_store_day
  on public.attendance_rewards (customer_id, store_id, reward_date);

-- RPC: 매장별 1일 1회로 적립 (store_id 기준)
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
    insert into attendance_rewards(customer_id, store_id, store_name, branch_name, reward_date, points)
    values (v_cust.id, p_store, v_store, v_branch, v_today, 100);
  exception when unique_violation then
    return json_build_object('status','already');
  end;

  update customers set total_points = coalesce(total_points,0) + 100 where id = v_cust.id;
  select total_points into v_pts from customers where id = v_cust.id;
  return json_build_object('status','ok','points',v_pts,'name',v_cust.name);
end;
$$;
grant execute on function public.attend_reward(uuid, text, text) to anon, authenticated;
