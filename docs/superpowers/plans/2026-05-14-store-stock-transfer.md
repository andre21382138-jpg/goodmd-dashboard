# 매장 간 재고이동 (점간이동) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본사가 매장재고 페이지에서 다른 매장의 재고를 클릭 한 번으로 대상 매장으로 이동시킬 수 있게 한다. 출처 매장 재고는 즉시 차감, 대상 매장은 발주확인 페이지의 신규 "재고이동 입고" 탭에서 입고확인. 매장의 새 재고요청은 본사 알림센터에 표시되어 처리 진입점이 됨.

**Architecture:** 신규 `store_transfers` 테이블이 모든 점간이동 audit trail을 담는다. 본사 `StoreStockPage`에 [재고이동] 버튼 + 모달을 추가하여 즉시 출처 매장 차감 + transfer row insert + 매칭되는 `order_requests`를 fulfilled로 자동 갱신. 매장 `PurchaseOrderMgrPage`에 세 번째 탭 `transfer` 추가하여 도착 대기/완료 표시. `NotificationCenter`의 `canHQ` 블록에 pending `order_requests` 카운트 알림 추가.

**Tech Stack:** React 18, Supabase JS. 별도 테스트 프레임워크 없음 — 각 task는 `npm run build` 통과 + UI 검토로 검증.

**Spec:** [docs/superpowers/specs/2026-05-14-store-stock-transfer-design.md](../specs/2026-05-14-store-stock-transfer-design.md)

