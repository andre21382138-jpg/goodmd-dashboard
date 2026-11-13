-- 고객택배 반려 → 발송대기 복구 알림 (2026-11)
-- 목적: SCM/본사가 반려된 고객택배를 '발송대기'로 복구하면, 해당 매장에 다시 알림이 가도록.
-- 방식: 복구 시 sales.delivery_restored_at에 시각을 기록. 매장 알림센터가
--       delivery_type='hq' AND delivery_status='pending' AND delivery_restored_at IS NOT NULL
--       건을 세어 "고객택배 재발송" 알림을 띄움. 발송완료(dispatched) 되면 자동으로 사라짐.
alter table public.sales add column if not exists delivery_restored_at timestamptz;
