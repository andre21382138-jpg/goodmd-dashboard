-- 신규 회원가입 중복 차단용: 이름+휴대폰(숫자만 비교)으로 기존 회원 존재 여부 확인
-- 공개(anon) QR 가입 페이지는 customers SELECT 권한이 없으므로 SECURITY DEFINER로 우회
create or replace function public.member_exists(p_name text, p_phone text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from customers
    where btrim(name) = btrim(p_name)
      and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
        = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
  );
$$;

grant execute on function public.member_exists(text, text) to anon, authenticated;