---

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/pages/stock/StoreStockPage.jsx` | [재고이동] 버튼 + 모달 + handler | Modify |
| `src/pages/order/PurchaseOrderMgrPage.jsx` | "재고이동 입고" 탭 + 핸들러 | Modify |
| `src/pages/stock/StockRequestPage.jsx` | status 표시에 `fulfilled` 추가 | Modify |
| `src/components/NotificationCenter.jsx` | 본사 알림에 새 재고요청 통합 | Modify |

---

## Prerequisites (사용자가 Supabase SQL Editor에서 직접 실행)

```sql
-- 신규 테이블 store_transfers
CREATE TABLE store_transfers (
  id bigserial PRIMARY KEY,
  from_store_name text NOT NULL,
  from_branch_name text NOT NULL,
  to_store_name text NOT NULL,
  to_branch_name text NOT NULL,
  product_id bigint NOT NULL REFERENCES products(id),
  quantity int NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'dispatched',
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

-- 검증
SELECT COUNT(*) FROM store_transfers;
```

---

## Task 1: StoreStockPage — [재고이동] 버튼 + 모달

**Files:**
- Modify: `src/pages/stock/StoreStockPage.jsx`

본사용 매장재고 행의 수정 컬럼에 [재고이동] 버튼 추가. 클릭 시 모달 열림. 확정 시 출처 재고 차감 + store_transfers insert + 매칭되는 order_requests fulfilled.

- [ ] **Step 1: state 추가**

기존 state hooks 묶음(약 5~15행) 마지막에 추가:

```jsx
  const [transferModal, setTransferModal] = useState(null); // 선택된 stock 행
  const [transferTo, setTransferTo] = useState('');         // "store_name|branch_name"
  const [transferQty, setTransferQty] = useState(1);
  const [transferMemo, setTransferMemo] = useState('');
  const [transferProcessing, setTransferProcessing] = useState(false);
  const [allBranches, setAllBranches] = useState([]); // [{store_name, branch_name}]
```

- [ ] **Step 2: 모든 매장×지점 fetch effect 추가**

기존 useEffect 묶음 끝(약 30행 fetchStocks useEffect 직후)에 추가:

```jsx
  // 점간이동 대상 매장 목록 fetch
  useEffect(() => {
    if (isManager) return; // 매니저는 점간이동 안 함
    supabase.from('store_stock').select('store_name, branch_name').then(({data}) => {
      const seen = new Set();
      const list = [];
      for (const r of (data||[])) {
        const k = `${r.store_name}|${r.branch_name}`;
        if (!seen.has(k) && r.store_name && r.branch_name) {
          seen.add(k);
          list.push({ store_name: r.store_name, branch_name: r.branch_name });
        }
      }
      list.sort((a,b) => a.store_name.localeCompare(b.store_name) || a.branch_name.localeCompare(b.branch_name));
      setAllBranches(list);
    });
  }, [isManager]);
```

- [ ] **Step 3: 모달 열기/닫기 + confirm 핸들러 추가**

`saveEdit` 함수 직후(약 70행)에 추가:

```jsx
  const openTransfer = (s) => {
    setTransferModal(s);
    setTransferTo('');
    setTransferQty(1);
    setTransferMemo('');
  };
  const closeTransfer = () => {
    setTransferModal(null);
    setTransferTo('');
    setTransferQty(1);
    setTransferMemo('');
  };
  const confirmTransfer = async () => {
    if (!transferModal) return;
    if (!transferTo) { toast('대상 매장을 선택해주세요', 'err'); return; }
    const qty = Number(transferQty) || 0;
    if (qty <= 0) { toast('수량을 입력해주세요', 'err'); return; }
    if (qty > (transferModal.stock_qty||0)) { toast('현재 재고를 초과합니다', 'err'); return; }
    const [toStore, toBranch] = transferTo.split('|');
    if (toStore === transferModal.store_name && toBranch === transferModal.branch_name) {
      toast('동일 매장으로 이동할 수 없습니다', 'err'); return;
    }
    setTransferProcessing(true);
    try {
      // 1) 출처 재고 차감
      const newQty = (transferModal.stock_qty||0) - qty;
      const { error: stockErr } = await supabase.from('store_stock')
        .update({ stock_qty: newQty, updated_at: new Date().toISOString() })
        .eq('id', transferModal.id);
      if (stockErr) throw stockErr;

      // 2) store_transfers insert
      const { error: txErr } = await supabase.from('store_transfers').insert({
        from_store_name: transferModal.store_name,
        from_branch_name: transferModal.branch_name,
        to_store_name: toStore,
        to_branch_name: toBranch,
        product_id: transferModal.product_id,
        quantity: qty,
        status: 'dispatched',
        dispatched_by: profile.id,
        memo: transferMemo.trim() || null,
      });
      if (txErr) throw txErr;

      // 3) 매칭되는 pending order_requests fulfilled
      await supabase.from('order_requests')
        .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
        .eq('store_name', toStore)
        .eq('branch_name', toBranch)
        .eq('product_id', transferModal.product_id)
        .eq('status', 'pending');

      toast(`${toStore} ${toBranch}으로 ${qty}개 이동 완료`, 'ok');
      closeTransfer();
      fetchStocks();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setTransferProcessing(false);
    }
  };
```

- [ ] **Step 4: 표 수정 셀에 [재고이동] 버튼 추가**

기존 (약 134~150행):

```jsx
                      {!isManager && (
                        <td style={{textAlign:'center'}}>
                          {isEditing ? (
                            <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                              <button className="btn btn-p" style={{height:26,padding:'0 10px',fontSize:11}}
                                disabled={saving[s.id]} onClick={()=>saveEdit(s.id)}>
                                {saving[s.id]?<span className="spinner"/>:'저장'}
                              </button>
                              <button className="btn btn-s" style={{height:26,padding:'0 8px',fontSize:11}}
                                onClick={()=>cancelEdit(s.id)}>취소</button>
                            </div>
                          ) : (
                            <button className="btn btn-s" style={{height:26,padding:'0 10px',fontSize:11}}
                              onClick={()=>startEdit(s.id, s.stock_qty||0)}>수정</button>
                          )}
                        </td>
                      )}
```

다음으로 변경 (편집모드가 아닐 때 [재고이동] 추가):

```jsx
                      {!isManager && (
                        <td style={{textAlign:'center'}}>
                          {isEditing ? (
                            <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                              <button className="btn btn-p" style={{height:26,padding:'0 10px',fontSize:11}}
                                disabled={saving[s.id]} onClick={()=>saveEdit(s.id)}>
                                {saving[s.id]?<span className="spinner"/>:'저장'}
                              </button>
                              <button className="btn btn-s" style={{height:26,padding:'0 8px',fontSize:11}}
                                onClick={()=>cancelEdit(s.id)}>취소</button>
                            </div>
                          ) : (
                            <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                              <button className="btn btn-s" style={{height:26,padding:'0 10px',fontSize:11}}
                                onClick={()=>startEdit(s.id, s.stock_qty||0)}>수정</button>
                              <button type="button"
                                onClick={() => openTransfer(s)}
                                disabled={(s.stock_qty||0) <= 0}
                                style={{height:26, padding:'0 10px', fontSize:11, fontWeight:700,
                                  border:'1px solid #1565C0', borderRadius:'var(--radius)',
                                  background:(s.stock_qty||0) <= 0 ? '#fafafa' : '#e3f2fd',
                                  color:(s.stock_qty||0) <= 0 ? 'var(--text3)' : '#1565C0',
                                  cursor:(s.stock_qty||0) <= 0 ? 'not-allowed' : 'pointer'}}>
                                🔁 재고이동
                              </button>
                            </div>
                          )}
                        </td>
                      )}
```

수정 컬럼 너비도 키워야 — 약 107행 `<th style={{width:120, textAlign:'center'}}>수정</th>` 을 `width:180`으로 변경:

기존:
```jsx
                  {!isManager && <th style={{width:120, textAlign:'center'}}>수정</th>}
```

변경:
```jsx
                  {!isManager && <th style={{width:180, textAlign:'center'}}>수정/이동</th>}
```

- [ ] **Step 5: 모달 JSX 추가**

페이지 최상위 컴포넌트 return의 맨 아래(닫는 `</div>` 직전)에 모달 추가. 구체적 위치는 컴포넌트의 최상위 `return ( <div>` 안 맨 마지막에 추가.

```jsx
      {/* 재고이동 모달 */}
      {transferModal && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={closeTransfer}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:12, width:'min(480px, 92vw)', padding:'22px 24px', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>
              🔁 재고이동
            </div>
            <div style={{fontSize:12, color:'var(--text2)', marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border)'}}>
              <span className="badge badge-dept">{transferModal.store_name}</span>{' '}
              <span className="badge badge-store">{transferModal.branch_name}</span>
              <div style={{marginTop:6, fontSize:13, color:'var(--text)'}}>
                <strong>{transferModal.product_name}</strong>
                <span style={{marginLeft:8, color:'var(--text3)'}}>(현재 재고: {transferModal.stock_qty||0}개)</span>
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:4}}>대상 매장 *</label>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value)}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'#fff'}}>
                <option value="">매장 선택</option>
                {allBranches
                  .filter(b => !(b.store_name === transferModal.store_name && b.branch_name === transferModal.branch_name))
                  .map(b => (
                    <option key={`${b.store_name}|${b.branch_name}`} value={`${b.store_name}|${b.branch_name}`}>
                      {b.store_name} {b.branch_name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:4}}>이동 수량 *</label>
              <input type="number" min={1} max={transferModal.stock_qty||0} value={transferQty}
                onChange={e => setTransferQty(e.target.value)}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13}}/>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:4}}>메모</label>
              <input value={transferMemo} onChange={e => setTransferMemo(e.target.value)}
                placeholder="선택"
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13}}/>
            </div>

            <div style={{padding:'10px 12px', background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:6, fontSize:12, color:'#e65100', marginBottom:14}}>
              ⚠️ 확인 즉시 <strong>{transferModal.store_name} {transferModal.branch_name}</strong> 재고가 차감됩니다. C매장 매니저에게 별도 연락하여 출고 안내가 필요합니다.
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button type="button" onClick={closeTransfer}
                style={{height:38, padding:'0 18px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'}}>
                취소
              </button>
              <button type="button" onClick={confirmTransfer} disabled={transferProcessing}
                style={{height:38, padding:'0 18px', border:'none', borderRadius:'var(--radius)', background:'#1565C0', color:'#fff', fontSize:13, fontWeight:700, cursor:transferProcessing?'not-allowed':'pointer', opacity:transferProcessing?0.6:1}}>
                {transferProcessing ? '처리 중...' : '재고이동 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled, no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/stock/StoreStockPage.jsx
git commit -m "$(cat <<'EOF'
feat(stock): 본사 매장재고에 [재고이동] 버튼 + 모달

수정 셀에 🔁 재고이동 버튼 추가 (재고 0이면 비활성).
모달: 대상 매장 + 수량 + 메모 입력 후 확정 시
- 출처 매장 store_stock 즉시 차감
- store_transfers (status='dispatched') insert
- 매칭되는 order_requests를 'fulfilled'로 자동 갱신

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: PurchaseOrderMgrPage — "재고이동 입고" 탭

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

기존 tab `'check' | 'receive'`에 `'transfer'` 추가. 도착 대기/완료 재고이동 표시 + 입고확인 처리.

- [ ] **Step 1: 신규 state 추가**

기존 state 묶음(약 14~31행) 끝에 추가:

```jsx
  // 재고이동 입고 탭
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [receivedTransfers, setReceivedTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
```

- [ ] **Step 2: fetch 함수 추가**

`fetchOrders` 함수(약 33행) 직후에 추가:

```jsx
  const fetchTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    // 도착 대기 (status='dispatched')
    const { data: pend } = await supabase.from('store_transfers')
      .select('*, product:products(name, code)')
      .eq('to_store_name', profile.department)
      .eq('to_branch_name', profile.branch)
      .eq('status', 'dispatched')
      .order('dispatched_at', { ascending: false });
    setPendingTransfers(pend || []);
    // 최근 입고완료 (status='received', 최근 20건)
    const { data: rcv } = await supabase.from('store_transfers')
      .select('*, product:products(name, code)')
      .eq('to_store_name', profile.department)
      .eq('to_branch_name', profile.branch)
      .eq('status', 'received')
      .order('received_at', { ascending: false })
      .limit(20);
    setReceivedTransfers(rcv || []);
    setLoadingTransfers(false);
  }, [profile.department, profile.branch]);

  useEffect(() => { if (tab === 'transfer') fetchTransfers(); }, [tab, fetchTransfers]);
```

- [ ] **Step 3: 입고확인 핸들러 추가**

`handleReceive` 함수(약 105행) 직후에 추가:

```jsx
  const handleReceiveTransfer = async (transfer) => {
    if (!window.confirm(`${transfer.product?.name || '상품'} ${transfer.quantity}개 입고확인하시겠습니까?`)) return;
    setSaving(true);
    try {
      // 1) 우리 매장 재고 가산
      const { data: stockRow } = await supabase.from('store_stock')
        .select('id, stock_qty')
        .eq('store_name', profile.department)
        .eq('branch_name', profile.branch)
        .eq('product_id', transfer.product_id)
        .maybeSingle();

      if (stockRow) {
        const { error } = await supabase.from('store_stock').update({
          stock_qty: (stockRow.stock_qty || 0) + transfer.quantity,
          updated_at: new Date().toISOString(),
        }).eq('id', stockRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_stock').insert({
          store_name: profile.department,
          branch_name: profile.branch,
          product_id: transfer.product_id,
          product_name: transfer.product?.name || null,
          product_code: transfer.product?.code || null,
          stock_qty: transfer.quantity,
        });
        if (error) throw error;
      }

      // 2) store_transfers status 업데이트
      const { error: tErr } = await supabase.from('store_transfers').update({
        status: 'received',
        received_at: new Date().toISOString(),
        received_by: profile.id,
        updated_at: new Date().toISOString(),
      }).eq('id', transfer.id);
      if (tErr) throw tErr;

      toast(`입고확인 완료 (재고 +${transfer.quantity})`, 'ok');
      fetchTransfers();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 4: 탭 버튼 추가**

기존 `<div className="tabs">` 블록(약 156~158행 부근)을 찾아 변경.

기존:
```jsx
      <div className="tabs">
        <button className={`tab ${tab==='check'?'on':''}`} onClick={() => { setTab('check'); setExpanded(null); setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null); }}>발주 확인</button>
        <button className={`tab ${tab==='receive'?'on':''}`} onClick={() => { setTab('receive'); setExpanded(null); setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null); }}>입고 확인</button>
      </div>
