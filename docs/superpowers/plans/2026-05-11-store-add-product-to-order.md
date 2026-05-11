# 매장 발주확인 시 상품 추가 요청 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매장이 본사가 보낸 발주(`status='sent'`) 펼침 영역에서 시스템의 임의 상품을 검색해 수량과 함께 추가하고, 그대로요청/재요청 시 같은 발주에 새 라인으로 insert되도록 함.

**Architecture:** `PurchaseOrderMgrPage`에 product 검색 상태와 addedItems 배열을 추가. 펼침 영역 표 끝에 인라인 검색 input + 수량 + `+ 추가` 버튼 행을 둠. 추가된 라인은 같은 표에 노란 배경 + `🆕 매장추가` 배지로 렌더. 요청 핸들러(`handleRequestAsIs` / `handleRerequest`)에서 기존 update와 함께 addedItems를 `purchase_order_items`에 insert. 식별 규칙: `hq_qty=0 AND store_qty>0`. 본사 `PurchaseOrderHQPage` 발주현황 펼침 표에서도 동일 규칙으로 `🆕 매장 추가` 배지를 표시.

**Tech Stack:** React 18, Supabase JS, 기존 CRA 빌드 시스템. 별도 테스트 프레임워크 없음 — 각 task는 `npm run build` 통과 + 코드 검토로 검증.

**Spec:** [docs/superpowers/specs/2026-05-11-store-add-product-to-order-design.md](../specs/2026-05-11-store-add-product-to-order-design.md)

---

## File Structure

| 파일 | 역할 | 변경 종류 |
|---|---|---|
| `src/pages/order/PurchaseOrderMgrPage.jsx` | 매장 발주확인 페이지 — addedItems 상태, 검색 UI, "+ 추가" 행, 응답 핸들러 변경 | Modify |
| `src/pages/order/PurchaseOrderHQPage.jsx` | 본사 발주현황 — 펼침 표에 `🆕 매장 추가` 배지 추가 | Modify |

테스트 파일 / 새 파일 없음. 모든 변경은 두 파일에 국한.

---

## Task 1: 매장 페이지에 addedItems / 검색 state 추가

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

State를 늘리는 것만으로는 UI 변화 없음. 다음 task에서 사용될 hooks 준비.

- [ ] **Step 1: 새 state hook 추가**

`src/pages/order/PurchaseOrderMgrPage.jsx`의 기존 state 묶음(약 14~21행):

```jsx
const [tab, setTab] = useState('check');
const [orders,    setOrders]    = useState([]);
const [loading,   setLoading]   = useState(false);
const [expanded,  setExpanded]  = useState(null);
const [editMap,   setEditMap]   = useState({});
const [memoMap,   setMemoMap]   = useState({});
const [recvMap,   setRecvMap]   = useState({});
const [saving,    setSaving]    = useState(false);
```

다음으로 변경:

```jsx
const [tab, setTab] = useState('check');
const [orders,    setOrders]    = useState([]);
const [loading,   setLoading]   = useState(false);
const [expanded,  setExpanded]  = useState(null);
const [editMap,   setEditMap]   = useState({});
const [memoMap,   setMemoMap]   = useState({});
const [recvMap,   setRecvMap]   = useState({});
const [saving,    setSaving]    = useState(false);
// 매장이 펼침 영역에서 추가한 상품들 (펼침 닫으면 초기화)
// [{ tempId, product_id, name, code, qty }]
const [addedItems, setAddedItems] = useState([]);
// 상품 검색 UI 상태
const [searchQ,        setSearchQ]        = useState('');
const [searchResults,  setSearchResults]  = useState([]);
const [searchOpen,     setSearchOpen]     = useState(false);
const [searchLoading,  setSearchLoading]  = useState(false);
const [addQty,         setAddQty]         = useState('');
const [selProduct,     setSelProduct]     = useState(null);
```

- [ ] **Step 2: toggleExpand에서 새 state 초기화 추가**

기존 `toggleExpand` 함수 (약 41~56행):

