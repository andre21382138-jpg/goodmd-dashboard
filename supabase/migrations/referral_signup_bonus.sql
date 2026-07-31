-- 2026-08-01 시행: 신규가입 3,000원 적립 + 추천인(휴대폰) 첫구매 시 3,000원 지급
alter table public.customers add column if not exists referrer_phone text;             -- 추천인 휴대폰(숫자/하이픈 무관)
alter table public.customers add column if not exists referral_rewarded_at timestamptz; -- 추천인 보상 지급 시각(첫구매, 1회)

create index if not exists idx_customers_phone_digits
  on public.customers ((regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g')));