```

다음으로 변경:
```jsx
      <div className="tabs">
        <button className={`tab ${tab==='check'?'on':''}`} onClick={() => { setTab('check'); setExpanded(null); setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null); }}>발주 확인</button>
        <button className={`tab ${tab==='receive'?'on':''}`} onClick={() => { setTab('receive'); setExpanded(null); setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null); }}>입고 확인</button>
        <button className={`tab ${tab==='transfer'?'on':''}`} onClick={() => { setTab('transfer'); setExpanded(null); }}>재고이동 입고</button>
      </div>
```

- [ ] **Step 5: 재고이동 탭 본문 JSX 추가**

기존 카드(`<div className="card" style={{padding:'16px 20px'}}>` ... `</div>`) 블록 안에서 마지막 `}` 직전(즉 카드 내부의 마지막 element 다음)에 `tab === 'transfer'` 분기 추가하거나, 카드 바깥에 추가. 자연스럽게는 기존 카드 다음에 `tab === 'transfer'`일 때만 새 카드 표시:

페이지 최상위 return의 마지막 `</div>` 직전에 추가 (기존 카드 다음, 즉 기존 카드들과 같은 레벨):

```jsx
      {tab === 'transfer' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, fontFamily:'var(--mono)' }}>
            📍 {profile.department} · {profile.branch}
          </div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
            <span className="fresult">다른 매장에서 도착한 재고이동</span>
            <button className="btn btn-s" onClick={fetchTransfers} disabled={loadingTransfers}>
              {loadingTransfers ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>

          {/* 도착 대기 */}
          <div style={{fontSize:13, fontWeight:700, marginBottom:10}}>📥 입고 대기 ({pendingTransfers.length}건)</div>
          {loadingTransfers ? <div className="empty"><span className="spinner"/></div>
            : pendingTransfers.length === 0 ? <div className="empty">도착 대기 중인 재고이동이 없습니다</div>
            : (
            <div className="twrap" style={{marginBottom:20}}>
              <table>
                <thead>
                  <tr>
                    <th>출고일</th><th>출고 매장</th><th>상품</th>
                    <th className="r">수량</th><th>메모</th>
                    <th style={{textAlign:'center', width:120}}>입고확인</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTransfers.map(t => (
                    <tr key={t.id}>
                      <td className="mono" style={{fontSize:11}}>{new Date(t.dispatched_at).toLocaleDateString('ko-KR')}</td>
                      <td><span className="badge badge-dept">{t.from_store_name}</span> <span className="badge badge-store">{t.from_branch_name}</span></td>
                      <td>{t.product?.name || '-'}</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{t.quantity}개</td>
                      <td style={{fontSize:11, color:'var(--text3)'}}>{t.memo || '-'}</td>
                      <td style={{textAlign:'center'}}>
                        <button className="btn btn-p" onClick={() => handleReceiveTransfer(t)} disabled={saving}
                          style={{height:30, padding:'0 14px', fontSize:12, fontWeight:700}}>
                          ✓ 입고확인
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 최근 입고완료 */}
          <div style={{fontSize:13, fontWeight:700, marginBottom:10, marginTop:14}}>✅ 최근 입고완료 (최근 20건)</div>
          {receivedTransfers.length === 0 ? <div className="empty">입고완료 이력이 없습니다</div>
            : (
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>입고일</th><th>출고 매장</th><th>상품</th>
                    <th className="r">수량</th><th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedTransfers.map(t => (
                    <tr key={t.id}>
                      <td className="mono" style={{fontSize:11}}>{t.received_at ? new Date(t.received_at).toLocaleDateString('ko-KR') : '-'}</td>
                      <td><span className="badge badge-dept">{t.from_store_name}</span> <span className="badge badge-store">{t.from_branch_name}</span></td>
                      <td>{t.product?.name || '-'}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{t.quantity}개</td>
                      <td style={{fontSize:11, color:'var(--text3)'}}>{t.memo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
```

이 JSX는 기존 카드 div의 닫는 `</div>` **직후**, 페이지 컴포넌트 return의 마지막 `</div>` 바로 앞에 위치. 또한 기존 카드 자체에는 `{tab !== 'transfer' && ... }` 조건을 추가하지 않아도 됨 (탭별 내용은 카드 안에서 이미 분기됨). 단, 사용자가 transfer 탭을 누르면 위/아래에 두 카드가 모두 보이지 않도록 기존 카드를 `{tab !== 'transfer' && (...)}` 또는 그 안의 내용을 적절히 처리. 안전하게: 기존 카드 전체를 다음과 같이 감싼다:

```jsx
      {tab !== 'transfer' && (
        <div className="card" style={{padding:'16px 20px'}}>
          {/* 기존 내용 그대로 */}
        </div>
      )}
```

즉, 기존 카드 시작 `<div className="card" style={{padding:'16px 20px'}}>`를 `{tab !== 'transfer' && (<div className="card" style={{padding:'16px 20px'}}>` 로 변경하고, 닫는 `</div>` 뒤에 `)}` 추가.

- [ ] **Step 6: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled, no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/mgr): 발주확인 페이지에 '재고이동 입고' 탭 추가

기존 발주 확인 / 입고 확인 탭에 transfer 탭 추가.
- 도착 대기 (status='dispatched') 목록 + 입고확인 버튼
- 입고확인 시: store_stock += 수량, store_transfers status='received'
- 최근 입고완료 20건 표시

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: StockRequestPage — status에 fulfilled 추가

**Files:**
- Modify: `src/pages/stock/StockRequestPage.jsx`

기존 status 표시(`approved` / `rejected` / 기본)에 `fulfilled` 추가.

- [ ] **Step 1: status 셀 변경**

기존 (약 175~181행):

```jsx
                      <td>
                        <span style={{
                          padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                          background: r.status==='approved'?'#e8f5e9':r.status==='rejected'?'#ffebee':'#fff3e0',
                          color: r.status==='approved'?'var(--success)':r.status==='rejected'?'var(--danger)':'#E65100',
                        }}>
                          {r.status==='approved'?'승인':r.status==='rejected'?'반려':'대기'}
                        </span>
                      </td>
```

다음으로 변경:

```jsx
                      <td>
                        <span style={{
                          padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                          background:
                            r.status==='approved' ? '#e8f5e9'
                            : r.status==='fulfilled' ? '#e8f5e9'
                            : r.status==='rejected' ? '#ffebee'
                            : '#fff3e0',
                          color:
                            r.status==='approved' ? 'var(--success)'
                            : r.status==='fulfilled' ? 'var(--success)'
                            : r.status==='rejected' ? 'var(--danger)'
                            : '#E65100',
                        }}>
                          {r.status==='approved' ? '승인'
                           : r.status==='fulfilled' ? '✅ 완료'
                           : r.status==='rejected' ? '반려'
                           : '대기'}
                        </span>
                      </td>
```

- [ ] **Step 2: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -3`
Expected: Compiled, no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/stock/StockRequestPage.jsx
git commit -m "$(cat <<'EOF'
feat(stock): 재고요청 status에 'fulfilled' (✅완료) 추가

점간이동으로 처리된 요청은 자동으로 fulfilled 상태가 되며
매장 직원이 요청 이력에서 ✅ 완료로 확인 가능.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: NotificationCenter — 본사용 새 재고요청 알림 추가

**Files:**
- Modify: `src/components/NotificationCenter.jsx`

기존 `canHQ` 블록(약 85~122행)에 새 재고요청 알림 항목 추가. 알림 클릭 시 매장재고(stock_store) 페이지로 이동.

- [ ] **Step 1: order_requests fetch + 알림 항목 추가**

기존 `canHQ` 블록 내부, "매장 발주요청" fetch 직전에 다음 코드 추가:

```jsx
    if (canHQ) {
      // 매장 새 재고요청
      const { data: stockReq } = await supabase.from('order_requests')
        .select('id, store_name, branch_name, product:products(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (stockReq?.length > 0) {
        const sampleNames = stockReq.slice(0, 3).map(r => `${r.store_name} ${r.branch_name}`).join(', ');
        list.push({
          key: `stock_request_pending`, color:'blue', icon:'📋',
          title:`새 재고요청 ${stockReq.length}건`,
          msg: stockReq.length <= 3 ? sampleNames : `${sampleNames} 외 ${stockReq.length - 3}건`,
          page:'stock_store',
        });
      }
      // 매장 발주요청
      const { data: req } = await supabase.from('purchase_orders')
        ...
```

즉, 기존 `if (canHQ) {` 블록의 첫 번째 항목으로 위 stockReq fetch + push를 삽입한다. 기존 `// 매장 발주요청` 주석 라인 위에 위치.

- [ ] **Step 2: Realtime 구독에 order_requests 추가**

기존 (약 132~140행):

```jsx
    const channel = supabase
      .channel('notif-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_plans' }, () => {
        buildNotifs();
      })
      .subscribe();
```

다음으로 변경 (order_requests 추가):

```jsx
    const channel = supabase
      .channel('notif-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_plans' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, () => {
        buildNotifs();
      })
      .subscribe();
```

- [ ] **Step 3: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -3`
Expected: Compiled, no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationCenter.jsx
git commit -m "$(cat <<'EOF'
feat(notif): 본사 알림에 매장 새 재고요청 통합

order_requests status='pending' 카운트를 본사 알림센터에 표시.
클릭 시 stock_store(매장재고) 페이지로 이동하여 [재고이동] 처리 가능.
Realtime 구독에 order_requests 추가.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 통합 빌드 + 푸시

- [ ] **Step 1: 최종 빌드**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -10`
Expected: Compiled with warnings (기존만), 새 에러 없음.

- [ ] **Step 2: 푸시**

Run: `git push origin main`
Expected: 푸시 성공, Vercel 자동 배포.

- [ ] **Step 3: 수동 점검 항목**

```
☐ Supabase SQL Editor에서 store_transfers 테이블 생성 SQL 실행
☐ 매장 A에서 재고요청 → 본사 알림센터에 '새 재고요청 1건' 표시 확인
☐ 본사 매장재고 페이지 — 수정 컬럼이 '수정/이동'으로 변경, 각 행에 [🔁 재고이동] 버튼
☐ 재고 0인 행은 [재고이동] 버튼이 비활성(흐림)
☐ 다른 매장(C매장) [재고이동] 클릭 → 모달
   ☐ 대상 매장 드롭다운에 자기 매장 제외된 목록
   ☐ 수량 입력, 메모 선택
   ☐ 확정 클릭 → 토스트 + 모달 닫힘 + 재고 -1
☐ 매장 A → 발주확인 페이지 → '재고이동 입고' 탭 노출
   ☐ 도착 대기 1건 표시
   ☐ [입고확인] 클릭 → confirm → 재고 +1
   ☐ 최근 입고완료에 1건 추가
☐ 매장 A → 재고요청 페이지 → 이력에 '✅ 완료' 표시
☐ 본사 알림센터 — 새 재고요청 알림 카운트 줄어듦 (또는 사라짐)
```

---

## Self-Review

### Spec coverage

| Spec 섹션 | 대응 Task |
|---|---|
| §2.1 A매장 재고요청 흐름 | (기존 흐름, Task 3에서 status 표시만 추가) |
| §2.2 본사 점간이동 처리 | Task 1, Task 4 (알림 진입점) |
| §2.3 A매장 입고확인 | Task 2 |
| §2.4 C매장 결과 확인 | (자동 차감 — Task 1 처리에 포함) |
| §3.1 store_transfers 테이블 | Prerequisites |
| §3.2 order_requests fulfilled | Task 1 (update) + Task 3 (표시) |
| §4.1 [재고이동] 버튼 | Task 1 |
| §4.2 모달 | Task 1 |
| §4.3 confirmTransfer | Task 1 |
| §5.1 PurchaseOrderMgrPage 탭 | Task 2 |
| §5.2 입고 본문 | Task 2 |
| §5.3 handleReceiveTransfer | Task 2 |
| §5.4 StockRequestPage status 표시 | Task 3 |
| §6 NotificationCenter | Task 4 |
| §7 회귀 영향 | 각 task에서 기존 동작 보존 |
| §8 비목표 | 구현 안 함 |

### Placeholder scan

- "TBD", "implement later", "fill in details" — 없음.
- Task 2 Step 5에 "기존 카드를 tab !== 'transfer'로 감싸기" — 행동 지침은 명확. 구현자가 정확한 위치 식별 가능.

### Type consistency

- `store_transfers` 컬럼 — Task 1 insert와 Task 2 select에서 일관 사용
- `status` 값: `'dispatched'` / `'received'` — Task 1, 2 모두 동일
- `order_requests.status` 값: `'pending'` / `'fulfilled'` — Task 1 (update) 과 Task 3 (표시), Task 4 (알림 카운트) 모두 동일
- 알림 key prefix `stock_request_pending` — Task 4 단독, 다른 곳과 충돌 없음
- `allBranches` state 형태: `[{store_name, branch_name}]` — Task 1 내부 일관
- 매장 dropdown source: `store_stock` distinct (`store_addresses` / STORE_MAP 대신 — 실제 재고 보유 매장만 보이도록)