```jsx
const toggleExpand = (o) => {
  if (expanded === o.id) {
    setExpanded(null); setEditMap({}); setMemoMap({}); setRecvMap({});
  } else {
    const em = {};
    const rm = {};
    for (const it of (o.items||[])) {
      em[it.id] = it.store_qty != null ? it.store_qty : it.hq_qty;
      rm[it.id] = { qty: it.received_qty != null ? it.received_qty : (it.store_qty != null ? it.store_qty : it.hq_qty), ok: it.received_ok != null ? it.received_ok : true };
    }
    setEditMap(em);
    setRecvMap(rm);
    setMemoMap({ [o.id]: o.store_note || '' });
    setExpanded(o.id);
  }
};
```

다음으로 변경:

```jsx
const toggleExpand = (o) => {
  if (expanded === o.id) {
    setExpanded(null); setEditMap({}); setMemoMap({}); setRecvMap({});
    setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null);
  } else {
    const em = {};
    const rm = {};
    for (const it of (o.items||[])) {
      em[it.id] = it.store_qty != null ? it.store_qty : it.hq_qty;
      rm[it.id] = { qty: it.received_qty != null ? it.received_qty : (it.store_qty != null ? it.store_qty : it.hq_qty), ok: it.received_ok != null ? it.received_ok : true };
    }
    setEditMap(em);
    setRecvMap(rm);
    setMemoMap({ [o.id]: o.store_note || '' });
    setExpanded(o.id);
    setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null);
  }
};
```

- [ ] **Step 3: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -8`
Expected: `Compiled with warnings.` 또는 `Compiled successfully.` (이전과 동일한 워닝만, 새 에러 없음)

- [ ] **Step 4: Commit**

```bash
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/mgr): 매장 추가상품을 위한 state 추가

addedItems, search UI 상태(searchQ/Results/Open/Loading, addQty, selProduct)를
도입하고 펼침 토글 시 초기화. UI 영향 없음.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 상품 검색 함수 + debounce

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

`searchQ` 변경 시 supabase products 테이블 검색하는 effect.

- [ ] **Step 1: 검색 effect 추가**

`useEffect(() => { fetchOrders(); }, [fetchOrders]);` 라인 (약 39행) 바로 다음에 새 effect 추가:

```jsx
// 상품 검색 (debounce 300ms)
useEffect(() => {
  const q = (searchQ || '').trim();
  if (q.length < 2) { setSearchResults([]); setSearchLoading(false); return; }
  setSearchLoading(true);
  const timer = setTimeout(async () => {
    const { data } = await supabase.from('products')
      .select('id, name, code')
      .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
      .limit(10);
    setSearchResults(data || []);
    setSearchLoading(false);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQ]);
```

- [ ] **Step 2: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -8`
Expected: 빌드 성공, 새 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/mgr): 상품 검색 effect 추가

searchQ 2글자 이상 입력 시 300ms debounce 후 products 테이블에서
name/code ilike 검색하여 상위 10개 표시.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: addedItems 추가/삭제 핸들러

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

상품 선택 + 수량 입력 후 addedItems에 push하는 함수, 삭제 함수.

- [ ] **Step 1: 핸들러 함수 추가**

`const toggleExpand = ...` 함수 위 (또는 같은 위치 그룹)에 다음 함수들 추가. `handleRequestAsIs` 함수 정의 바로 앞 (약 58행, "그대로 발주요청" 주석 직전)에 삽입:

```jsx
// 매장이 입력행에서 상품 + 수량 골라 "+ 추가" 누름
const handleAddItem = (order) => {
  if (!selProduct) { toast('상품을 선택하세요', 'err'); return; }
  const qty = Number(addQty) || 0;
  if (qty <= 0) { toast('수량을 입력하세요', 'err'); return; }
  // 중복 검사: 기존 본사 라인 + 이미 추가된 라인
  const inOrder = (order.items||[]).some(it => it.product_id === selProduct.id);
  const inAdded = addedItems.some(a => a.product_id === selProduct.id);
  if (inOrder || inAdded) { toast('이미 발주 목록에 있는 상품입니다', 'err'); return; }
  setAddedItems(prev => [...prev, {
    tempId: `tmp_${Date.now()}_${prev.length}`,
    product_id: selProduct.id,
    name: selProduct.name,
    code: selProduct.code,
    qty,
  }]);
  // 입력 리셋
  setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null);
};

