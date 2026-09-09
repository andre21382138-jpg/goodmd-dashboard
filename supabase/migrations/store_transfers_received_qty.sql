-- 점간이동 입고 시 '실제 스캔(입고) 수량' 기록 (2026-09)
-- 목적: 매장 재고이동을 바코드 스캔으로 입고할 때, 보낸 수량과 실제 도착 수량이
--       다를 수 있으므로 실제 입고된 수량을 별도로 저장한다.
--       재고 가산은 received_qty 기준. quantity(보낸 수량)와 비교해 부족분 파악 가능.
alter table public.store_transfers add column if not exists received_qty numeric;

-- 과거 입고완료 건은 보낸 수량 그대로 입고된 것으로 백필
update public.store_transfers
   set received_qty = quantity
 where status = 'received' and received_qty is null;
