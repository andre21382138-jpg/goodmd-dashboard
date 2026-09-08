-- 판매건별 원가 스냅샷 (2026-09)
-- 목적: 상품 원가 수정 시 '8월1일 판매건부터' 적용. 과거(8/1 이전) 판매는 기존 원가 유지.
-- 방식: sales.unit_cost에 판매 시점 원가를 저장. 리포트는 이 값을 사용(없으면 products.cost로 폴백).
--       기존 판매건은 현재 상품원가로 백필(baseline) → 지금까지의 리포트 수치는 변동 없음.
alter table public.sales add column if not exists unit_cost numeric;

-- 기존 판매건 백필: 현재 상품원가를 스냅샷 (아직 unit_cost 없는 행만)
update public.sales s
   set unit_cost = p.cost
  from public.products p
 where s.product_id = p.id
   and s.unit_cost is null;

-- 조회 성능(상품 원가 수정 시 8/1 이후 판매건 전파)용 인덱스
create index if not exists idx_sales_product_sold_at on public.sales (product_id, sold_at);