const handleRemoveAddedItem = (tempId) => {
  setAddedItems(prev => prev.filter(a => a.tempId !== tempId));
};

const handleAddedQtyChange = (tempId, qty) => {
  setAddedItems(prev => prev.map(a => a.tempId === tempId ? { ...a, qty: Math.max(0, Number(qty)||0) } : a));
};
```

- [ ] **Step 2: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -8`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/mgr): 매장 추가상품 add/remove/qty 핸들러

handleAddItem(중복 검사 포함), handleRemoveAddedItem, handleAddedQtyChange.
state만 조작하고 DB는 응답 시점에 일괄 처리.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: addedItems 표시 row + "+ 상품 추가" 입력행 UI

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

펼침 영역 발주확인 표의 `tbody` 끝에 매장추가 라인들 + 입력행을 그림. status='sent'일 때만.

- [ ] **Step 1: tbody 마지막 매장추가 라인 + 입력행 렌더링 추가**

기존 발주확인 표의 `tbody` (약 227~256행):

```jsx
<tbody>
  {(o.items||[]).map(it => {
    const editing = o.status === 'sent';
    const cur = editing ? (editMap[it.id] != null ? editMap[it.id] : it.hq_qty) : (it.store_qty != null ? it.store_qty : it.hq_qty);
    const diff = Number(cur) - it.hq_qty;
    return (
    <tr key={it.id}>
      <td>{it.product?.name || '-'}</td>
      <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.product?.code || '-'}</td>
      <td className="r" style={{color:'var(--text3)'}}>{it.sold_qty}</td>
      <td className="r" style={{fontFamily:'var(--mono)'}}>{it.hq_qty}</td>
      <td className="r">
        {editing
          ? <>
              <input type="number" min={0}
                value={editMap[it.id] != null ? editMap[it.id] : it.hq_qty}
                onChange={e => setEditMap(prev => ({...prev, [it.id]: Math.max(0, Number(e.target.value)||0)}))}
                style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right', fontWeight:700}}/>
              {diff !== 0 && (
                <div style={{fontSize:10, marginTop:2, color: diff > 0 ? 'var(--success)' : 'var(--danger)', fontWeight:700}}>
                  {diff > 0 ? `+${diff}` : diff}
                </div>
              )}
            </>
          : <span style={{fontFamily:'var(--mono)', fontWeight:700}}>{cur}</span>
        }
      </td>
    </tr>
  )})}
  </tbody>
```

다음으로 변경 (`</tbody>` 직전에 매장추가 라인들과 입력행 추가):

