-- ════════════════════════════════════════════════════════════════
-- 신규 매장 계정: 그린푸드 / 현대 미아점   (2026-11-05)
-- ════════════════════════════════════════════════════════════════
-- [배경]
--  · 매장명 '그린푸드 / 현대 미아점' 은 이미 constants.js STORE_MAP 에 존재(코드 수정 불필요).
--  · '매장 전환(보기)' 목록은 Sidebar.jsx 가 profiles 테이블에서
--      job_title='매니저' AND approved=true AND department IS NOT NULL
--    조건으로 자동 조회한다. → 아래 profiles 행만 만들면 전환 목록에 자동 노출됨.
--  · 로그인 아이디 '<ID>' → 이메일 '<ID>@kbh.kr' + 비번 (supabase.auth.signInWithPassword).
--
-- [실행 전 선행 작업 — Supabase 대시보드]
--  1) Authentication > Users > "Add user" 클릭
--  2) Email        : KBH####@kbh.kr   (★ 기존 KBH 번호 체계의 다음 번호)
--     Password      : (지정한 비밀번호)
--     ☑ Auto Confirm User  (반드시 체크 — 메일 인증 없이 바로 로그인 가능)
--  3) 생성 완료 후, 아래 v_email 을 방금 만든 이메일로 바꿔 이 SQL 을 실행.
--
-- 이 SQL 은 auth 사용자(아이디/비번) 를 "만들지" 않는다. 위 1~2 에서 만든 계정에
-- 매장 정보(점포/지점/직급/승인)만 연결한다. 트리거가 profiles 를 자동 생성했든
-- 아니든 ON CONFLICT 로 안전하게 처리한다.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  v_email  text := 'KBH0000@kbh.kr';   -- ★ 대시보드에서 생성한 이메일로 교체
  v_name   text := '현대 미아점';        -- 전환 목록/화면 표시용 이름 (매니저 실명으로 바꿔도 됨)
  v_uid    uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(v_email);

  if v_uid is null then
    raise exception
      '[중단] auth 사용자가 없습니다. 먼저 대시보드 Authentication > Add user 로 % 계정을 만드세요 (Auto Confirm 체크).',
      v_email;
  end if;

  insert into public.profiles (id, email, department, branch, name, job_title, role, approved)
  values (v_uid, v_email, '그린푸드', '현대 미아점', v_name, '매니저', 'user', true)
  on conflict (id) do update
    set email      = excluded.email,
        department = '그린푸드',
        branch     = '현대 미아점',
        name       = coalesce(nullif(public.profiles.name, ''), excluded.name),
        job_title  = '매니저',
        role       = coalesce(nullif(public.profiles.role, ''), 'user'),
        approved   = true;

  raise notice '완료: % (그린푸드 / 현대 미아점) 매장 계정 활성화. 전환 목록에 노출됩니다.', v_email;
end $$;

-- 확인용 조회
select id, email, department, branch, name, job_title, role, approved
from public.profiles
where department = '그린푸드' and branch = '현대 미아점';
