-- 매장 지출 입력 (택배비/사무용품/기타)
create table if not exists public.store_expenses (
  id          bigint generated always as identity primary key,
  store_name  text not null,
  branch_name text not null,
  expense_date date not null,
  category    text not null,          -- 택배비 | 사무용품 | 기타
  amount      integer not null,
  memo        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_store_expenses_store_date
  on public.store_expenses (store_name, branch_name, expense_date);

alter table public.store_expenses enable row level security;

drop policy if exists store_expenses_rw on public.store_expenses;
create policy store_expenses_rw on public.store_expenses
  for all to authenticated using (true) with check (true);
