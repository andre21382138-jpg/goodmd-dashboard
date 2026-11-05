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

-- ── STEP 2) 취소 실행 (STEP 1 로 2건 확인 후, 아래 '한 문장'을 1회만 실행) ──
-- temp 테이블/begin-commit 없이 단일 문장(CTE)으로 원자적 처리.
-- 모든 수정 CTE 는 같은 스냅샷을 보므로 tgt 를 삭제해도 수량 계산은 안전하다.
-- ⚠️ 두 번 실행하면 재고가 중복 복구되니 정확히 1회만 실행할 것.
with tgt as (
  select t.id, p.code as p_code, p.erp_code as p_erp,
         t.quantity, coalesce(t.received_qty, t.quantity) as recv, t.status
  from public.store_transfers t
  join public.products p on p.id = t.product_id
  where t.from_store_name = '롯데백화점' and t.from_branch_name = '미아점'
    and t.to_store_name   = '그린푸드'
    and t.created_at >= current_date
),
src_agg as (   -- 상품별 복구 수량 (UPDATE..FROM 중복매칭 합산 안되는 문제 회피)
  select p_code, p_erp, sum(quantity) as qty from tgt group by p_code, p_erp
),
recv_agg as (  -- 입고완료분만 (도착 차감용)
  select p_code, p_erp, sum(recv) as qty from tgt where status = 'received' group by p_code, p_erp
),
restore_src as (  -- (A) 롯데 미아점 재고 복구
  update public.store_stock ss
     set stock_qty = coalesce(ss.stock_qty,0) + a.qty, updated_at = now()
    from src_agg a
   where ss.store_name = '롯데백화점' and ss.branch_name = '미아점'
     and (ss.product_code = a.p_code or ss.product_code = a.p_erp)
  returning ss.id
),
dec_tgt as (      -- (B) 입고됐던 경우에만 그린푸드 현대 미아점 차감
  update public.store_stock ss
     set stock_qty = greatest(coalesce(ss.stock_qty,0) - a.qty, 0), updated_at = now()
    from recv_agg a
   where ss.store_name = '그린푸드' and ss.branch_name = '현대 미아점'
     and (ss.product_code = a.p_code or ss.product_code = a.p_erp)
  returning ss.id
),
del_tx as (       -- (C) 이동기록 삭제
  delete from public.store_transfers where id in (select id from tgt) returning id
)
select
  (select count(*) from tgt)         as 대상이동건수,
  (select count(*) from restore_src) as 출발재고복구행,
  (select count(*) from dec_tgt)     as 도착재고차감행,
  (select count(*) from del_tx)      as 이동기록삭제건수;

-- ── STEP 3) 결과 확인 ─────────────────────────────────────────────
-- 출발매장 재고가 복구됐고, 오늘자 이동기록이 사라졌는지 확인
select store_name, branch_name, product_name, stock_qty
from public.store_stock
where store_name='롯데백화점' and branch_name='미아점'
  and product_name like '침향환%'
order by product_name;
