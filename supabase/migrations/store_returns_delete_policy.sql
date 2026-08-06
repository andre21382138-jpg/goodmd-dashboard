-- 본사 담당자/관리자 또는 신청 매장이 반품신청을 취소(삭제)할 수 있도록
alter table public.store_returns enable row level security;
drop policy if exists store_returns_delete on public.store_returns;
create policy store_returns_delete on public.store_returns
  for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or job_title = '담당자'))
  );
