-- 고객 클레임 조치내용 구조화 + 재고 반영 (2026-10)
-- 조치내용을 선택식으로 바꾸고, 교환/증정 상품과 적용된 재고이동을 기록한다.
alter table public.store_claims add column if not exists action_type           text;  -- 환불/동일상품교환/.../본사처리필요
alter table public.store_claims add column if not exists exchange_product_name  text;  -- 다른상품 교환 대상
alter table public.store_claims add column if not exists exchange_product_code  text;
alter table public.store_claims add column if not exists gift_product_name      text;  -- 서비스증정 상품
alter table public.store_claims add column if not exists gift_product_code      text;
alter table public.store_claims add column if not exists stock_movements        jsonb; -- 접수저장 시 반영한 재고이동 [{code,name,delta}] — 수정/삭제 시 원복용
