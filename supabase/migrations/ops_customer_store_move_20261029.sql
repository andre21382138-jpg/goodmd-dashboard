-- 고객 점포 이동 (2026-10-29) — 일회성 데이터 이관
-- 이마트_SHOP 광교점      → 갤러리아백화점 광교점
-- 이마트_SHOP 대전터미널점 → 롯데백화점 대전점
-- 주의: customers 테이블의 store_name/branch_name만 변경. sales(판매 이력)의
--       store_name/branch_name은 과거 실적 귀속이라 이 스크립트에서는 건드리지 않음.

-- 대상 건수 확인
-- select store_name, branch_name, count(*) from customers
--  where (store_name='이마트_SHOP' and branch_name in ('광교점','대전터미널점'))
--  group by store_name, branch_name;

update customers
set store_name = '갤러리아백화점', branch_name = '광교점'
where store_name = '이마트_SHOP' and branch_name = '광교점';

update customers
set store_name = '롯데백화점', branch_name = '대전점'
where store_name = '이마트_SHOP' and branch_name = '대전터미널점';
