# 본사 확정 단계 + 매장재고 자동 반영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본사 발주현황에 매장 재요청 검토·수정·확정 단계 추가하고, 매장 입고확인 시 store_stock에 received_qty 자동 반영.

**Architecture:** `purchase_orders.status`에 신규 값 `confirmed` 도입(text 컬럼이라 DB 변경 없음). HQ 페이지에는 발주현황 펼침 영역의 표시 모드를 status 별로 분기(편집/읽기전용)하고 확정 버튼 추가, 엑셀 다운로드 필터를 `confirmed`로 변경. Mgr 페이지에는 탭 필터 변경 + handleReceive에 store_stock 업데이트 로직 추가.

**Tech Stack:** React 18, Supabase JS.

**Spec:** `docs/superpowers/specs/2026-05-11-purchase-order-confirm-and-stock-receive-design.md`

**Test 전략:** 본 프로젝트에는 컴포넌트 테스트 인프라가 없으므로 각 작업은 `npm run build` + dev server 수동 검증으로 마무리한다.

---

## File Structure

- Modify: `src/pages/order/PurchaseOrderHQPage.jsx` — STATUS_LABEL 확장, 발주현황 펼침 영역 편집 모드 + 확정 버튼/handler, 엑셀 필터 변경.
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx` — STATUS_LABEL 확장, check/receive 탭 필터 변경, handleReceive에 store_stock 업데이트 추가.

새 파일 없음. DB 변경 없음.

---

## Task 1: HQ 측 - STATUS_LABEL 확장 + 발주현황 편집/확정 UI + 엑셀 필터 변경

**Files:**
- Modify: `src/pages/order/PurchaseOrderHQPage.jsx`

- [ ] **Step 1: STATUS_LABEL에 'confirmed' 추가**

`STATUS_LABEL` 정의(현재 약 5-10행)에 confirmed 항목 추가.

기존:
```jsx
const STATUS_LABEL = {
  sent:        { label:'발송',        color:'#1565C0', bg:'#e3f2fd', border:'#90caf9' },
  requested:   { label:'발주요청',    color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  rerequested: { label:'재요청',      color:'#bf360c', bg:'#fbe9e7', border:'#ffab91' },
  received:    { label:'입고완료',    color:'#6a1b9a', bg:'#f3e5f5', border:'#ce93d8' },
};
```

다음으로 변경:
```jsx
const STATUS_LABEL = {
  sent:        { label:'발송',        color:'#1565C0', bg:'#e3f2fd', border:'#90caf9' },
  requested:   { label:'발주요청',    color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  rerequested: { label:'재요청',      color:'#bf360c', bg:'#fbe9e7', border:'#ffab91' },
  confirmed:   { label:'확정',        color:'#bf360c', bg:'#fff3e0', border:'#ffcc80' },
  received:    { label:'입고완료',    color:'#6a1b9a', bg:'#f3e5f5', border:'#ce93d8' },
};
```

- [ ] **Step 2: exportPurchaseOrders의 필터 변경**

`exportPurchaseOrders` 함수(현재 약 13-124행) 내 fetch query.

기존(약 17-18행):
```jsx
.in('status', ['requested', 'rerequested'])
.is('exported_at', null)
```

다음으로 변경:
```jsx
.eq('status', 'confirmed')
.is('exported_at', null)
```

- [ ] **Step 3: handleExport의 preview query 필터 변경**

`handleExport` 함수(현재 약 322-372행) 내 preview query.

기존(약 327-330행):
```jsx
const { data: previewOrders, error: pErr } = await supabase.from('purchase_orders')
  .select('store_name, branch_name')
  .in('status', ['requested', 'rerequested'])
  .is('exported_at', null);
```

다음으로 변경:
```jsx
const { data: previewOrders, error: pErr } = await supabase.from('purchase_orders')
  .select('store_name, branch_name')
  .eq('status', 'confirmed')
  .is('exported_at', null);
```

또한 다운로드 버튼의 title 텍스트도 의미에 맞게 변경. `handleExport` 호출 버튼(약 559-562행):

기존:
```jsx
<button className="btn btn-p" onClick={handleExport} disabled={exporting}
  title="매장 발주요청 + 미출하 발주를 한 번에 묶어 매장발주 양식 xlsx 다운로드">
```

다음으로:
```jsx
<button className="btn btn-p" onClick={handleExport} disabled={exporting}
  title="확정된 미출하 발주를 한 번에 묶어 매장발주 양식 xlsx 다운로드">
```

- [ ] **Step 4: 확정 처리용 state + handler 추가**

기존 component state 영역(`statusLoading` 다음)에 추가:

```jsx
  const [confirmEditMap, setConfirmEditMap] = useState({}); // { itemId: qty }
  const [confirming, setConfirming] = useState(false);
```

기존 `setExpandedOrder` 호출하는 expand 클릭부 근처에 expanded 변경 시 편집 맵을 초기화하는 핸들러 추가. 기존 toggleExpand가 없고 inline `onClick`만 있으므로 별도 함수 추가.

`handleExport` 정의 다음 줄 부근에 확장된 토글 함수와 confirm handler 추가:

```jsx
  const toggleExpandWithEdit = (o) => {
    if (expandedOrder === o.id) {
      setExpandedOrder(null);
      setConfirmEditMap({});
    } else {
      // 편집 가능 상태인 경우 input 초기값 채우기
      if (o.status === 'requested' || o.status === 'rerequested') {
        const em = {};
        for (const it of (o.items||[])) {
          em[it.id] = it.store_qty != null ? it.store_qty : it.hq_qty;
        }
        setConfirmEditMap(em);
      } else {
        setConfirmEditMap({});
      }
      setExpandedOrder(o.id);
    }
  };

  const handleConfirm = async (order) => {
    const items = order.items || [];
    if (items.length === 0) { toast('항목이 없습니다', 'err'); return; }
    if (!window.confirm(`발주를 확정하시겠습니까?\n\n총 ${items.length}개 상품, ${items.reduce((s,i) => s + (Number(confirmEditMap[i.id])||0), 0)}개 수량으로 확정됩니다.`)) return;
    setConfirming(true);
    try {
      // 각 item hq_qty 업데이트
      for (const it of items) {
        const newQty = Math.max(0, Number(confirmEditMap[it.id]) || 0);
        const { error } = await supabase.from('purchase_order_items')
          .update({ hq_qty: newQty })
          .eq('id', it.id);
        if (error) throw error;
      }
      // order status 'confirmed'로
      const { error: oErr } = await supabase.from('purchase_orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (oErr) throw oErr;
      toast('발주 확정 완료', 'ok');
      setExpandedOrder(null);
      setConfirmEditMap({});
      fetchOrders();
    } catch (err) {
      toast('확정 실패: ' + (err.message || err), 'err');
    }
    setConfirming(false);
  };
```

- [ ] **Step 5: 발주현황 펼침 영역 표시 모드 분기**

기존 펼침 영역 items 표(현재 약 611-665행)를 status에 따라 편집/읽기전용으로 분기.

기존 본문(약 619-662행)을 다음으로 교체. 외부 `{open && (`로 감싸는 `<tr><td colSpan={8}>` 구조는 유지하고 내부만 변경:

```jsx
                      {open && (
                        <tr>
                          <td colSpan={8} style={{background:'#fff', padding:'12px 18px', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)'}}>
                            {o.store_note && (
                              <div style={{padding:'8px 12px', background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:4, fontSize:12, marginBottom:10}}>
                                💬 매장 메모: {o.store_note}
                              </div>
                            )}
                            {(() => {
                              const editable = o.status === 'requested' || o.status === 'rerequested';
                              return (
                              <>
                              <div className="twrap">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>상품명</th><th>코드</th>
                                      <th className="r">판매수량</th>
                                      <th className="r">본사 발주</th>
                                      <th className="r">매장 요청</th>
                                      <th className="r">변동</th>
                                      {editable
                                        ? <th className="r" style={{color:'var(--accent)'}}>확정 수량</th>
                                        : <th className="r">입고확인</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(o.items||[]).map(it => {
                                      const diff = it.store_qty != null ? (it.store_qty - it.hq_qty) : 0;
                                      return (
                                      <tr key={it.id}>
                                        <td>{it.product?.name||'-'}</td>
                                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.product?.code||'-'}</td>
                                        <td className="r" style={{color:'var(--text3)'}}>{it.sold_qty}</td>
                                        <td className="r" style={{fontFamily:'var(--mono)'}}>{it.hq_qty}</td>
                                        <td className="r" style={{fontFamily:'var(--mono)', fontWeight: it.store_qty != null ? 700 : 400, color: it.store_qty != null ? 'var(--accent)' : 'var(--text3)'}}>
                                          {it.store_qty != null ? it.store_qty : '-'}
                                        </td>
                                        <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text3)'}}>
                                          {diff > 0 ? `+${diff}` : diff < 0 ? diff : '-'}
                                        </td>
                                        <td className="r" style={{fontFamily:'var(--mono)'}}>
                                          {editable ? (
                                            <input type="number" min={0}
                                              value={confirmEditMap[it.id] != null ? confirmEditMap[it.id] : ''}
                                              onChange={e => {
                                                const v = Math.max(0, Number(e.target.value)||0);
                                                setConfirmEditMap(prev => ({...prev, [it.id]: v}));
                                              }}
                                              style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right', fontWeight:700, color:'var(--accent)'}}/>
                                          ) : (
                                            it.received_qty != null
                                              ? <span style={{color: it.received_ok ? 'var(--success)' : 'var(--danger)', fontWeight:700}}>
                                                  {it.received_qty} {it.received_ok ? '✅' : '❌'}
                                                </span>
                                              : '-'
                                          )}
                                        </td>
                                      </tr>
                                    )})}
                                  </tbody>
                                </table>
                              </div>
                              <div style={{marginTop:8, fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)', textAlign:'right'}}>
                                본사 발주 합계: {(o.items||[]).reduce((s,i)=>s+i.hq_qty,0)}개 ·
                                매장 요청 합계: {(o.items||[]).reduce((s,i)=>s+(i.store_qty != null ? i.store_qty : i.hq_qty),0)}개
                              </div>
                              {editable && (
                                <div style={{marginTop:10, display:'flex', justifyContent:'flex-end', gap:8}}>
                                  <button className="btn btn-p" onClick={() => handleConfirm(o)} disabled={confirming}
                                    style={{padding:'0 20px', height:36, fontSize:13, fontWeight:700}}>
                                    {confirming ? <span className="spinner"/> : `✓ 확정 (${(o.items||[]).reduce((s,i) => s + (Number(confirmEditMap[i.id])||0), 0)}개)`}
                                  </button>
                                </div>
                              )}
                              </>
                            );})()}
                          </td>
                        </tr>
                      )}
```

- [ ] **Step 6: 행 클릭의 onClick을 toggleExpandWithEdit로 교체**

행 클릭부(현재 약 590-591행).

기존:
```jsx
                      <tr style={{cursor:'pointer', background: open ? '#f8f9fa' : 'transparent'}}
                        onClick={() => setExpandedOrder(open ? null : o.id)}>
```

다음으로:
```jsx
                      <tr style={{cursor:'pointer', background: open ? '#f8f9fa' : 'transparent'}}
                        onClick={() => toggleExpandWithEdit(o)}>
```

- [ ] **Step 7: 빌드 확인**

PowerShell:
```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 8: Commit**

```
git add src/pages/order/PurchaseOrderHQPage.jsx
git commit -m "feat(order): 본사 발주현황에 확정 단계 추가 + 엑셀 필터 변경"
```

---

## Task 2: Mgr 측 - STATUS_LABEL 확장 + 탭 필터 변경 + 입고확인 시 store_stock 반영

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

- [ ] **Step 1: STATUS_LABEL에 'confirmed' 추가**

`STATUS_LABEL` 정의(현재 약 5-10행).

기존:
```jsx
const STATUS_LABEL = {
  sent:        { label:'본사 발송',    color:'#1565C0', bg:'#e3f2fd', border:'#90caf9' },
  requested:   { label:'발주요청 완료', color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  rerequested: { label:'재요청 보냄',   color:'#bf360c', bg:'#fbe9e7', border:'#ffab91' },
  received:    { label:'입고 완료',    color:'#6a1b9a', bg:'#f3e5f5', border:'#ce93d8' },
};
```

다음으로 변경:
```jsx
const STATUS_LABEL = {
  sent:        { label:'본사 발송',    color:'#1565C0', bg:'#e3f2fd', border:'#90caf9' },
  requested:   { label:'발주요청 완료', color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  rerequested: { label:'재요청 보냄',   color:'#bf360c', bg:'#fbe9e7', border:'#ffab91' },
  confirmed:   { label:'본사 확정',     color:'#bf360c', bg:'#fff3e0', border:'#ffcc80' },
  received:    { label:'입고 완료',    color:'#6a1b9a', bg:'#f3e5f5', border:'#ce93d8' },
};
```

- [ ] **Step 2: 탭별 fetch 필터 변경**

`fetchOrders` 함수(현재 약 22-36행) 내 filterStatuses.

기존(약 24-26행):
```jsx
    const filterStatuses = tab === 'check'
      ? ['sent','requested','rerequested']
      : ['requested','rerequested','received'];
```

다음으로 변경:
```jsx
    const filterStatuses = tab === 'check'
      ? ['sent']
      : ['confirmed','received'];
```

- [ ] **Step 3: handleReceive에 store_stock 자동 반영 추가**

`handleReceive` 함수(현재 약 104-129행) 내 itemUpdates와 orders update 사이에 store_stock 반영 로직 삽입.

기존:
```jsx
    setSaving(true);
    try {
      const itemUpdates = (order.items||[]).map(it => {
        const r = recvMap[it.id] || { qty: 0, ok: true };
        return supabase.from('purchase_order_items').update({
          received_qty: Number(r.qty)||0,
          received_ok:  !!r.ok,
        }).eq('id', it.id);
      });
      await Promise.all(itemUpdates);
      const { error } = await supabase.from('purchase_orders').update({
        status: 'received',
        received_at: new Date().toISOString(),
        ...
```

itemUpdates `Promise.all` 다음, status update 전에 다음을 삽입:

```jsx
      await Promise.all(itemUpdates);

      // 매장재고 +received_qty 반영 (판매입력의 차감 로직의 거울)
      for (const it of (order.items||[])) {
        const r = recvMap[it.id] || { qty: 0 };
        const recv = Number(r.qty) || 0;
        if (recv <= 0 || !it.product?.code) continue;
        const { data: stockRow } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name',  profile.department)
          .eq('branch_name', profile.branch)
          .eq('product_code', it.product.code)
          .maybeSingle();
        if (stockRow) {
          await supabase.from('store_stock').update({
            stock_qty: (stockRow.stock_qty || 0) + recv,
            updated_at: new Date().toISOString(),
          }).eq('id', stockRow.id);
        }
      }

      const { error } = await supabase.from('purchase_orders').update({
        status: 'received',
        received_at: new Date().toISOString(),
        ...
```

`...` 부분은 기존 update body 그대로 둠. 다음으로 이어지는 try/catch도 그대로.

- [ ] **Step 4: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 5: 수동 검증** — controller가 dev server에서 수행. implementer는 빌드만.

검증 절차(controller):
1. 본사 발주진행 → 매장에 새 발주(`sent`) 보냄
2. 매장 발주확인 → check 탭에서 sent만 보임 (이전 requested/rerequested는 안 보임) → 그대로요청 또는 재요청 → 상태 `requested`/`rerequested`
3. 매장 → check 탭에서 더 이상 안 보임 (응답한 발주는 본사 확정 대기 상태)
4. 본사 발주현황 → 해당 발주 펼침 → input으로 수량 수정 가능 → `✓ 확정` 클릭 → status='confirmed' + items.hq_qty 업데이트
5. 본사 발주현황 → 엑셀 다운로드 → confirmed인 발주만 묶임
6. 매장 발주확인 → receive 탭 → confirmed 발주 표시됨 → 입고 수량 입력 → 입고 확인 클릭 → status='received' + store_stock 자동 +received_qty
7. 매장재고 페이지 또는 SQL로 store_stock 값이 정확히 증가했는지 확인

- [ ] **Step 6: Commit**

```
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "feat(order): 매장 발주확인 탭 필터 변경 + 입고 시 store_stock 자동 반영"
```

---

## Self-Review Checklist (작업자 본인 확인)

플랜 작성 후 자체 검토.

**1. Spec coverage:**
- 3 신규 status 'confirmed' → Task 1 Step 1 + Task 2 Step 1.
- 4.1 발주현황 펼침 영역 편집/읽기전용 분기 → Task 1 Step 5.
- 4.1 확정 버튼 → Task 1 Step 4·5.
- 4.2 status 배지 → Task 1 Step 1.
- 4.3 엑셀 다운로드 필터 변경 → Task 1 Step 2·3.
- 4.4 Mgr 페이지 탭 필터 변경 → Task 2 Step 2.
- 4.4 Mgr STATUS_LABEL → Task 2 Step 1.
- 4.5 입고확인 시 store_stock 반영 → Task 2 Step 3.
- 5 데이터 처리 표 (items.hq_qty 업데이트, status 전환) → Task 1 Step 4 (hq_qty update + status='confirmed').
- 6 회귀 영향 — 기존 requested/rerequested 상태는 다음 단계에서 자연 해소.

**2. Placeholder scan:**
- "TBD"/"적절히" 등 없음.
- 모든 step에 실제 코드/명령 포함.

**3. Type consistency:**
- `confirmEditMap`: { itemId: qty } shape — Task 1에서 정의·사용 일관.
- `toggleExpandWithEdit(order)` 시그니처 — Task 1 Step 4 정의, Step 6에서 호출.
- `handleConfirm(order)` 시그니처 — Task 1 Step 4 정의, Step 5에서 호출.
- STATUS_LABEL의 'confirmed' key + label/color/bg/border 4개 속성 — 양쪽 페이지에서 동일 구조.
- store_stock 컬럼명(store_name, branch_name, product_code, stock_qty, updated_at) — SalesInputPage 차감 로직과 일치.
