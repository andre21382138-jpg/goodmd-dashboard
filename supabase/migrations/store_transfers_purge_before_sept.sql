-- 매장 재고이동: 9월 이전(출고일 기준) 이력 전체 삭제 (2026-09)
-- 목적: 매장 재고이동 메뉴에 2026-09-01 출고분부터만 노출/적용. 그 이전 이동기록은 정리.
-- 주의: store_transfers 행 삭제는 이미 반영된 store_stock 수량에는 영향을 주지 않음(이력 정리용).
-- 기준: dispatched_at(출고일시) < 2026-09-01 00:00 KST. dispatched_at이 없는 예전 행도 함께 삭제.
delete from public.store_transfers
 where dispatched_at is null
    or dispatched_at < timestamptz '2026-09-01 00:00:00+09';
