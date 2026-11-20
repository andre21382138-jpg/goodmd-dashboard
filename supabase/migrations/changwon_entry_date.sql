-- 창원지점 입고/출고에 '기록일(entry_date)' 추가 (2026-11)
-- 입고입력·출고입력에서 날짜를 직접 선택(기본 오늘). created_at(생성시각)과 별개로 수불장 일자를 보관.
alter table public.cw_inbound  add column if not exists entry_date date not null default current_date;
alter table public.cw_outbound add column if not exists entry_date date not null default current_date;
create index if not exists idx_cw_inbound_date  on public.cw_inbound  (entry_date desc);
create index if not exists idx_cw_outbound_date on public.cw_outbound (entry_date desc);
