# 매장 간 재고이동 (점간이동) (Design)

작성일: 2026-05-14
대상 영역:
- DB: 신규 `store_transfers` 테이블 + `order_requests.status` 신규 값
- `src/pages/stock/StoreStockPage.jsx` — 본사 매장재고 화면에 [재고이동] 버튼 + 모달
- `src/pages/order/PurchaseOrderMgrPage.jsx` — 매장 발주확인 페이지에 "재고이동 입고" 탭 추가
- `src/pages/stock/StockRequestPage.jsx` — 매장 재고요청 페이지: status 표시
- 알림: 본사 측 NotificationCenter에 새 재고요청 알림 통합

## 1. 배경 / 목적

매장이 재고가 부족하면 `재고요청`을 보낸다(기존 흐름). 본사는 응답할 두 가지 옵션이 있다:
1. **센터에서 매장으로 발송** — 기존 발주 흐름(`purchase_orders`)으로 처리. 본 spec 범위 외.
2. **다른 매장에서 매장으로 이동(점간이동)** — 본 spec의 신규 흐름.

점간이동 시:
- 본사가 매장재고 페이지에서 출처 매장의 [재고이동] 버튼 클릭
- 대상 매장 + 수량 입력 후 확정 → 즉시 출처 매장 재고 차감
- 출처 매장 매니저는 유선/문자로 연락받아 직접 택배 발송 (시스템 외부 액션)
- 대상 매장은 택배 수령 후 발주확인 페이지의 "재고이동 입고" 탭에서 입고확인 → 재고 가산

또한 매장의 새 재고요청이 본사 알림(NotificationCenter)에 표시된다.

## 2. 사용자 흐름

### 2.1 A매장 매니저 — 재고요청

1. A매장 → 재고관리 → 재고요청.
2. B상품 1개 요청 입력 후 저장 → `order_requests` insert (status='pending').
3. 본사 알림에 카운트 +1 표시됨.
4. (시간 경과) 본사가 점간이동으로 처리 → 자동으로 status='fulfilled' 변경.
5. A매장은 자기 재고요청 리스트에서 "✅ 완료" 상태 확인 가능.

### 2.2 본사 — 알림 확인 후 점간이동 처리

1. 본사 로그인 시 사이드바 알림센터에 **"새 재고요청 N건"** 표시.
2. 클릭 시 (혹은 본사가 직접) **재고관리 → 매장재고** 페이지로 이동.
3. A매장이 요청한 B상품을 보유한 다른 매장(C매장 등)을 매장재고 표에서 찾음.
4. C매장 B상품 행의 **[재고이동]** 버튼 클릭.
5. 모달 표시:
   ```
   재고이동: 팔레오 C점 / B상품 (현재 재고: 8개)

   대상 매장 : [매장 선택 ▼]
   이동 수량 : [   ] (최대 8)
   메모     : [선택]

   ⚠️ 확인 즉시 C점 재고 -1 처리됩니다.

   [취소]  [재고이동 확정]
   ```
6. 본사가 대상 매장(A매장) + 수량 + 메모 입력 후 확정.
7. 시스템 처리 (트랜잭션):
   - C매장 `store_stock.stock_qty -= qty`
   - `store_transfers` 신규 row insert (status='dispatched')
   - 매칭되는 `order_requests`가 있으면 status='fulfilled' 자동 업데이트
8. 본사가 별도로 C매장 매니저에게 유선/문자로 출고 지시 (시스템 외부).

### 2.3 A매장 매니저 — 입고확인

1. 택배 수령 후 A매장 → 재고 관리 → **발주 확인** 진입.
2. 새 탭 **"재고이동 입고"** 클릭.
3. status='dispatched'이고 to_store가 A매장인 store_transfers 행 표시.
4. **[입고확인]** 버튼 클릭 → confirm 후:
   - A매장 `store_stock.stock_qty += qty`
   - `store_transfers.status = 'received'`, `received_at = NOW()`, `received_by = profile.id`
5. 입고확인 완료된 행은 같은 탭의 "완료" 영역에 표시 (혹은 사라짐).

### 2.4 C매장 매니저 — 결과 확인 (수동 액션 없음)

- 매장재고 화면에서 자기 매장 재고가 자동으로 -1 반영된 것을 확인.
- 별도 화면에서 "이동 내역" 조회 가능 (선택, §7 비목표 참조).

## 3. 데이터 모델

### 3.1 신규 테이블 `store_transfers`

