-- 중복가입 차단 기준을 '이름+휴대폰' → '휴대폰번호(숫자만)'로 변경 (2026-09)
-- 사유: 같은 사람이 같은 번호로 이름만 다르게(띄어쓰기·오타·(직원) 등) 입력하면
--       기존 이름+휴대폰 매칭을 우회해 중복가입되던 문제. 휴대폰이 확실한 식별자.
-- 앱 호출부는 member_exists(p_name, p_phone) 그대로 사용 — p_name은 무시(호환 유지).
create or replace function public.member_exists(p_name text, p_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from customers
    where length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 10
      and regexp_replace(coalesce(phone, ''),   '[^0-9]', '', 'g')
        = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
  );
$$;

grant execute on function public.member_exists(text, text) to anon, authenticated;
