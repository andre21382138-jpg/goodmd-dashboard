-- 클레임 유입 경로 구분 (2026-11)
-- 반품접수(반품/교환/증정)에서 store_claims로 통합 기록하면서, 어디서 들어온 건인지 표시.
-- '반품' 건은 재고/매출을 반품 로직이 이미 처리하므로 stock_movements는 비워 중복 반영을 막는다.
alter table public.store_claims add column if not exists source text;  -- '반품' / '교환·증정'
