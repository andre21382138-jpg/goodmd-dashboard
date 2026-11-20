-- 창원지점 계정에 role='changwon' 지정 (가입 후 1회 실행)
-- 사용법:
--   1) 앱 회원가입/Supabase에서 창원지점용 로그인 계정을 먼저 만든다.
--      (로그인 이메일 규칙: 아이디@kbh.kr  예) 아이디가 cw001 이면 cw001@kbh.kr)
--   2) 아래 '여기에_이메일' 부분을 그 계정 이메일로 바꾼 뒤 실행한다.
--   3) 실행 후 해당 계정으로 로그인하면 '창원지점' 메뉴(제품현황/입고입력/출고입력/재고현황)만 보인다.

update public.profiles
set role       = 'changwon',
    approved   = true,
    job_title  = null,          -- 매니저/담당자 아님
    department = '창원지점',
    branch     = '창원지점',
    name       = coalesce(name, '박경원')
where email = 'kbh0025@kbh.kr';

-- 확인용
-- select id, email, name, role, approved, department, branch from public.profiles where email = 'kbh0025@kbh.kr';