```jsx
<tbody>
  {(o.items||[]).map(it => {
    const editing = o.status === 'sent';
    const cur = editing ? (editMap[it.id] != null ? editMap[it.id] : it.hq_qty) : (it.store_qty != null ? it.store_qty : it.hq_qty);
    const diff = Number(cur) - it.hq_qty;
    return (
    <tr key={it.id}>
      <td>{it.product?.name || '-'}</td>
      <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.product?.code || '-'}</td>
      <td className="r" style={{color:'var(--text3)'}}>{it.sold_qty}</td>
      <td className="r" style={{fontFamily:'var(--mono)'}}>{it.hq_qty}</td>
      <td className="r">
        {editing
          ? <>
              <input type="number" min={0}
                value={editMap[it.id] != null ? editMap[it.id] : it.hq_qty}
                onChange={e => setEditMap(prev => ({...prev, [it.id]: Math.max(0, Number(e.target.value)||0)}))}
                style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right', fontWeight:700}}/>
              {diff !== 0 && (
                <div style={{fontSize:10, marginTop:2, color: diff > 0 ? 'var(--success)' : 'var(--danger)', fontWeight:700}}>
                  {diff > 0 ? `+${diff}` : diff}
                </div>
              )}
            </>
          : <span style={{fontFamily:'var(--mono)', fontWeight:700}}>{cur}</span>
        }
      </td>
    </tr>
  )})}
  {/* 매장이 추가한 상품들 (state, 아직 DB 저장 전) */}
  {o.status === 'sent' && addedItems.map(a => (
    <tr key={a.tempId} style={{background:'#fffde7'}}>
      <td>
        {a.name}
        <span style={{marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px',
          background:'#fff3e0', color:'#bf360c', border:'1px solid #ffcc80', borderRadius:3}}>
          🆕 매장추가
        </span>
      </td>
      <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{a.code || '-'}</td>
      <td className="r" style={{color:'var(--text3)'}}>-</td>
      <td className="r" style={{color:'var(--text3)'}}>-</td>
      <td className="r">
        <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}>
          <input type="number" min={0} value={a.qty}
            onChange={e => handleAddedQtyChange(a.tempId, e.target.value)}
            style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right', fontWeight:700}}/>
          <button onClick={() => handleRemoveAddedItem(a.tempId)}
            title="삭제"
            style={{height:30, width:30, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor:'pointer', fontSize:14, color:'var(--text3)'}}>
            ✕
          </button>
        </div>
      </td>
    </tr>
  ))}
  {/* 입력행: 검색 + 수량 + + 추가 (sent 상태일 때만) */}
  {o.status === 'sent' && (
    <tr style={{background:'#fafafa'}}>
      <td colSpan={4} style={{padding:'10px 8px'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, position:'relative'}}>
          <span style={{fontSize:12, fontWeight:700, color:'var(--text2)'}}>+ 상품 추가</span>
          <div style={{flex:1, position:'relative'}}>
            <input type="text"
              value={searchQ}
              placeholder="상품명 또는 코드 검색 (2글자 이상)"
              onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); setSelProduct(null); }}
              onFocus={() => setSearchOpen(true)}
              style={{width:'100%', height:30, padding:'0 10px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, boxSizing:'border-box'}}/>
            {searchOpen && searchQ.trim().length >= 2 && (
              <div style={{position:'absolute', top:32, left:0, right:0, zIndex:10,
                background:'#fff', border:'1px solid var(--border)', borderRadius:4,
                maxHeight:200, overflowY:'auto', boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
                {searchLoading ? (
                  <div style={{padding:'8px 12px', fontSize:11, color:'var(--text3)'}}>검색 중...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{padding:'8px 12px', fontSize:11, color:'var(--text3)'}}>검색 결과 없음</div>
                ) : searchResults.map(p => {
                  const dup = (o.items||[]).some(it => it.product_id === p.id) || addedItems.some(a => a.product_id === p.id);
                  return (
                    <button key={p.id} type="button"
                      disabled={dup}
                      onClick={() => { setSelProduct(p); setSearchQ(`${p.name} (${p.code||'-'})`); setSearchOpen(false); }}
                      style={{display:'block', width:'100%', textAlign:'left', padding:'6px 12px',
                        border:'none', background: dup ? '#f5f5f5' : '#fff',
                        color: dup ? 'var(--text3)' : 'var(--text)',
                        cursor: dup ? 'not-allowed' : 'pointer', fontSize:12,
                        borderBottom:'1px solid var(--border)'}}>
                      {p.name}
                      <span style={{marginLeft:8, fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)'}}>{p.code || '-'}</span>
                      {dup && <span style={{marginLeft:8, fontSize:10, color:'var(--danger)'}}>이미 있음</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="r">
        <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}>
          <input type="number" min={1} value={addQty}
            placeholder="수량"
            onChange={e => setAddQty(e.target.value)}
            style={{width:60, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, textAlign:'right'}}/>
          <button type="button"
            disabled={!selProduct || !(Number(addQty)>0)}
            onClick={() => handleAddItem(o)}
            style={{height:30, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:4,
              background: (selProduct && Number(addQty)>0) ? 'var(--accent)' : '#fff',
              color: (selProduct && Number(addQty)>0) ? '#fff' : 'var(--text3)',
              fontSize:11, fontWeight:700,
              cursor: (selProduct && Number(addQty)>0) ? 'pointer' : 'not-allowed'}}>
            + 추가
          </button>
        </div>
      </td>
    </tr>
  )}
</tbody>
```

