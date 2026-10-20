-- 고객 클레임 접수 (2026-10) — 매장 근무자가 고객 클레임을 일별로 입력
create table if not exists public.store_claims (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),  -- 접수일시
  store_name    text not null,
  branch_name   text not null,
  worker_name   text,                                 -- 근무자
  customer_name text,                                 -- 고객명
  customer_phone text,                                -- 고객연락처
  customer_id   bigint,                               -- (선택) 매칭된 회원 id
  product_name  text,                                 -- 구매상품명
  product_code  text,                                 -- 바코드/상품코드
  claim_type    text,                                 -- 클레임유형
  claim_detail  text,                                 -- 상세내용
  status        text not null default '접수',          -- 처리상태(접수/처리중/완료)
  action_detail text,                                 -- 조치내용
  created_by    uuid,
  updated_at    timestamptz
);
create index if not exists idx_store_claims_store on public.store_claims (store_name, branch_name, created_at desc);

alter table public.store_claims enable row level security;
-- 내부 직원(로그인) 전용 — 조회/등록/수정/삭제 허용
drop policy if exists store_claims_staff_all on public.store_claims;
create policy store_claims_staff_all on public.store_claims
  for all to authenticated using (true) with check (true);
