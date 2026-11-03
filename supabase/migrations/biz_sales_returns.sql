-- 특판 매출 반품 (2026-11) — 반품을 biz_sales에 음수수량 행으로 기록
-- 반품 행은 quantity<0, is_return=true, return_of=원매출 id.
-- 이렇게 하면 특판 매출 합계(조회/대시보드/허브/엑셀)에서 자동 차감되고,
-- 특판 발주요청 '반품내역' 탭은 is_return=true 행만 조회한다.
alter table public.biz_sales add column if not exists is_return boolean not null default false;
alter table public.biz_sales add column if not exists return_of  bigint;   -- 원매출 biz_sales.id (참고용)

create index if not exists idx_biz_sales_is_return on public.biz_sales (is_return, sold_at desc);
-- RLS는 기존 biz_sales 정책(authenticated)으로 반품 행도 동일하게 조회/등록/삭제됨.
