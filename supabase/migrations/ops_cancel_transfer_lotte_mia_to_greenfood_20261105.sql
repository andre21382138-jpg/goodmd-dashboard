-- ════════════════════════════════════════════════════════════════
-- 재고이동 취소: 롯데백화점 미아점 → 그린푸드 현대 미아점 (2026-11-05)
--   침향환골드 2개 / 침향환프리미엄 2개
-- ════════════════════════════════════════════════════════════════
-- 재고이동(confirmTransfer)은 ① 출발매장 재고 차감 ② store_transfers 'dispatched'
-- 기록 생성만 한다(도착매장 재고는 '입고 수령' 단계에서 received_qty 만큼 가산).
-- 따라서 취소 = 출발매장 재고 복구 + (입고됐다면)도착 차감 + 이동기록 삭제.
--
-- ⚠️ 반드시 STEP 1 을 먼저 실행해 대상이 "오늘, 롯데 미아점→그린푸드, 침향환골드/
--    프리미엄 2건"인지 눈으로 확인한 뒤 STEP 2 를 실행할 것.
-- ════════════════════════════════════════════════════════════════

-- ── STEP 1) 취소 대상 이동기록 확인 ───────────────────────────────
select t.id, t.created_at, p.name as product,
       t.from_store_name, t.from_branch_name,
       t.to_store_name,   t.to_branch_name,
       t.quantity, t.received_qty, t.status
from public.store_transfers t
join public.products p on p.id = t.product_id
where t.from_store_name = '롯데백화점' and t.from_branch_name = '미아점'
  and t.to_store_name   = '그린푸드'
  and t.created_at >= current_date
order by t.created_at desc;

-- ── STEP 2) 취소 실행 (STEP 1 로 2건 확인 후) ─────────────────────
begin;

-- 취소 대상 스냅샷 (오늘자, 롯데 미아점 → 그린푸드)
create temp table _cancel on commit drop as
select t.id, t.product_id, t.quantity, t.received_qty, t.status,
       t.from_store_name, t.from_branch_name, t.to_store_name, t.to_branch_name,
       p.code as p_code, p.erp_code as p_erp, p.name as p_name
from public.store_transfers t
join public.products p on p.id = t.product_id
where t.from_store_name = '롯데백화점' and t.from_branch_name = '미아점'
  and t.to_store_name   = '그린푸드'
  and t.created_at >= current_date;

-- (A) 출발매장(롯데백화점 미아점) 재고 복구 — 차감했던 수량 되돌림
update public.store_stock ss
   set stock_qty  = coalesce(ss.stock_qty,0) + c.quantity,
       updated_at = now()
  from _cancel c
 where ss.store_name = '롯데백화점' and ss.branch_name = '미아점'
   and (ss.product_code = c.p_code or ss.product_code = c.p_erp);

-- (B) 이미 입고(received)된 건이면 도착매장(그린푸드 현대 미아점) 재고 차감
update public.store_stock ss
   set stock_qty  = greatest(coalesce(ss.stock_qty,0) - coalesce(c.received_qty, c.quantity), 0),
       updated_at = now()
  from _cancel c
 where c.status = 'received'
   and ss.store_name = c.to_store_name and ss.branch_name = c.to_branch_name
   and (ss.product_code = c.p_code or ss.product_code = c.p_erp);

-- (C) 이동기록 삭제
delete from public.store_transfers where id in (select id from _cancel);

commit;

-- ── STEP 3) 결과 확인 ─────────────────────────────────────────────
-- 출발매장 재고가 복구됐고, 오늘자 이동기록이 사라졌는지 확인
select store_name, branch_name, product_name, stock_qty
from public.store_stock
where store_name='롯데백화점' and branch_name='미아점'
  and product_name like '침향환%'
order by product_name;
