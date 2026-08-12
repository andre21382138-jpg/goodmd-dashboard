-- 출석체크 적립 매칭을 '이름+휴대폰' → '휴대폰번호(숫자만)' 기준으로 완화 (2026-08)
-- 사유: 이름에 (직원)/(신규)/(매장) 등 괄호 표기가 붙은 회원이 약 5,960명(전체 8%) 존재해
--       평범한 이름으로 입력 시 이름 불일치로 '가입정보 없음'이 뜨는 문제.
--       휴대폰번호가 확실한 식별자이므로 번호(숫자만)로 회원을 찾는다. 이름은 표시용으로만 반환.
create or replace function public.attend_reward(p_store uuid, p_name text, p_phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cust   customers%rowtype;
  v_today  date := (now() at time zone 'Asia/Seoul')::date;
  v_store  text; v_branch text;
  v_pts    int;
  v_digits text := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
begin
  if length(v_digits) < 9 then
    return json_build_object('status','not_found');
  end if;

  -- 휴대폰번호(숫자만)로 회원 식별 (동일 번호 다건이면 가장 오래된 회원)
  select * into v_cust from customers
   where regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = v_digits
   order by id
   limit 1;
  if not found then
    return json_build_object('status','not_found');
  end if;

  select department, branch into v_store, v_branch from profiles where id = p_store;

  begin
    insert into attendance_rewards(customer_id, store_id, store_name, branch_name, reward_date, points)
    values (v_cust.id, p_store, v_store, v_branch, v_today, 300);
  exception when unique_violation then
    return json_build_object('status','already');
  end;

  update customers set total_points = coalesce(total_points,0) + 300 where id = v_cust.id;
  select total_points into v_pts from customers where id = v_cust.id;
  return json_build_object('status','ok','points',v_pts,'name',v_cust.name);
end;
$$;
grant execute on function public.attend_reward(uuid, text, text) to anon, authenticated;
