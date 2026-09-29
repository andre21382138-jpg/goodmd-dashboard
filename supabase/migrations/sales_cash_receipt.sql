-- 대동백화점 현금결제 시 현금영수증 발행 유무 저장 (2026-09)
-- true=발행, false=미발행, null=해당없음(대동 외 매장·현금 아닌 결제)
alter table public.sales add column if not exists cash_receipt boolean;
