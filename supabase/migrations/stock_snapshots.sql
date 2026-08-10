-- 월말 재고 스냅샷 (매월 마지막 판매입력 기준 상품별 재고 저장)
create table if not exists public.stock_snapshots (
  id             bigint generated always as identity primary key,
  snapshot_month text not null,        -- 'YYYY-MM'
  product_id     bigint not null,
  quantity       int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (snapshot_month, product_id)
);
alter table public.stock_snapshots enable row level security;
drop policy if exists stock_snapshots_rw on public.stock_snapshots;
create policy stock_snapshots_rw on public.stock_snapshots
  for all to authenticated using (true) with check (true);
