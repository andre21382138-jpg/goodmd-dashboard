-- 창원지점 재고 수불장 (2026-11) — 독립 서브시스템 (기존 매출/재고와 분리)
-- 제품현황 / 입고입력 / 출고입력 / 재고현황 전용. role=changwon 계정이 사용.

-- ── 제품 마스터 ──
create table if not exists public.cw_products (
  id            bigserial primary key,
  erp_code      text,                       -- 제품코드(본사전산 ERP)
  product_name  text,                       -- 상품명
  out_code      text,                       -- 출고코드(참고, 농협 대체코드 등)
  out_name      text,                       -- 출고코드 상품명
  opening_stock integer not null default 0, -- 기초재고(시딩 시점 현재고)
  sort_no       integer,                    -- 정렬순서(수불장 NO)
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cw_products_sort on public.cw_products (sort_no);

-- ── 매장 ──
create table if not exists public.cw_stores (
  id       bigserial primary key,
  name     text not null unique,
  sort_no  integer,
  active   boolean not null default true
);

-- ── 입고 기록 ──
create table if not exists public.cw_inbound (
  id           bigserial primary key,
  product_id   bigint not null references public.cw_products(id) on delete cascade,
  qty          integer not null,
  inbound_type text not null default '물류센터입고', -- 물류센터입고/구매입고/매장반품입고/매장반품교환
  memo         text,
  created_at   timestamptz not null default now(),
  created_by   uuid
);
create index if not exists idx_cw_inbound_prod on public.cw_inbound (product_id, created_at desc);

-- ── 출고 기록 ──
create table if not exists public.cw_outbound (
  id         bigserial primary key,
  product_id bigint not null references public.cw_products(id) on delete cascade,
  store_id   bigint not null references public.cw_stores(id),
  qty        integer not null default 0,  -- 출고수량
  bonus      integer not null default 0,  -- 증정(덤)
  disposal   integer not null default 0,  -- 폐기
  memo       text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists idx_cw_outbound_prod on public.cw_outbound (product_id, created_at desc);
create index if not exists idx_cw_outbound_store on public.cw_outbound (store_id, created_at desc);

-- ── RLS (로그인 내부직원 공통 — 접근 구분은 앱 레벨 role로) ──
alter table public.cw_products enable row level security;
drop policy if exists cw_products_rw on public.cw_products;
create policy cw_products_rw on public.cw_products for all to authenticated using (true) with check (true);
alter table public.cw_stores enable row level security;
drop policy if exists cw_stores_rw on public.cw_stores;
create policy cw_stores_rw on public.cw_stores for all to authenticated using (true) with check (true);
alter table public.cw_inbound enable row level security;
drop policy if exists cw_inbound_rw on public.cw_inbound;
create policy cw_inbound_rw on public.cw_inbound for all to authenticated using (true) with check (true);
alter table public.cw_outbound enable row level security;
drop policy if exists cw_outbound_rw on public.cw_outbound;
create policy cw_outbound_rw on public.cw_outbound for all to authenticated using (true) with check (true);

-- ── 매장 시딩 ──
insert into public.cw_stores (name, sort_no) values ('동읍', 1) on conflict (name) do nothing;
insert into public.cw_stores (name, sort_no) values ('함안', 2) on conflict (name) do nothing;
insert into public.cw_stores (name, sort_no) values ('창녕', 3) on conflict (name) do nothing;
insert into public.cw_stores (name, sort_no) values ('서생', 4) on conflict (name) do nothing;
insert into public.cw_stores (name, sort_no) values ('온양', 5) on conflict (name) do nothing;
insert into public.cw_stores (name, sort_no) values ('의령', 6) on conflict (name) do nothing;
insert into public.cw_stores (name, sort_no) values ('농협지인', 7) on conflict (name) do nothing;

-- ── 제품 시딩 (수불장 43개 · opening_stock=현재고) ──
-- 재시딩 안전: 이미 있으면 건너뜀(sort_no 중복 방지용으로 비어있을 때만 일괄 insert)
do $$
begin
  if not exists (select 1 from public.cw_products) then
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809470003489_1', '로엘 아보카도오일 250ml', '8809470003489_1', '로엘 아보카도오일 250ml', 168, 1);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809193321631', '메이준 더블액션 프리바이오틱스 플러스', '', '', 0, 2);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722522898_3', '팔레오 오리진 산양유 프로틴', '', '', 209, 3);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809470008965', '팔레오 노니 분말(30g)', '', '', 55, 4);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722524809', '고칼슘산양프로틴280g', '', '', 94, 5);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722520887_6', '포스트바이오틱스생유산균 맥스(미네랄맥스)', '', '', 142, 6);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722528593', '흑염소즙(30포)', '', '', 81, 7);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722528456', '콘드로이친 류신 30정', '', '', 56, 8);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722522447_1', '아르기닌젤리(27.2.25_)', '', '', 2, 9);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722528425', '초임계 알티지오메가3', '', '', 75, 10);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722522348_6', '', '', '', 0, 11);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722520825', '아보카도오일 500ml', '8809722520986', '팔레오 오리진 타트체리', 80, 12);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722526148', '오리진산양유프로틴세트 케이스', '', '', 48, 13);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722527978', '고칼슘산양유프로틴세트 케이스', '', '', 101, 14);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956530430', '모유유래프롤린 유산균스틱', '', '', 21, 15);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956531178', '침향단', '', '', 4, 16);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956531697', '유기농 레몬즙', '', '', 81, 17);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956532519', '흑마늘즙', '', '', 52, 18);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956532502', '석류즙', '', '', 59, 19);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956532359', '엠머밀 파로효소(27.1.1)', '', '', 0, 20);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722525851', '리포좀 글루타치온 콜라겐비타민C', '', '', 23, 21);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956532885', '근력강화산양유프로틴 245g', '', '', 58, 22);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956533080', '유기농대마종자유', '8809722525837', 'PO_대마종자유_1000MG*30C', 118, 23);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956533097', '알부민토탈벨런스(정)', '8809722528999', 'PO_닥터스노트_글루타치온 정_1000mg*60T', 17, 24);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956534452', '생생활력 마시는알부민(15포)', '', '', 95, 25);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956532748', '멜라토닌 함유 멜라베라', '', '', 5, 26);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956535046', '활력충전 마시는 알부민(15병) 28.2.9', '', '', 9, 27);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956531086', '오리지널 카무트효소', '', '', 63, 28);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956535190', '탱글탱글석류콜라겐젤리세트(3개입)', '8809722521334', 'PO_석류콜라겐젤리_3입세트_1', 36, 29);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956535169', '탱글탱글석류콜라겐젤리(신규)', '', '', 116, 30);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956534063', '올리브오일 250ml', '8809722525844', 'PO_노르웨이알티지오메가3_1050mg x 30C', 33, 31);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956533158', '올리브오일 500ml', '8809722525158', 'RL_콤부차레몬_5g*30P', 23, 32);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956534803', '올인원 멀티비타민&미네랄(60정)-27.12.16', '', '', 62, 33);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956534537', '식물성 엑스트라보진 올리브오일캡슐28.2.8', '', '', 46, 34);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956535367', '블루베리퓨레100 (14포)-28.2.24', '', '', 116, 35);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722528012', '파인애플발효효소(26.11.4-5, 27.2.13-9)', '', '', 0, 36);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722525684', '', '', '', 0, 37);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956535602', '루테인지아잔틴', '8809956531123', 'PO_루테인지아잔틴300mgX30C', 32, 38);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956535480', '두뇌엔PS 포스파티딜세린 PS(15포)', '', '', 12, 39);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956535787', '탱글탱글 레몬콜라겐젤리스틱', '8809956530003', 'PO_아누카사과비오틴정_60정', 54, 40);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809193321273', '쾌변했어', '', '', 0, 41);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809956536661', '마시는 젖산 마그네슘', '8809722529064', 'PO_닥터스노트_촉촉피부다이어트', 0, 42);
    insert into public.cw_products (erp_code, product_name, out_code, out_name, opening_stock, sort_no) values ('8809722526186', '', '', '', 0, 43);
  end if;
end $$;
