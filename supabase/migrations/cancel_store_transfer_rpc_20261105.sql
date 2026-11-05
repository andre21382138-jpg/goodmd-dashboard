-- ════════════════════════════════════════════════════════════════
-- 매장 재고이동 '취소' RPC (2026-11-05)
-- ════════════════════════════════════════════════════════════════
-- 이동내역 화면의 [취소] 버튼이 호출한다. 전 과정을 단일 트랜잭션으로 되돌린다.
--   · dispatched(미입고) : 출발매장 +quantity 복구
--   · received(입고완료) : 출발매장 +received_qty 복구 + 도착매장 -received_qty 차감
--     (입고 시 도착 +received_qty, 부족분은 출발로 복원되어 출발 net = -received_qty 였음)
--   · 이후 store_transfers 기록 삭제
-- 하나라도 실패하면 전체 롤백. order_requests 완료상태는 건드리지 않는다
-- (어느 요청이 이 이동으로 완료됐는지 특정 불가 → 수동 조정 영역).
-- ════════════════════════════════════════════════════════════════

create or replace function public.cancel_store_transfer(p_transfer_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tx       public.store_transfers%rowtype;
  v_code     text;
  v_erp      text;
  v_src_qty  numeric;
  v_src_rows int := 0;
  v_tgt_rows int := 0;
begin
  select * into v_tx from public.store_transfers where id = p_transfer_id for update;
  if not found then
    raise exception '이동 기록을 찾을 수 없습니다 (id=%)', p_transfer_id;
  end if;

  select code, erp_code into v_code, v_erp from public.products where id = v_tx.product_id;

  if v_tx.status = 'dispatched' then
    v_src_qty := v_tx.quantity;
  elsif v_tx.status = 'received' then
    v_src_qty := coalesce(v_tx.received_qty, v_tx.quantity);
    -- 도착매장 재고 차감
    update public.store_stock ss
       set stock_qty  = greatest(coalesce(ss.stock_qty,0) - coalesce(v_tx.received_qty, v_tx.quantity), 0),
           updated_at = now()
     where ss.store_name = v_tx.to_store_name and ss.branch_name = v_tx.to_branch_name
       and (ss.product_code = v_code or ss.product_code = v_erp);
    get diagnostics v_tgt_rows = row_count;
  else
    raise exception '취소할 수 없는 상태입니다 (status=%)', v_tx.status;
  end if;

  -- 출발매장 재고 복구
  update public.store_stock ss
     set stock_qty  = coalesce(ss.stock_qty,0) + v_src_qty,
         updated_at = now()
   where ss.store_name = v_tx.from_store_name and ss.branch_name = v_tx.from_branch_name
     and (ss.product_code = v_code or ss.product_code = v_erp);
  get diagnostics v_src_rows = row_count;

  -- 이동 기록 삭제
  delete from public.store_transfers where id = p_transfer_id;

  return jsonb_build_object(
    'transfer_id',  p_transfer_id,
    'status_was',   v_tx.status,
    'src_restored', v_src_qty,
    'src_rows',     v_src_rows,
    'tgt_rows',     v_tgt_rows);
end;
$$;

grant execute on function public.cancel_store_transfer(bigint) to authenticated;