```sql
CREATE TABLE store_transfers (
  id bigserial PRIMARY KEY,
  from_store_name text NOT NULL,
  from_branch_name text NOT NULL,
  to_store_name text NOT NULL,
  to_branch_name text NOT NULL,
  product_id bigint NOT NULL REFERENCES products(id),
  quantity int NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'dispatched',  -- 'dispatched' | 'received'
  dispatched_at timestamptz NOT NULL DEFAULT NOW(),
  dispatched_by uuid REFERENCES auth.users(id),
  received_at timestamptz,
  received_by uuid REFERENCES auth.users(id),
  source_request_id bigint REFERENCES order_requests(id),
  memo text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_store_transfers_to_status ON store_transfers (to_store_name, to_branch_name, status);
CREATE INDEX idx_store_transfers_from ON store_transfers (from_store_name, from_branch_name);
```

| 컬럼 | 의미 |
|---|---|
| `from_store_name`, `from_branch_name` | 출처(C매장) |
| `to_store_name`, `to_branch_name` | 대상(A매장) |
| `quantity` | 이동 수량 |
| `status` | `dispatched` (출고됨/이동중) → `received` (입고완료) |
| `dispatched_at` / `dispatched_by` | 본사가 [재고이동] 클릭한 시점/사용자 |
| `received_at` / `received_by` | A매장이 입고확인 클릭한 시점/사용자 |
| `source_request_id` | A매장의 order_requests에서 출발한 경우 그 ID (없으면 NULL) |
| `memo` | 메모 (선택) |

### 3.2 `order_requests` status 신규 값

기존 status 값에 추가: `pending` (기본) → **`fulfilled`** (점간이동으로 처리됨) 추가.

별도 컬럼 변경 없음. 기존 데이터는 그대로 `pending` 유지.

### 3.3 `store_stock` 변경 사항

스키마 변경 없음. 점간이동 시 두 매장의 `stock_qty`를 update.

## 4. 본사 측 UI

### 4.1 매장재고 페이지 (StoreStockPage) — [재고이동] 버튼

본사용(`!isManager`)일 때 **수정** 컬럼 안에 [재고이동] 버튼 추가:

```jsx
<td style={{textAlign:'center'}}>
  {isEditing ? (
    <div style={{display:'flex', gap:4, justifyContent:'center'}}>
      <button className="btn btn-p" ...>저장</button>
      <button className="btn btn-s" ...>취소</button>
    </div>
  ) : (
    <div style={{display:'flex', gap:4, justifyContent:'center'}}>
      <button className="btn btn-s" onClick={()=>startEdit(...)}>수정</button>
      <button type="button"
        onClick={() => openTransferModal(s)}
        disabled={(s.stock_qty||0) <= 0}
        style={{height:26, padding:'0 10px', fontSize:11,
          border:'1px solid #1565C0', borderRadius:'var(--radius)',
          background:(s.stock_qty||0) <= 0 ? '#fafafa' : '#e3f2fd',
          color:(s.stock_qty||0) <= 0 ? 'var(--text3)' : '#1565C0',
          cursor:(s.stock_qty||0) <= 0 ? 'not-allowed' : 'pointer'}}>
        🔁 재고이동
      </button>
    </div>
  )}
</td>
```

재고 0이면 비활성.

### 4.2 재고이동 모달

```jsx
{transferModal && (
  <div className="modal-wrap">
    <div className="modal-box" style={{width:480}}>
      <h3>재고이동 — {transferModal.store_name} {transferModal.branch_name}</h3>
      <p>{transferModal.product_name} (재고: {transferModal.stock_qty}개)</p>

      <label>대상 매장</label>
      <select value={toBranchKey} onChange={...}>
        <option value="">매장 선택</option>
        {allStoreBranches.filter(b => b !== `${transferModal.store_name}|${transferModal.branch_name}`).map(...)}
      </select>

      <label>이동 수량</label>
      <input type="number" min={1} max={transferModal.stock_qty} value={qty} ... />

      <label>메모 (선택)</label>
      <input value={memo} ... />

      <div style={{background:'#fff8e1', padding:'8px 12px', borderRadius:4, marginTop:12}}>
        ⚠️ 확인 즉시 {transferModal.store_name} {transferModal.branch_name} 재고에서 차감됩니다.
      </div>

      <div style={{display:'flex', gap:8, marginTop:14}}>
        <button onClick={() => setTransferModal(null)}>취소</button>
        <button onClick={confirmTransfer} className="btn-p">재고이동 확정</button>
      </div>
    </div>
  </div>
)}
```

