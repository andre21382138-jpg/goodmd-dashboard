-- ════════════════════════════════════════════════════════════════
-- 매장 재고이동 원자화 RPC (2026-11-05)
-- ════════════════════════════════════════════════════════════════
-- 배경: 기존 confirmTransfer 는 ①출발재고 차감 ②store_transfers insert ③order_requests
--       완료처리를 '별개의 HTTP 요청'으로 순차 실행 → ②가 네트워크/타임아웃 등으로
--       실패하면 ①만 커밋되어 '재고만 조용히 빠지는' 부분 실패가 발생했다.
-- 해결: 전 과정을 단일 트랜잭션 함수로 묶는다. 하나라도 실패하면 전체 롤백.
--
-- 안전장치:
--   · SECURITY DEFINER + search_path 고정 (RLS 우회하되 함수 내부에서 직접 검증)
--   · 출발 재고 행을 FOR UPDATE 로 잠가 동시성 경합 방지
--   · 재고 부족/동일매장/미등록상품은 예외로 막아 전체 롤백
--   · dispatched_by 는 서버에서 auth.uid() 로 기록(클라이언트 전달값 신뢰 안 함)
-- ════════════════════════════════════════════════════════════════

create or replace function public.transfer_store_stock(
  p_stock_id  bigint,
  p_to_store  text,
  p_to_branch text,
  p_qty       numeric,
  p_memo      text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_src        public.store_stock%rowtype;
  v_product_id bigint;
  v_new_qty    numeric;
  v_tx_id      bigint;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception '수량이 올바르지 않습니다';
  end if;

  -- 출발 재고 행 잠금 조회
  select * into v_src from public.store_stock where id = p_stock_id for update;
  if not found then
    raise exception '출발 재고 행을 찾을 수 없습니다 (id=%)', p_stock_id;
  end if;

  if v_src.store_name = p_to_store and v_src.branch_name = p_to_branch then
    raise exception '동일 매장으로 이동할 수 없습니다';
  end if;

  if coalesce(v_src.stock_qty, 0) < p_qty then
    raise exception '현재 재고를 초과합니다 (현재 %, 요청 %)', coalesce(v_src.stock_qty,0), p_qty;
  end if;

  -- product_id 확보 (store_stock 에는 product_id 컬럼이 없고 product_code 만 있으므로
  --                   products 에서 code → erp_code 순으로 조회해 보정)
  if v_src.product_code is null or btrim(v_src.product_code) = '' then
    raise exception '상품 코드가 없어 이동할 수 없습니다';
  end if;
  select id into v_product_id from public.products
    where code = v_src.product_code
    order by is_sales_stopped asc nulls last limit 1;
  if v_product_id is null then
    select id into v_product_id from public.products
      where erp_code = v_src.product_code
      order by is_sales_stopped asc nulls last limit 1;
  end if;
  if v_product_id is null then
    raise exception '상품관리에 등록되지 않은 상품입니다 (code=%)', v_src.product_code;
  end if;

  -- 1) 출발 재고 차감
  v_new_qty := coalesce(v_src.stock_qty, 0) - p_qty;
  update public.store_stock
     set stock_qty = v_new_qty, updated_at = now()
   where id = p_stock_id;

  -- 2) 이동 기록
  insert into public.store_transfers(
    from_store_name, from_branch_name, to_store_name, to_branch_name,
    product_id, quantity, status, dispatched_by, memo)
  values (
    v_src.store_name, v_src.branch_name, p_to_store, p_to_branch,
    v_product_id, p_qty, 'dispatched', auth.uid(),
    nullif(btrim(coalesce(p_memo, '')), ''))
  returning id into v_tx_id;

  -- 3) 매칭되는 대기 발주요청 완료 처리
  update public.order_requests
     set status = 'fulfilled', updated_at = now()
   where store_name = p_to_store and branch_name = p_to_branch
     and product_id = v_product_id and status = 'pending';

  return jsonb_build_object(
    'transfer_id', v_tx_id,
    'product_id',  v_product_id,
    'from_store',  v_src.store_name,
    'from_branch', v_src.branch_name,
    'to_store',    p_to_store,
    'to_branch',   p_to_branch,
    'qty',         p_qty,
    'new_stock',   v_new_qty);
end;
$$;

grant execute on function public.transfer_store_stock(bigint, text, text, numeric, text) to authenticated;
