-- 회원 기념일(연도 없이 월/일만) — 'MM-DD' 텍스트, 선택 입력 (2026-08)
alter table public.customers add column if not exists anniversary text;
comment on column public.customers.anniversary is '기념일 MM-DD (연도 없음, 선택)';