대상 매장 옵션은:
- `store_stock` 테이블 또는 `store_addresses` 테이블에서 distinct (store_name, branch_name) 추출
- 또는 STORE_MAP constant 사용 (기존 매장 마스터)

### 4.3 confirmTransfer 핸들러

```jsx
const confirmTransfer = async () => {
  if (!toBranchKey || !qty || qty <= 0 || qty > transferModal.stock_qty) {
    toast('대상 매장과 수량을 확인해주세요', 'err'); return;
  }
  const [toStore, toBranch] = toBranchKey.split('|');
  setProcessing(true);
  try {
    // 1) 출처 매장 재고 차감 (CRITICAL: optimistic concurrency 고려)
    const newQty = (transferModal.stock_qty||0) - Number(qty);
    const { error: stockErr } = await supabase.from('store_stock')
      .update({ stock_qty: newQty, updated_at: new Date().toISOString() })
      .eq('id', transferModal.id);
    if (stockErr) throw stockErr;

    // 2) store_transfers insert
    const { data: tx, error: txErr } = await supabase.from('store_transfers')
      .insert({
        from_store_name: transferModal.store_name,
        from_branch_name: transferModal.branch_name,
        to_store_name: toStore,
        to_branch_name: toBranch,
        product_id: transferModal.product_id,
        quantity: Number(qty),
        status: 'dispatched',
        dispatched_by: profile.id,
        memo: memo.trim() || null,
      })
      .select().single();
    if (txErr) throw txErr;

    // 3) 매칭되는 pending order_requests를 fulfilled로 업데이트
    //    조건: to_store + product_id + status='pending'
    await supabase.from('order_requests')
      .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
      .eq('store_name', toStore)
      .eq('branch_name', toBranch)
      .eq('product_id', transferModal.product_id)
      .eq('status', 'pending');

    toast(`${toStore} ${toBranch}으로 ${qty}개 이동 완료`, 'ok');
    closeTransferModal();
    fetchStocks();
  } catch (err) {
    toast('처리 실패: ' + err.message, 'err');
  } finally {
    setProcessing(false);
  }
};
```

**주의:** 동시성 문제 — 두 본사 직원이 같은 매장의 같은 상품을 동시에 [재고이동]하면 재고가 음수가 될 수 있다. 간단한 안전망: update where `stock_qty >= qty` 같은 조건부 update + 영향받은 row 0이면 에러 toast. 이번 스펙은 보수적으로 `optimistic`만 적용(check at write time), 본격 lock은 추후.

## 5. 매장 측 UI

### 5.1 PurchaseOrderMgrPage — "재고이동 입고" 탭 추가

기존 tab state `'check' | 'receive'`에 `'transfer'` 추가:

```jsx
const [tab, setTab] = useState('check');
// ...
<div className="tabs">
  <button className={`tab ${tab==='check'?'on':''}`} onClick={...}>발주 확인</button>
  <button className={`tab ${tab==='receive'?'on':''}`} onClick={...}>입고 확인</button>
  <button className={`tab ${tab==='transfer'?'on':''}`} onClick={...}>재고이동 입고</button>
</div>
```

### 5.2 재고이동 입고 탭 본문

```jsx
{tab === 'transfer' && (
  <div className="card" style={{padding:'16px 20px'}}>
    {/* 미입고 (status='dispatched') */}
    <h3>📥 입고 대기 중인 재고이동</h3>
    {pendingTransfers.length === 0 ? <div className="empty">대기 중인 재고이동 없음</div> : (
      <table>
        <thead>
          <tr>
            <th>출고일</th><th>출고 매장</th><th>상품</th>
            <th className="r">수량</th><th>메모</th>
            <th style={{textAlign:'center'}}>입고확인</th>
          </tr>
        </thead>
        <tbody>
          {pendingTransfers.map(t => (
            <tr key={t.id}>
              <td className="mono">{new Date(t.dispatched_at).toLocaleDateString('ko-KR')}</td>
              <td>{t.from_store_name} {t.from_branch_name}</td>
              <td>{t.product?.name}</td>
              <td className="r">{t.quantity}개</td>
              <td>{t.memo || '-'}</td>
              <td style={{textAlign:'center'}}>
                <button onClick={() => handleReceiveTransfer(t)} className="btn-p">입고확인</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {/* 입고완료 (status='received') — 옵션, 최근 10건 정도 */}
    <h3 style={{marginTop:20}}>✅ 최근 입고 완료</h3>
    {/* ... */}
  </div>
)}
```

