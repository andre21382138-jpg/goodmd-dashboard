-- ════════════════════════════════════════════════════════════════
-- 재고이동 취소: 롯데백화점 미아점 → 그린푸드 현대 미아점 (2026-11-05)
--   침향환골드 2개 / 침향환프리미엄 2개
-- ════════════════════════════════════════════════════════════════
-- [조사 결과] store_transfers 에 오늘자 해당 이동기록이 '없음'.
-- 재고이동(confirmTransfer)은 ① 출발재고 차감 → ② 이동기록 insert 순인데,
-- ①만 반영되고 ②가 실패한 '부분 실패' 상태였다. (도착매장은 받은 것 없음)
--   · HS_한생방침향환(25%)_3.75g*60H       : 12 (updated 2026-11-05 06:57, -2 차감됨)
--   · HS_한생방침향환프리미엄_3.75g*30H     : 12 (updated 2026-11-05 06:57, -2 차감됨)
-- 따라서 취소 = 출발매장(롯데 미아점) 재고를 2개씩 복구(12→14)하면 끝.
-- 삭제할 이동기록도, 차감할 도착재고도 없다.
-- ════════════════════════════════════════════════════════════════

-- 복구: 롯데백화점 미아점 재고 +2 (이동 1회 기준)
update public.store_stock
   set stock_qty  = coalesce(stock_qty,0) + 2,
       updated_at = now()
 where store_name = '롯데백화점' and branch_name = '미아점'
   and product_name in (
     'HS_한생방침향환(25%)_3.75g*60H',
     'HS_한생방침향환프리미엄_3.75g*30H'
   );

-- 확인: 두 상품이 각각 14개면 정상 복구
select store_name, branch_name, product_name, stock_qty, updated_at
from public.store_stock
where store_name='롯데백화점' and branch_name='미아점'
  and product_name in (
    'HS_한생방침향환(25%)_3.75g*60H',
    'HS_한생방침향환프리미엄_3.75g*30H'
  )
order by product_name;
