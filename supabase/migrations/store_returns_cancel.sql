-- 매장 반품신청 취소완료 상태용 컬럼 (status='cancelled' 로 소프트 취소)
alter table public.store_returns add column if not exists cancelled_at timestamptz;
alter table public.store_returns add column if not exists cancelled_by uuid;