### 5.3 handleReceiveTransfer 핸들러

```jsx
const handleReceiveTransfer = async (transfer) => {
  if (!window.confirm(`${transfer.product?.name} ${transfer.quantity}개 입고확인하시겠습니까?`)) return;
  try {
    // 1) 우리 매장 재고 가산
    const { data: stockRow } = await supabase.from('store_stock')
      .select('id, stock_qty')
      .eq('store_name', profile.department)
      .eq('branch_name', profile.branch)
      .eq('product_id', transfer.product_id)
      .maybeSingle();

    if (stockRow) {
      await supabase.from('store_stock').update({
        stock_qty: (stockRow.stock_qty || 0) + transfer.quantity,
        updated_at: new Date().toISOString(),
      }).eq('id', stockRow.id);
    } else {
      // store_stock에 row가 없는 경우 신규 insert
      await supabase.from('store_stock').insert({
        store_name: profile.department,
        branch_name: profile.branch,
        product_id: transfer.product_id,
        stock_qty: transfer.quantity,
      });
    }

    // 2) store_transfers status 업데이트
    await supabase.from('store_transfers').update({
      status: 'received',
      received_at: new Date().toISOString(),
      received_by: profile.id,
    }).eq('id', transfer.id);

    toast('입고확인 완료. 재고 +' + transfer.quantity, 'ok');
    fetchTransfers();
  } catch (err) {
    toast('처리 실패: ' + err.message, 'err');
  }
};
```

### 5.4 StockRequestPage — status 표시

기존 매장 재고요청 리스트에 status 컬럼 추가 (기존엔 없을 수 있음 — 확인 후 추가):

```jsx
<td>
  {r.status === 'pending'   ? <span style={{color:'#1565C0'}}>대기중</span>
   : r.status === 'fulfilled' ? <span style={{color:'var(--success)', fontWeight:700}}>✅ 완료</span>
   : <span style={{color:'var(--text3)'}}>{r.status}</span>}
</td>
```

## 6. 알림 (NotificationCenter)

### 6.1 본사용 알림

본사 로그인 시 사이드바의 NotificationCenter에 다음 항목 추가:

- 라벨: `📋 새 재고요청`
- 카운트: `order_requests` 중 `status='pending'`인 행 수
- 클릭 시 동작: 매장재고 페이지 또는 재고요청 모아보기 페이지로 이동

### 6.2 구현 위치

`src/components/NotificationCenter.jsx` (가정) 또는 Sidebar에서 fetch:

```jsx
const { count } = await supabase.from('order_requests')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'pending');
```

기존 NotificationCenter 구조에 맞춰 통합 (구체적 코드는 plan 단계에서).

## 7. 회귀 영향 / 안전성

- **기존 매장 재고**: 변경 없음. 점간이동 시점에만 update.
- **기존 발주(`purchase_orders`)**: 영향 없음. 본 spec과 별개.
- **기존 재고요청(`order_requests`)**: status='fulfilled' 신규 값. 기존 'pending'은 그대로.
- **동시성**: 본사 두 명이 동시에 같은 매장 같은 상품을 [재고이동]하면 재고 음수 가능. 본 spec은 단순 update로 처리. 향후 개선 가능.
- **NULL 안전**: `store_stock` row가 대상 매장에 없으면 입고확인 시 insert (위 §5.3 참고).
- **A매장 입고확인 누락**: 본사가 출고 처리 후 A매장이 입고확인 안 누르면 영원히 status='dispatched' 상태. 별도 관리 기능은 비목표.

## 8. 비목표 (Out of Scope)

- 점간이동 취소/되돌리기 (배송 분실, 오발송 등): SQL 수동 처리만
- C매장 매니저 측 별도 알림/액션 화면 (전화로 안내 받기 패턴 유지)
- 운송장 번호 입력/추적
- 재고이동 통계/리포트 페이지
- 매장 간 직접 이동 요청 (현재는 본사 경유만)
- 안전재고 미달 자동 알림 본사 통합 (별도 spec)
- 본사가 일반 직원과 다른 권한으로 점간이동 처리 (RLS 추가)
- 동시성 강건성 (row-level lock, optimistic concurrency check) — 향후 개선
