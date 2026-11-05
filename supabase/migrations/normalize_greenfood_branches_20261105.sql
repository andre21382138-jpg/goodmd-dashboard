-- ════════════════════════════════════════════════════════════════
-- 그린푸드 지점명 표기 통일: 짧은표기 → "현대 XXX점" (2026-11-05)
-- ════════════════════════════════════════════════════════════════
-- [근거] 전수조사 결과 운영 기준 데이터는 모두 긴 표기를 사용:
--   · sales   : 현대 대구점/현대 미아점/현대 목동점/현대 신촌점/현대 중동점/현대판교점 …
--   · profiles: 현대 대구점/현대 미아점
--   · STORE_MAP(constants.js): 긴 표기
--   · store_stock 만 짧은 표기(미아점/목동점/…)를 써서 어긋남 → 이쪽을 교정
--   · 'store_stock'의 대구점(짧은) 과 현대 대구점(긴)이 공존 → 수량 병합 후 통합
--
-- store_stock 의 (store_name, branch_name, product_code) 가 사실상 고유키라는
-- 전제에서, 대구만 "겹치는 코드는 수량 합산 → 짧은행 삭제 → 나머지 rename" 순으로
-- 안전하게 병합한다. 나머지 지점은 긴 표기 행이 없으므로 단순 rename 으로 충분하다.
--
-- 실행 전 백업 권장: 아래 확인 쿼리(맨 아래)로 before/after 비교.
-- ════════════════════════════════════════════════════════════════

begin;

-- ── 1) store_stock: 긴 표기 행이 없는 지점은 단순 rename ─────────────
update public.store_stock set branch_name = '현대 목동점' where store_name='그린푸드' and branch_name='목동점';
update public.store_stock set branch_name = '현대 미아점' where store_name='그린푸드' and branch_name='미아점';
update public.store_stock set branch_name = '현대 신촌점' where store_name='그린푸드' and branch_name='신촌점';
update public.store_stock set branch_name = '현대 중동점' where store_name='그린푸드' and branch_name='중동점';
update public.store_stock set branch_name = '현대 천호점' where store_name='그린푸드' and branch_name='천호점';
update public.store_stock set branch_name = '현대판교점' where store_name='그린푸드' and branch_name='판교점';
-- 더현대서울점 / 현대 대구점(긴) 은 이미 정답 → 그대로 둠

-- ── 2) store_stock: 대구 병합 (대구점 → 현대 대구점) ─────────────────
-- 2-1) 두 표기에 모두 있는 product_code: 긴 표기 행에 수량 합산
update public.store_stock t
   set stock_qty = coalesce(t.stock_qty,0) + coalesce(s.stock_qty,0)
  from public.store_stock s
 where t.store_name='그린푸드' and t.branch_name='현대 대구점'
   and s.store_name='그린푸드' and s.branch_name='대구점'
   and t.product_code = s.product_code;

-- 2-2) 방금 합산 처리된 짧은표기(대구점) 행 삭제
delete from public.store_stock s
 where s.store_name='그린푸드' and s.branch_name='대구점'
   and exists (
     select 1 from public.store_stock t
      where t.store_name='그린푸드' and t.branch_name='현대 대구점'
        and t.product_code = s.product_code);

-- 2-3) 겹치지 않는 나머지 대구점 행은 긴 표기로 rename
update public.store_stock set branch_name='현대 대구점'
 where store_name='그린푸드' and branch_name='대구점';

-- ── 3) store_transfers: 짧은 표기 → 긴 표기 (from/to 양쪽) ───────────
update public.store_transfers set to_branch_name='현대 목동점' where to_store_name='그린푸드' and to_branch_name='목동점';
update public.store_transfers set to_branch_name='현대 미아점' where to_store_name='그린푸드' and to_branch_name='미아점';
update public.store_transfers set to_branch_name='현대 신촌점' where to_store_name='그린푸드' and to_branch_name='신촌점';
update public.store_transfers set to_branch_name='현대 중동점' where to_store_name='그린푸드' and to_branch_name='중동점';
update public.store_transfers set to_branch_name='현대 천호점' where to_store_name='그린푸드' and to_branch_name='천호점';
update public.store_transfers set to_branch_name='현대판교점' where to_store_name='그린푸드' and to_branch_name='판교점';
update public.store_transfers set to_branch_name='현대 대구점' where to_store_name='그린푸드' and to_branch_name='대구점';

update public.store_transfers set from_branch_name='현대 목동점' where from_store_name='그린푸드' and from_branch_name='목동점';
update public.store_transfers set from_branch_name='현대 미아점' where from_store_name='그린푸드' and from_branch_name='미아점';
update public.store_transfers set from_branch_name='현대 신촌점' where from_store_name='그린푸드' and from_branch_name='신촌점';
update public.store_transfers set from_branch_name='현대 중동점' where from_store_name='그린푸드' and from_branch_name='중동점';
update public.store_transfers set from_branch_name='현대 천호점' where from_store_name='그린푸드' and from_branch_name='천호점';
update public.store_transfers set from_branch_name='현대판교점' where from_store_name='그린푸드' and from_branch_name='판교점';
update public.store_transfers set from_branch_name='현대 대구점' where from_store_name='그린푸드' and from_branch_name='대구점';

commit;

-- ── 확인용 조회 (실행 후 짧은표기가 사라졌는지 확인) ────────────────
select 'store_stock' src, branch_name, count(*) from public.store_stock
  where store_name='그린푸드' group by branch_name
union all
select 'store_transfers(to)', to_branch_name, count(*) from public.store_transfers
  where to_store_name='그린푸드' group by to_branch_name
order by 1, 2;