- [ ] **Step 2: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -8`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/mgr): 매장 발주확인 표에 추가상품 라인 + 입력행 UI

- 매장이 추가한 라인은 노란 배경(#fffde7) + 🆕매장추가 배지 + ✕ 삭제 버튼
- 표 마지막에 "+ 상품 추가" 입력행: 검색 input + 드롭다운 + 수량 + + 추가 버튼
- 중복 상품(본사라인 + 추가라인)은 드롭다운에서 회색 + "이미 있음"
- status='sent' 발주에서만 노출

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: handleRequestAsIs에 addedItems insert 추가

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

"그대로 발주요청" 시 기존 라인 update + addedItems insert.

- [ ] **Step 1: handleRequestAsIs 수정**

기존 함수 (약 58~78행):

```jsx
const handleRequestAsIs = async (order) => {
  if (!window.confirm('본사 발주 수량 그대로 발주요청 하시겠습니까?')) return;
  setSaving(true);
  try {
    const itemUpdates = (order.items||[]).map(it =>
      supabase.from('purchase_order_items').update({ store_qty: it.hq_qty }).eq('id', it.id)
    );
    await Promise.all(itemUpdates);
    const { error } = await supabase.from('purchase_orders').update({
      status: 'requested',
      store_note: memoMap[order.id] || null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (error) throw error;
    toast('발주요청 완료', 'ok');
    setExpanded(null); setEditMap({}); setMemoMap({});
    fetchOrders();
  } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
  setSaving(false);
};
```

다음으로 변경:

```jsx
const handleRequestAsIs = async (order) => {
  const addedCount = addedItems.length;
  const msg = addedCount > 0
    ? `본사 발주 수량 그대로 + 매장 추가 ${addedCount}개 상품을 발주요청 하시겠습니까?`
    : '본사 발주 수량 그대로 발주요청 하시겠습니까?';
  if (!window.confirm(msg)) return;
  setSaving(true);
  try {
    const itemUpdates = (order.items||[]).map(it =>
      supabase.from('purchase_order_items').update({ store_qty: it.hq_qty }).eq('id', it.id)
    );
    const itemInserts = addedItems
      .filter(a => Number(a.qty) > 0)
      .map(a => supabase.from('purchase_order_items').insert({
        purchase_order_id: order.id,
        product_id: a.product_id,
        sold_qty: 0,
        hq_qty: 0,
        store_qty: Number(a.qty) || 0,
      }));
    await Promise.all([...itemUpdates, ...itemInserts]);
    const { error } = await supabase.from('purchase_orders').update({
      status: 'requested',
      store_note: memoMap[order.id] || null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (error) throw error;
    toast('발주요청 완료', 'ok');
    setExpanded(null); setEditMap({}); setMemoMap({}); setAddedItems([]);
    fetchOrders();
  } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
  setSaving(false);
};
```

- [ ] **Step 2: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -8`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/mgr): 그대로요청 시 addedItems도 insert

기존 라인 store_qty=hq_qty update와 함께 매장추가 라인을
hq_qty=0, store_qty=입력값으로 새 row insert.
confirm 메시지에 추가 상품 개수 표시.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: handleRerequest에 addedItems insert 추가

**Files:**
- Modify: `src/pages/order/PurchaseOrderMgrPage.jsx`

"수정 후 재요청"도 같은 패턴.

- [ ] **Step 1: handleRerequest 수정**

기존 함수 (약 81~102행):

```jsx
const handleRerequest = async (order) => {
  if (!window.confirm('수정한 수량으로 재요청 하시겠습니까?\n\n본사가 매장에 직접 연락하여 수량을 확정합니다.')) return;
  setSaving(true);
  try {
    const itemUpdates = (order.items||[]).map(it => {
      const newQty = Number(editMap[it.id]) || 0;
      return supabase.from('purchase_order_items').update({ store_qty: newQty }).eq('id', it.id);
    });
    await Promise.all(itemUpdates);
    const { error } = await supabase.from('purchase_orders').update({
      status: 'rerequested',
      store_note: memoMap[order.id] || null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (error) throw error;
    toast('재요청 보냄', 'ok');
    setExpanded(null); setEditMap({}); setMemoMap({});
    fetchOrders();
  } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
  setSaving(false);
};
```

다음으로 변경:

```jsx
const handleRerequest = async (order) => {
  const addedCount = addedItems.length;
  const msg = addedCount > 0
    ? `수정한 수량 + 매장 추가 ${addedCount}개 상품을 재요청 하시겠습니까?\n\n본사 확정 후 진행됩니다.`
    : '수정한 수량으로 재요청 하시겠습니까?\n\n본사 확정 후 진행됩니다.';
  if (!window.confirm(msg)) return;
  setSaving(true);
  try {
    const itemUpdates = (order.items||[]).map(it => {
      const newQty = Number(editMap[it.id]) || 0;
      return supabase.from('purchase_order_items').update({ store_qty: newQty }).eq('id', it.id);
    });
    const itemInserts = addedItems
      .filter(a => Number(a.qty) > 0)
      .map(a => supabase.from('purchase_order_items').insert({
        purchase_order_id: order.id,
        product_id: a.product_id,
        sold_qty: 0,
        hq_qty: 0,
        store_qty: Number(a.qty) || 0,
      }));
    await Promise.all([...itemUpdates, ...itemInserts]);
    const { error } = await supabase.from('purchase_orders').update({
      status: 'rerequested',
      store_note: memoMap[order.id] || null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (error) throw error;
    toast('재요청 보냄', 'ok');
    setExpanded(null); setEditMap({}); setMemoMap({}); setAddedItems([]);
    fetchOrders();
  } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
  setSaving(false);
};
```

- [ ] **Step 2: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -8`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add src/pages/order/PurchaseOrderMgrPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/mgr): 재요청 시 addedItems도 insert

editMap 기반 store_qty update와 함께 매장추가 라인 insert.
기존 그대로요청과 동일한 패턴 적용.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 본사 발주현황 펼침 표에 🆕 매장 추가 배지

**Files:**
- Modify: `src/pages/order/PurchaseOrderHQPage.jsx`

본사가 매장 응답을 볼 때 `hq_qty=0 AND store_qty>0`인 라인을 배지로 식별.

- [ ] **Step 1: 매장추가 배지 렌더링 추가**

`src/pages/order/PurchaseOrderHQPage.jsx`에서 발주현황 펼침 표의 상품명 td를 찾아 (`it.product?.name || '-'`만 렌더하는 위치) 다음 패턴으로 변경.

찾을 코드 (발주현황 펼침 표 내부 tbody — 정확한 라인은 파일 내 검색):

```jsx
<td>{it.product?.name || '-'}</td>
```

가 발주현황 펼침 표 안의 상품명 컬럼임. 이걸 다음과 같이 변경:

```jsx
<td>
  {it.product?.name || '-'}
  {((it.hq_qty || 0) === 0 && (it.store_qty || 0) > 0) && (
    <span style={{marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px',
      background:'#fff3e0', color:'#bf360c', border:'1px solid #ffcc80', borderRadius:3}}>
      🆕 매장 추가
    </span>
  )}
</td>
```

**주의:** PurchaseOrderHQPage에는 발주진행 표와 발주현황 표가 둘 다 있다. 변경 대상은 **발주현황** 펼침 영역의 표(`o.status === 'requested' || rerequested || confirmed || received`인 발주를 펼쳤을 때 나오는 표). 발주진행 탭 표는 변경 금지.

식별 방법: 펼침 표 thead에 `매장 요청` 또는 `입고확인` 컬럼이 있는 표가 발주현황 표. 발주진행 표는 thead에 `본사 발주` 입력 컬럼이 있음.

- [ ] **Step 2: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -8`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add src/pages/order/PurchaseOrderHQPage.jsx
git commit -m "$(cat <<'EOF'
feat(order/hq): 발주현황 펼침 표에 🆕 매장 추가 배지

hq_qty=0 AND store_qty>0인 라인은 매장이 발주확인 단계에서 추가한
상품으로 식별, 상품명 옆에 주황 배지로 표시. 본사 확정 단계에서
수량 input으로 정상 편집 가능 (0으로 두면 사실상 거부).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 통합 빌드 + 푸시

**Files:** 없음 (verification + push)

- [ ] **Step 1: 통합 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -15`
Expected: `Compiled with warnings.` 메시지 + 기존과 동일한 워닝들. 새 에러 없음. main.*.js 사이즈가 약간 증가(~1-2KB).

- [ ] **Step 2: 매뉴얼 점검 항목 정리 (수동 확인용)**

이 항목들은 사용자가 브라우저에서 직접 확인할 내용. plan 실행자는 항목을 콘솔에 출력만 하면 됨.

```
매장 계정 로그인 → 재고관리 → 발주 확인:
[ ] sent 발주 펼치면 표 마지막에 "+ 상품 추가" 입력행이 보임
[ ] 검색창에 2글자 입력하면 300ms 후 드롭다운
[ ] 본사가 보낸 상품을 검색하면 "이미 있음" 회색 표시
[ ] 새 상품 + 수량 입력 후 + 추가 → 노란 배경 라인이 표에 추가
[ ] ✕ 버튼으로 추가 라인 삭제
[ ] 펼침 닫으면 입력 모두 사라짐
[ ] 그대로 발주요청 / 수정 후 재요청 → confirm 메시지에 추가 개수 표시
[ ] 요청 후 발주현황 페이지에서 본사가 동일 발주를 펼치면 매장추가 라인이 🆕 매장 추가 배지로 식별됨
[ ] 본사가 hq_qty 수량을 0보다 큰 값으로 설정 + 확정하면 배지 사라짐
[ ] 본사가 그대로 0으로 둬도 확정 가능, 엑셀에는 hq_qty>0인 라인만 출력됨
```

- [ ] **Step 3: 푸시 (원격에 배포)**

Run: `git push origin main`
Expected: `main -> main` 푸시 성공. Vercel 자동 배포 트리거.

---

## 자체검토 결과 (Self-Review)

**Spec coverage 확인:**

| Spec 섹션 | 대응 Task |
|---|---|
| §1 배경 | (배경 — 코드 변경 없음) |
| §2 사용자 흐름 1~7 (매장) | Task 1~6 |
| §2 사용자 흐름 8 (본사) | Task 7 |
| §3 데이터 모델 — 식별 규칙 | Task 4 매장 추가 라인 식별, Task 7 본사 식별 |
| §3 state 관리 — addedItems | Task 1 (state), Task 3 (핸들러), Task 5/6 (insert) |
| §3 insert 컬럼 명세 | Task 5/6 insert payload |
| §4.1 UI — 검색 + 입력행 | Task 4 |
| §4.2 응답 처리 | Task 5/6 |
| §4.3 본사 배지 | Task 7 |
| §5 회귀 영향 | Task 8 매뉴얼 점검 |
| §6 검색 쿼리 | Task 2 |
| §7 비목표 | (구현 대상 아님) |

**Placeholder scan:** 없음. 모든 step에 실제 코드 / 명령 / 기대 결과.

**Type / 이름 일관성:**
- `addedItems` (배열), `searchQ`/`searchResults`/`searchOpen`/`searchLoading`, `addQty`, `selProduct` — Task 1~6 일관 사용
- `handleAddItem`/`handleRemoveAddedItem`/`handleAddedQtyChange` — Task 3 정의, Task 4/5/6 호출
- 식별 규칙 `hq_qty=0 AND store_qty>0` — Task 5/6 insert와 Task 7 표시에서 일치
- temp id 형식 `tmp_${Date.now()}_${i}` — Task 3 발급, Task 4 key/삭제에서 일치
