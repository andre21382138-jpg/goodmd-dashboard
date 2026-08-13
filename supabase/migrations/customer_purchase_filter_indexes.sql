-- 회원조회 '구매일 기준' 필터(customers ⨝ sales) 성능 인덱스 (2026-08)
-- sales 127k행 · customers 74k행 조인+정렬이 인덱스 없이 4~8초 → 타임아웃.
--  · (customer_id, sold_at): 회원별 구매기간 세미조인/필터
--  · customers(joined_at desc): 정렬(최신 가입순) 인덱스 스캔
create index if not exists idx_sales_customer_sold_at
  on public.sales (customer_id, sold_at);
create index if not exists idx_sales_sold_at
  on public.sales (sold_at);
create index if not exists idx_customers_joined_at
  on public.customers (joined_at desc);
