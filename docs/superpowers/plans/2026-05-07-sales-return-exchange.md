# 반품 교환 통합 처리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매니저 반품접수 페이지를 "반품 교환" 페이지로 확장. 라인별로 반품/교환 모드를 선택할 수 있고, 교환 라인은 새 상품 선택 + 차액 결제 + 회원 적립금/등급/재고 자동 조정을 한 번에 처리한다.

**Architecture:** sales 테이블에 `exchange_from_sale_id` 컬럼을 추가해 교환 결과 매출을 추적. SalesReturnPage state를 `returnMap` (qty) → `lineMap` (mode + qty + 교환 필드) 구조로 확장. 매장매출 외부 양식 다운로드의 mapType이 새 컬럼을 보고 `정상(교환)` 분기.

**Tech Stack:** React 18, Supabase JS, 인라인 스타일, 기존 helpers (`toast`, `getGrade`).

**Spec:** `docs/superpowers/specs/2026-05-07-sales-return-exchange-design.md`

**Test 전략:** 본 프로젝트에는 컴포넌트 테스트 인프라가 없으므로 각 작업은 `npm run build` + dev server 수동 검증으로 마무리한다.

---

## File Structure

- DB: `sales` 테이블에 `exchange_from_sale_id` 컬럼 + 인덱스 추가 (Supabase 콘솔에서 SQL 직접 실행).
- Modify: `src/lib/constants.js` — MANAGER_MENUS의 `반품 접수` → `반품 교환` 라벨.
- Modify: `src/pages/sales/SalesListPage.jsx` — `exportSalesRaw`의 select 컬럼 추가 + `mapType` 분기 변경.
- Modify: `src/pages/sales/SalesReturnPage.jsx` — 모드 라디오 + 교환 확장 UI + `handleReturn` 교환 처리 로직 + 미리보기/버튼 라벨.

새 파일 생성 없음.

---

## Task 1: DB 스키마 + 매장매출 다운로드 매핑 변경

**Files:**
- DB: `sales` (Supabase 콘솔에서 SQL 실행)
- Modify: `src/pages/sales/SalesListPage.jsx`

스키마와 의존 쿼리를 먼저 갖춰 후속 작업의 토대를 만든다.

- [ ] **Step 1: Supabase에 SQL 실행 (controller 확인 필요)**

다음 SQL을 Supabase 콘솔(SQL Editor)에서 실행:

```sql
ALTER TABLE sales
  ADD COLUMN exchange_from_sale_id BIGINT
  REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_exchange_from ON sales(exchange_from_sale_id);
```

실행 후 Table Editor에서 `sales` 테이블에 `exchange_from_sale_id` (bigint, nullable) 컬럼이 보이는지 확인.

이 단계는 implementer subagent가 직접 실행할 수 없음. controller가 user에게 SQL 실행을 요청한 뒤 완료 응답을 받고 다음 step 진행.

- [ ] **Step 2: SalesListPage의 exportSalesRaw select에 exchange_from_sale_id 추가**

`src/pages/sales/SalesListPage.jsx`의 `exportSalesRaw` 함수 내 select 호출(현재 약 12행 부근)을 변경.

기존:
```jsx
.select('id, sold_at, store_name, branch_name, payment, quantity, returned_qty, price, brand:brands(name), product:products(code, name, cost)')
```

다음으로:
```jsx
.select('id, sold_at, store_name, branch_name, payment, quantity, returned_qty, price, exchange_from_sale_id, brand:brands(name), product:products(code, name, cost)')
```

- [ ] **Step 3: mapType 함수 변경 (인자: payment → sales row 전체)**

같은 파일의 `mapType` 정의(현재 약 38-42행).

기존:
```jsx
const mapType = (p) => {
  if (p === '증정') return '증정';
  if (p === '시식') return '샘플';
  return '정상'; // 카드/현금/적립금사용/기타
};
```

다음으로 변경:
```jsx
const mapType = (s) => {
  if (s.exchange_from_sale_id) return '정상(교환)';
  if (s.payment === '증정')    return '증정';
  if (s.payment === '시식')    return '샘플';
  return '정상'; // 카드/현금/적립금사용/기타
};
```

- [ ] **Step 4: mapType 호출 부분 변경**

같은 파일의 데이터 행 생성부에서 mapType을 호출하는 곳(현재 약 86행).

기존:
```jsx
mapType(s.payment),
```

다음으로 변경:
```jsx
mapType(s),
```

- [ ] **Step 5: 빌드 확인**

PowerShell:
```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공. 새 unused 등 경고 없음.

- [ ] **Step 6: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): exchange_from_sale_id 컬럼 + 매장매출 다운로드 정상(교환) 매핑"
```

---

## Task 2: 메뉴 라벨 변경

**Files:**
- Modify: `src/lib/constants.js`

매니저 메뉴 라벨만 변경. key·아이콘·페이지 라우팅은 그대로.

- [ ] **Step 1: constants.js 라벨 변경**

`src/lib/constants.js`의 `MANAGER_MENUS` 배열에서 `key: 'sales_return'` 항목(현재 60행 부근).

기존:
```jsx
{ key: 'sales_return',   icon: '↩️', label: '반품 접수' },
```

다음으로 변경:
```jsx
{ key: 'sales_return',   icon: '↩️', label: '반품 교환' },
```

- [ ] **Step 2: SalesReturnPage 내부 카드 라벨/탭 라벨 변경**

`src/pages/sales/SalesReturnPage.jsx`의 다음 텍스트들을 일괄 변경:

(a) 탭 버튼 텍스트(약 261행):
```jsx
<button className={`tab ${tab==='search'?'on':''}`} onClick={() => setTab('search')}>반품접수</button>
```
→ `반품 교환`으로:
```jsx
<button className={`tab ${tab==='search'?'on':''}`} onClick={() => setTab('search')}>반품 교환</button>
```

(b) 카드 라벨(약 268행):
```jsx
<div className="card-label">반품 접수</div>
```
→
```jsx
<div className="card-label">반품 교환</div>
```

직접입력 탭(`tab==='manual'`) 라벨과 카드 label은 그대로 유지(`직접입력` / `직접 입력 반품`).

- [ ] **Step 3: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 4: Commit**

```
git add src/lib/constants.js src/pages/sales/SalesReturnPage.jsx
git commit -m "feat(sales-return): 메뉴 라벨을 '반품 교환'으로 변경"
```

---

## Task 3: 모드 라디오 + lineMap state 확장 (스캐폴드)

**Files:**
- Modify: `src/pages/sales/SalesReturnPage.jsx`

`returnMap` 단순 객체를 `lineMap` 확장 객체로 마이그레이션. 모드 라디오 컬럼 추가. 교환 모드의 확장 영역은 placeholder만(다음 Task에서 실제 UI).

- [ ] **Step 1: returnMap state를 lineMap으로 변경**

기존(약 14행):
```jsx
const [returnMap, setReturnMap] = useState({});
```

다음으로:
```jsx
const [lineMap, setLineMap] = useState({}); // { [saleId]: { mode: 'return'|'exchange', qty, bProduct, bPrice, exchangePayment } }
```

- [ ] **Step 2: setReturnMap 호출 위치를 모두 lineMap 호환으로 변경**

`returnMap` 사용처:
- `toggleExpand` (약 82행): 행 펼칠 때 초기화.
- `setAllFull` / `setAllZero` (약 93·98행): 일괄 수량 변경.
- `expandedOrder` 미리보기 (약 106행).
- `handleReturn` 검증·처리 (약 121행).
- 입력란 onChange (약 397행).

각각을 다음 형태로 변경:

`toggleExpand` (약 82-91행):
```jsx
const toggleExpand = (order) => {
  if (expanded === order.key) {
    setExpanded(null); setLineMap({});
  } else {
    const map = {};
    for (const i of order.items) map[i.id] = { mode: 'return', qty: 0, bProduct: null, bPrice: '', exchangePayment: '카드' };
    setLineMap(map);
    setExpanded(order.key);
  }
};
```

`setAllFull` (약 93-97행):
```jsx
const setAllFull = (order) => {
  const map = { ...lineMap };
  for (const i of order.items) {
    map[i.id] = { ...(map[i.id] || { mode: 'return', bProduct: null, bPrice: '', exchangePayment: '카드' }), qty: i.quantity - (i.returned_qty||0) };
  }
  setLineMap(map);
};
```

`setAllZero` (약 98-102행):
```jsx
const setAllZero = (order) => {
  const map = { ...lineMap };
  for (const i of order.items) {
    map[i.id] = { ...(map[i.id] || { mode: 'return', bProduct: null, bPrice: '', exchangePayment: '카드' }), qty: 0 };
  }
  setLineMap(map);
};
```

- [ ] **Step 3: preview 계산을 lineMap 기준으로 수정**

기존(약 106-119행):
```jsx
const preview = useMemo(() => {
  if (!expandedOrder) return null;
  let cash = 0, pointsRestore = 0, pointsRevoke = 0, qtySum = 0;
  for (const it of expandedOrder.items) {
    const qty = Number(returnMap[it.id] || 0);
    if (qty <= 0) continue;
    const ratio = qty / it.quantity;
    cash += it.price * qty;
    pointsRestore += Math.floor((it.points_used||0) * ratio);
    pointsRevoke  += Math.floor((it.points_earned||0) * ratio);
    qtySum += qty;
  }
  return { cash, pointsRestore, pointsRevoke, qtySum };
}, [expandedOrder, returnMap]);
```

다음으로(반품 라인만 합산, 교환 합산은 Task 5에서 추가):
```jsx
const preview = useMemo(() => {
  if (!expandedOrder) return null;
  let cash = 0, pointsRestore = 0, pointsRevoke = 0, qtySum = 0;
  for (const it of expandedOrder.items) {
    const ln = lineMap[it.id];
    if (!ln) continue;
    const qty = Number(ln.qty || 0);
    if (qty <= 0) continue;
    if (ln.mode === 'return') {
      const ratio = qty / it.quantity;
      cash += it.price * qty;
      pointsRestore += Math.floor((it.points_used||0) * ratio);
      pointsRevoke  += Math.floor((it.points_earned||0) * ratio);
      qtySum += qty;
    }
  }
  return { cash, pointsRestore, pointsRevoke, qtySum };
}, [expandedOrder, lineMap]);
```

- [ ] **Step 4: handleReturn 검증과 처리 부분도 lineMap 기준으로 임시 변경 (반품만 처리)**

기존(약 121-190행)에서 `returnMap[i.id]` 참조를 `lineMap[i.id]?.qty`로 바꾸고, mode 체크 추가.

기존 시작부:
```jsx
const handleReturn = async () => {
  if (!expandedOrder) return;
  const toReturn = expandedOrder.items.filter(i => Number(returnMap[i.id] || 0) > 0);
```

다음으로:
```jsx
const handleReturn = async () => {
  if (!expandedOrder) return;
  const returnLines = expandedOrder.items.filter(i => {
    const ln = lineMap[i.id];
    return ln && ln.mode === 'return' && Number(ln.qty || 0) > 0;
  });
  // 교환 라인은 Task 5에서 처리 추가. 이 단계에서는 반품 라인만.
  const toReturn = returnLines;
```

이후 `Number(returnMap[it.id])` 등의 참조를 `Number(lineMap[it.id].qty)`로 변경. 검증 메시지/리셋도 동일 패턴.

리셋 부분(약 184행):
```jsx
setExpanded(null);
setReturnMap({});
```
→
```jsx
setExpanded(null);
setLineMap({});
```

- [ ] **Step 5: 모드 컬럼 + 라디오 버튼 UI 추가**

`o.items.map(it => ...)` 내부 `<tr>`에 첫 번째 컬럼으로 모드 라디오를 추가하고, 동일하게 `<thead>`에도 컬럼 추가.

`<thead>` 변경(약 360-373행):
```jsx
<thead>
  <tr>
    <th style={{width:80, textAlign:'center'}}>모드</th>
    <th>브랜드</th>
    <th>상품명 (코드)</th>
    <th className="r">판매수량</th>
    <th className="r">이미반품</th>
    <th className="r">잔여</th>
    <th className="r">단가</th>
    <th className="r">합계</th>
    <th className="r">적립금사용</th>
    <th>결제</th>
    <th style={{textAlign:'center', width:130}}>반품/교환 수량</th>
  </tr>
</thead>
```

`<tbody>` 행 시작부(약 376-405행). 각 `<tr>` 첫 번째 `<td>`로 라디오 셀 삽입:

```jsx
{o.items.map(it => {
  const remain = it.quantity - (it.returned_qty||0);
  const ln = lineMap[it.id] || { mode: 'return', qty: 0, bProduct: null, bPrice: '', exchangePayment: '카드' };
  return (
  <React.Fragment key={it.id}>
  <tr>
    <td style={{textAlign:'center'}}>
      <label style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, marginRight:6, cursor:'pointer'}}>
        <input type="radio" name={`mode-${it.id}`} checked={ln.mode === 'return'}
          onChange={() => setLineMap(prev => ({ ...prev, [it.id]: { ...(prev[it.id] || ln), mode: 'return' } }))}/>
        반품
      </label>
      <label style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, cursor:'pointer'}}>
        <input type="radio" name={`mode-${it.id}`} checked={ln.mode === 'exchange'}
          onChange={() => setLineMap(prev => ({ ...prev, [it.id]: { ...(prev[it.id] || ln), mode: 'exchange' } }))}/>
        교환
      </label>
    </td>
    <td>{it.brand?.name || '-'}</td>
    <td style={{fontSize:12}}>
      <strong>{it.product?.name || '-'}</strong>
      {it.product?.code && <span style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:6}}>{it.product.code}</span>}
    </td>
    <td className="r">{it.quantity}</td>
    <td className="r" style={{color:'var(--text3)'}}>{it.returned_qty||0}</td>
    <td className="r" style={{fontWeight:700}}>{remain}</td>
    <td className="r" style={{fontFamily:'var(--mono)'}}>{Number(it.price).toLocaleString()}원</td>
    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{(it.price * remain).toLocaleString()}원</td>
    <td className="r" style={{fontFamily:'var(--mono)', color:(it.points_used||0)>0?'var(--text2)':'var(--text3)'}}>
      {(it.points_used||0) > 0 ? `-${Number(it.points_used).toLocaleString()}` : '-'}
    </td>
    <td style={{fontSize:12, color:'var(--text2)'}}>{it.payment}</td>
    <td style={{textAlign:'center'}}>
      <input type="number" min={0} max={remain}
        value={ln.qty || 0}
        onChange={e => {
          const v = Math.max(0, Math.min(remain, Number(e.target.value)||0));
          setLineMap(prev => ({ ...prev, [it.id]: { ...(prev[it.id] || ln), qty: v } }));
        }}
        style={{width:70, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'center'}}/>
      <span style={{fontSize:11, color:'var(--text3)', marginLeft:4}}>/ {remain}</span>
    </td>
  </tr>
  {ln.mode === 'exchange' && ln.qty > 0 && (
    <tr>
      <td colSpan={11} style={{background:'#f3f7ff', borderBottom:'1px solid var(--border)', padding:'10px 16px', fontSize:12, color:'var(--text2)'}}>
        🔄 교환 상품 선택 (Task 4에서 구현 예정)
      </td>
    </tr>
  )}
  </React.Fragment>
)})}
```

기존 `<tr key={it.id}>`를 `<React.Fragment key={it.id}>` 로 감싸 두 행을 함께 렌더할 수 있게 함. 기존 `<tr>`에 `key`가 있었으므로 React import는 그대로 사용 가능.

- [ ] **Step 6: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 7: 수동 검증 (브라우저)**

검증 절차 (controller가 dev server 실행 후 수행):
1. 매니저 계정 로그인 → 사이드바 → ↩️ 반품 교환 진입.
2. 메뉴 라벨이 "반품 교환"으로 표시되는지(이미 Task 2에서 변경됨).
3. 날짜로 주문 조회 → 행 클릭으로 펼침.
4. 모드 컬럼이 첫 컬럼에 추가되어 각 라인에 ⚪반품 / ⚪교환 라디오가 보이는지 확인.
5. 기본값이 "반품"이고, 반품 수량 입력 → 미리보기 환불 금액/적립금 계산이 기존과 동일한지 확인.
6. 행 모드를 "교환"으로 바꾸면 placeholder "🔄 교환 상품 선택 (Task 4에서 구현 예정)" 행이 펼쳐지는지 확인.
7. "반품 처리" 버튼으로 반품 라인만 처리되는지 확인 (기존 동작 유지).
8. "전체 0" / "전체 반품" 버튼이 정상 동작하는지 확인.

- [ ] **Step 8: Commit**

```
git add src/pages/sales/SalesReturnPage.jsx
git commit -m "feat(sales-return): 라인별 반품/교환 모드 라디오 + lineMap state 확장 (스캐폴드)"
```

---

## Task 4: 교환 확장 영역 UI (B 상품 검색 + 차액 계산 + 결제 방법)

**Files:**
- Modify: `src/pages/sales/SalesReturnPage.jsx`

Task 3에서 placeholder로 둔 교환 확장 영역을 실제 UI로 교체. 처리 로직은 다음 Task에서.

- [ ] **Step 1: allProducts 데이터 prefetch 보장**

기존 직접입력 탭에서만 `allProducts`를 fetch함(현재 28-33행):

```jsx
useEffect(() => {
  if (tab === 'manual' && allProducts.length === 0) {
    supabase.from('products').select('id, name, code, brand_id, price').order('name')
      .then(({ data }) => setAllProducts(data || []));
  }
}, [tab, allProducts.length]);
```

교환 모드에서도 필요하므로 조건을 완화. 다음으로 변경:

```jsx
useEffect(() => {
  if (allProducts.length === 0) {
    supabase.from('products').select('id, name, code, brand_id, price').order('name')
      .then(({ data }) => setAllProducts(data || []));
  }
}, [allProducts.length]);
```

- [ ] **Step 2: 라인별 교환 검색 상태 추가**

기존 라인 객체(`lineMap[it.id]`)에 검색 키워드와 드롭다운 표시 상태가 필요. lineMap shape을 확장:

```jsx
{
  mode: 'return'|'exchange',
  qty,
  bProduct,            // {id, name, code, brand_id, price}
  bSearch,             // 검색 키워드 (string)
  bShowSug,            // 드롭다운 표시 여부 (boolean)
  bPrice,              // B 단가 (string for input)
  exchangePayment,     // '카드'|'현금'|'적립금사용' (차액 양수 시) | '현금'|'카드취소' (음수 시)
}
```

`toggleExpand` 초기화에 새 필드 포함:
```jsx
for (const i of order.items) map[i.id] = {
  mode: 'return', qty: 0,
  bProduct: null, bSearch: '', bShowSug: false, bPrice: '',
  exchangePayment: '카드',
};
```

기타 set 헬퍼들(`setAllFull`/`setAllZero`)의 fallback 객체에도 같은 필드 포함시키기.

- [ ] **Step 3: 교환 확장 영역 JSX 작성 (placeholder 교체)**

Task 3의 placeholder `🔄 교환 상품 선택 (Task 4에서 구현 예정)` 부분을 실제 UI로 교체:

```jsx
{ln.mode === 'exchange' && ln.qty > 0 && (
  <tr>
    <td colSpan={11} style={{background:'#f3f7ff', borderBottom:'1px solid var(--border)', padding:'12px 16px'}}>
      <div style={{display:'flex', flexWrap:'wrap', gap:12, alignItems:'center', marginBottom:8}}>
        <span style={{fontSize:12, fontWeight:700, color:'var(--text)'}}>🔄 교환 → 새 상품</span>

        {/* B 상품 검색 */}
        <div style={{position:'relative', flex:'1 1 240px', maxWidth:340}}>
          <input
            value={ln.bProduct ? ln.bProduct.name : ln.bSearch}
            onChange={e => setLineMap(prev => ({
              ...prev,
              [it.id]: { ...prev[it.id], bSearch: e.target.value, bProduct: null, bShowSug: true }
            }))}
            onFocus={() => setLineMap(prev => ({ ...prev, [it.id]: { ...prev[it.id], bShowSug: true } }))}
            onBlur={() => setTimeout(() => setLineMap(prev => ({ ...prev, [it.id]: { ...prev[it.id], bShowSug: false } })), 200)}
            placeholder="상품명 또는 상품코드"
            autoComplete="off"
            style={{width:'100%', height:32, padding:'0 10px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, background:'#fff'}}
          />
          {ln.bShowSug && !ln.bProduct && ln.bSearch && (() => {
            const q = ln.bSearch.toLowerCase();
            const sug = allProducts
              .filter(p => (p.name||'').toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q))
              .slice(0, 10);
            if (sug.length === 0) return null;
            return (
              <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:80, background:'#fff', border:'1px solid var(--border)', borderRadius:4, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto', marginTop:2}}>
                {sug.map(p => (
                  <div key={p.id}
                    onMouseDown={e => {
                      e.preventDefault();
                      setLineMap(prev => ({
                        ...prev,
                        [it.id]: { ...prev[it.id], bProduct: p, bSearch: p.name, bShowSug: false, bPrice: p.price ? String(p.price) : '' }
                      }));
                    }}
                    style={{padding:'7px 10px', cursor:'pointer', fontSize:12, borderBottom:'1px solid #f0f0f0'}}
                    onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                    onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                    <div>{p.name}</div>
                    <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>
                      {p.code && <span>{p.code}</span>}
                      {p.price && <span style={{marginLeft:8}}>{Number(p.price).toLocaleString()}원</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* B 단가 */}
        <label style={{fontSize:11, color:'var(--text3)'}}>단가</label>
        <input type="number" min={0}
          value={ln.bPrice}
          onChange={e => setLineMap(prev => ({ ...prev, [it.id]: { ...prev[it.id], bPrice: e.target.value } }))}
          placeholder="0"
          style={{width:90, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, textAlign:'right'}}
        />

        {/* 교환 수량 (읽기 전용 = ln.qty) */}
        <span style={{fontSize:11, color:'var(--text3)'}}>수량 {ln.qty}</span>
      </div>

      {/* 차액 + 결제 방법 */}
      {ln.bProduct && (() => {
        const aTotal = (Number(it.price) || 0) * Number(ln.qty);
        const bTotal = (Number(ln.bPrice) || 0) * Number(ln.qty);
        const diff = bTotal - aTotal;
        return (
          <div style={{display:'flex', flexWrap:'wrap', gap:12, alignItems:'center', fontSize:12}}>
            <span>
              차액: A {aTotal.toLocaleString()} → B {bTotal.toLocaleString()} =&nbsp;
              <strong style={{color: diff > 0 ? 'var(--accent)' : diff < 0 ? 'var(--danger)' : 'var(--text2)', fontFamily:'var(--mono)'}}>
                {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
              </strong>
              {diff > 0 && <span style={{marginLeft:6, color:'var(--text3)'}}>(추가 결제)</span>}
              {diff < 0 && <span style={{marginLeft:6, color:'var(--text3)'}}>(차액 환불)</span>}
              {diff === 0 && <span style={{marginLeft:6, color:'var(--text3)'}}>(차액 없음)</span>}
            </span>

            {diff !== 0 && (
              <span style={{display:'inline-flex', gap:4, alignItems:'center'}}>
                <span style={{fontSize:11, color:'var(--text3)'}}>결제</span>
                {(diff > 0 ? ['카드','현금','적립금사용'] : ['현금','카드취소']).map(opt => (
                  <button key={opt} type="button"
                    onClick={() => setLineMap(prev => ({ ...prev, [it.id]: { ...prev[it.id], exchangePayment: opt } }))}
                    style={{
                      height:26, padding:'0 10px', border:'1px solid', borderRadius:4, fontSize:11, cursor:'pointer',
                      borderColor: ln.exchangePayment === opt ? 'var(--accent)' : 'var(--border)',
                      background:  ln.exchangePayment === opt ? '#fff3e0' : '#fff',
                      color:       ln.exchangePayment === opt ? 'var(--accent)' : 'var(--text2)',
                      fontWeight: ln.exchangePayment === opt ? 700 : 500,
                    }}>{opt}</button>
                ))}
              </span>
            )}
          </div>
        );
      })()}
    </td>
  </tr>
)}
```

기존 placeholder 행 전체를 위 블록으로 대체.

- [ ] **Step 4: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 5: 수동 검증 (브라우저)**

1. 반품 교환 페이지 → 주문 펼침 → 한 라인 모드 "교환" 선택 → 교환 수량 1 입력.
2. 확장 영역에서 상품 검색(예: 키워드 일부 입력) → 자동완성 드롭다운 표시.
3. 상품 클릭 → bProduct 채워지고 bPrice가 그 상품의 price로 자동 입력.
4. B 단가를 임의 값으로 수정해 봤을 때 차액 표시가 즉시 변경.
5. 차액 부호별 결제 방법 옵션이 다르게 표시(양수: 카드/현금/적립금사용 / 음수: 현금/카드취소 / 0: 결제 영역 숨김).
6. 결제 방법 클릭 시 active 스타일 적용.
7. 다른 라인 모드를 "반품"으로 두고 함께 처리 시 기존 반품 동작 유지(이번 Task는 처리 로직 미수정이므로 교환 라인은 처리되지 않고 반품만 처리됨 — 다음 Task에서 추가).

- [ ] **Step 6: Commit**

```
git add src/pages/sales/SalesReturnPage.jsx
git commit -m "feat(sales-return): 교환 확장 영역 UI(B 상품 검색·단가·차액·결제 방법) 추가"
```

---

## Task 5: 교환 처리 로직 (handleReturn 확장) + 미리보기 + 버튼 라벨

**Files:**
- Modify: `src/pages/sales/SalesReturnPage.jsx`

교환 라인을 실제 DB로 반영. A 반품 + B 매출 insert + 회원 누적/적립금/등급 처리. 미리보기에 교환 차액·신규 적립 추가. 버튼 라벨/confirm 메시지 갱신.

- [ ] **Step 1: preview 계산에 교환 합계 추가**

Task 3에서 만든 preview를 다음으로 확장:

```jsx
const preview = useMemo(() => {
  if (!expandedOrder) return null;
  let cash = 0, pointsRestore = 0, pointsRevoke = 0, qtySum = 0;
  let exchangeDiff = 0, exchangeQty = 0, exchangeNewEarn = 0;
  const exchangeByPayment = {}; // { [payment]: count }
  const customer = expandedOrder.customer;
  const rate = customer ? getGrade(customer.total_purchase || 0).rate : 0;
  for (const it of expandedOrder.items) {
    const ln = lineMap[it.id];
    if (!ln) continue;
    const qty = Number(ln.qty || 0);
    if (qty <= 0) continue;
    if (ln.mode === 'return') {
      const ratio = qty / it.quantity;
      cash += it.price * qty;
      pointsRestore += Math.floor((it.points_used||0) * ratio);
      pointsRevoke  += Math.floor((it.points_earned||0) * ratio);
      qtySum += qty;
    } else if (ln.mode === 'exchange' && ln.bProduct) {
      const aTotal = (Number(it.price) || 0) * qty;
      const bTotal = (Number(ln.bPrice) || 0) * qty;
      const diff = bTotal - aTotal;
      exchangeDiff += diff;
      exchangeQty  += qty;
      exchangeNewEarn += Math.floor(bTotal * rate);
      const key = ln.exchangePayment || (diff > 0 ? '카드' : diff < 0 ? '현금' : '-');
      exchangeByPayment[key] = (exchangeByPayment[key] || 0) + 1;
    }
  }
  return { cash, pointsRestore, pointsRevoke, qtySum, exchangeDiff, exchangeQty, exchangeNewEarn, exchangeByPayment };
}, [expandedOrder, lineMap]);
```

- [ ] **Step 2: 미리보기 영역 JSX 확장**

기존 미리보기 영역(약 411-438행)을 다음으로 확장:

```jsx
{preview && (
  <div style={{marginTop:14, display:'flex', gap:24, flexWrap:'wrap', alignItems:'center', paddingTop:12, borderTop:'1px solid var(--border)'}}>
    <div style={{display:'flex', gap:24, fontSize:13, flexWrap:'wrap'}}>
      <div>
        <span style={{color:'var(--text3)', marginRight:6}}>환불 금액(반품)</span>
        <strong style={{fontFamily:'var(--mono)'}}>{preview.cash.toLocaleString()}원</strong>
      </div>
      <div>
        <span style={{color:'var(--text3)', marginRight:6}}>복구 적립금</span>
        <strong style={{fontFamily:'var(--mono)'}}>+{preview.pointsRestore.toLocaleString()}원</strong>
      </div>
      <div>
        <span style={{color:'var(--text3)', marginRight:6}}>회수 적립금</span>
        <strong style={{fontFamily:'var(--mono)'}}>-{preview.pointsRevoke.toLocaleString()}원</strong>
      </div>
      {preview.exchangeQty > 0 && (
        <>
          <div>
            <span style={{color:'var(--text3)', marginRight:6}}>교환 차액</span>
            <strong style={{fontFamily:'var(--mono)', color: preview.exchangeDiff > 0 ? 'var(--accent)' : preview.exchangeDiff < 0 ? 'var(--danger)' : 'var(--text2)'}}>
              {preview.exchangeDiff > 0 ? '+' : ''}{preview.exchangeDiff.toLocaleString()}원
            </strong>
            {Object.keys(preview.exchangeByPayment).length > 0 && (
              <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>
                ({Object.entries(preview.exchangeByPayment).map(([k,v]) => `${k} ${v}건`).join(', ')})
              </span>
            )}
          </div>
          <div>
            <span style={{color:'var(--text3)', marginRight:6}}>교환 신규 적립</span>
            <strong style={{fontFamily:'var(--mono)'}}>+{preview.exchangeNewEarn.toLocaleString()}원</strong>
          </div>
        </>
      )}
    </div>
    <div style={{marginLeft:'auto', display:'flex', gap:8}}>
      <button className="btn btn-s" style={{padding:'0 16px', height:36, fontSize:12}}
        onClick={() => { setExpanded(null); setLineMap({}); }} disabled={saving}>
        접기
      </button>
      <button className="btn btn-p" style={{padding:'0 20px', height:36, fontSize:13, fontWeight:700}}
        onClick={handleReturn} disabled={saving || (preview.qtySum === 0 && preview.exchangeQty === 0)}>
        {saving ? <span className="spinner"/> : `반품 교환 처리${(preview.qtySum + preview.exchangeQty) > 0 ? ` (${preview.qtySum + preview.exchangeQty}개)` : ''}`}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: handleReturn 함수에 교환 라인 처리 추가**

기존 handleReturn(약 121-190행)에 교환 분기 추가. 전체 함수를 다음으로 교체:

```jsx
const handleReturn = async () => {
  if (!expandedOrder) return;
  const returnLines  = expandedOrder.items.filter(i => {
    const ln = lineMap[i.id];
    return ln && ln.mode === 'return' && Number(ln.qty || 0) > 0;
  });
  const exchangeLines = expandedOrder.items.filter(i => {
    const ln = lineMap[i.id];
    return ln && ln.mode === 'exchange' && Number(ln.qty || 0) > 0 && ln.bProduct;
  });
  if (returnLines.length === 0 && exchangeLines.length === 0) {
    toast('반품 또는 교환할 라인을 선택해주세요', 'err');
    return;
  }

  // 검증
  for (const it of returnLines) {
    const qty = Number(lineMap[it.id].qty);
    const remain = it.quantity - (it.returned_qty||0);
    if (qty > remain) { toast(`${it.product?.name}: 남은 수량(${remain})을 초과합니다`, 'err'); return; }
  }
  for (const it of exchangeLines) {
    const ln = lineMap[it.id];
    const qty = Number(ln.qty);
    const remain = it.quantity - (it.returned_qty||0);
    if (qty > remain) { toast(`${it.product?.name}: 남은 수량(${remain})을 초과합니다`, 'err'); return; }
    if (!ln.bPrice || Number(ln.bPrice) < 0) { toast(`${it.product?.name}: 교환 단가를 입력해주세요`, 'err'); return; }
  }

  if (!window.confirm(
    `반품 ${returnLines.length}건 / 교환 ${exchangeLines.length}건 처리하시겠습니까?\n\n` +
    `환불 금액(반품): ${preview.cash.toLocaleString()}원\n` +
    `복구 적립금: ${preview.pointsRestore.toLocaleString()}원\n` +
    `회수 적립금: ${preview.pointsRevoke.toLocaleString()}원\n` +
    (preview.exchangeQty > 0
      ? `교환 차액: ${preview.exchangeDiff > 0 ? '+' : ''}${preview.exchangeDiff.toLocaleString()}원\n교환 신규 적립: ${preview.exchangeNewEarn.toLocaleString()}원`
      : '')
  )) return;

  setSaving(true);
  try {
    // 1) 반품 라인 처리 (기존 로직)
    for (const it of returnLines) {
      const qty = Number(lineMap[it.id].qty);
      const newReturnedQty = (it.returned_qty||0) + qty;
      const fullyReturned = newReturnedQty >= it.quantity;

      await supabase.from('sales').update({
        returned_qty: newReturnedQty,
        returned_at: fullyReturned ? new Date().toISOString() : it.returned_at,
      }).eq('id', it.id);

      if (it.product?.code) {
        const { data: stockRow } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name',  profile.department)
          .eq('branch_name', profile.branch)
          .eq('product_code', it.product.code)
          .maybeSingle();
        if (stockRow) {
          await supabase.from('store_stock').update({
            stock_qty: (stockRow.stock_qty||0) + qty,
            updated_at: new Date().toISOString(),
          }).eq('id', stockRow.id);
        }
      }

      if (it.customer_id && it.customer) {
        const ratio = qty / it.quantity;
        const pointsUsedRefund    = Math.floor((it.points_used||0) * ratio);
        const pointsEarnedReverse = Math.floor((it.points_earned||0) * ratio);
        const cashRefund = it.price * qty;

        const newTotalPoints   = Math.max(0, (it.customer.total_points||0) + pointsUsedRefund - pointsEarnedReverse);
        const newUsedPoints    = Math.max(0, (it.customer.used_points||0) - pointsUsedRefund);
        const newTotalPurchase = Math.max(0, (it.customer.total_purchase||0) - cashRefund);
        const newGrade = getGrade(newTotalPurchase);

        await supabase.from('customers').update({
          total_points:   newTotalPoints,
          used_points:    newUsedPoints,
          total_purchase: newTotalPurchase,
          grade:          newGrade.grade,
        }).eq('id', it.customer_id);
      }
    }

    // 2) 교환 라인 처리
    for (const it of exchangeLines) {
      const ln = lineMap[it.id];
      const qty = Number(ln.qty);
      const aPrice = Number(it.price) || 0;
      const bPrice = Number(ln.bPrice) || 0;
      const aTotal = aPrice * qty;
      const bTotal = bPrice * qty;
      const diff = bTotal - aTotal;
      const newReturnedQty = (it.returned_qty||0) + qty;
      const fullyReturned = newReturnedQty >= it.quantity;

      // 2a) A 반품 처리 (sales.returned_qty)
      await supabase.from('sales').update({
        returned_qty: newReturnedQty,
        returned_at: fullyReturned ? new Date().toISOString() : it.returned_at,
      }).eq('id', it.id);

      // 2b) A 재고 복구
      if (it.product?.code) {
        const { data: aStock } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name',  profile.department)
          .eq('branch_name', profile.branch)
          .eq('product_code', it.product.code)
          .maybeSingle();
        if (aStock) {
          await supabase.from('store_stock').update({
            stock_qty: (aStock.stock_qty||0) + qty,
            updated_at: new Date().toISOString(),
          }).eq('id', aStock.id);
        }
      }

      // 2c) B 매출 insert
      const customerId = it.customer_id;
      const customer = it.customer;
      const rate = customer ? getGrade(customer.total_purchase || 0).rate : 0;
      const pointsEarnedB = customerId ? Math.floor(bTotal * rate) : 0;
      const pointsUsedB = (diff > 0 && ln.exchangePayment === '적립금사용') ? diff : 0;

      const { data: insertedB, error: insertErr } = await supabase.from('sales').insert({
        sold_at: it.sold_at,
        store_name: profile.department,
        branch_name: profile.branch,
        brand_id: ln.bProduct.brand_id,
        product_id: ln.bProduct.id,
        quantity: qty,
        price: bPrice,
        payment: diff !== 0 ? (ln.exchangePayment || '카드') : '카드',
        memo: `교환 from sale#${it.id}`,
        created_by: profile.id,
        customer_id: customerId,
        points_earned: pointsEarnedB,
        points_used: pointsUsedB,
        exchange_from_sale_id: it.id,
      }).select().single();
      if (insertErr) throw insertErr;

      // 2d) B 재고 차감
      if (ln.bProduct.code) {
        const { data: bStock } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name',  profile.department)
          .eq('branch_name', profile.branch)
          .eq('product_code', ln.bProduct.code)
          .maybeSingle();
        if (bStock) {
          await supabase.from('store_stock').update({
            stock_qty: Math.max(0, (bStock.stock_qty||0) - qty),
            updated_at: new Date().toISOString(),
          }).eq('id', bStock.id);
        }
      }

      // 2e) 회원 처리: A 회수 + B 적립 + 차액 적립금 사용 처리
      if (customerId && customer) {
        const ratio = qty / it.quantity;
        const aPointsUsedRefund    = Math.floor((it.points_used||0) * ratio);
        const aPointsEarnedReverse = Math.floor((it.points_earned||0) * ratio);

        // 차액 적립금사용 차감
        const exchangePointsDeduct = pointsUsedB;

        const newTotalPoints = Math.max(0,
          (customer.total_points||0)
          + aPointsUsedRefund         // A 사용 적립금 복구
          - aPointsEarnedReverse      // A 적립 회수
          + pointsEarnedB             // B 신규 적립
          - exchangePointsDeduct      // 차액 적립금사용 차감
        );
        const newUsedPoints = Math.max(0,
          (customer.used_points||0)
          - aPointsUsedRefund
          + exchangePointsDeduct
        );
        const newTotalPurchase = Math.max(0,
          (customer.total_purchase||0) - aTotal + bTotal
        );
        const newGrade = getGrade(newTotalPurchase);

        await supabase.from('customers').update({
          total_points:   newTotalPoints,
          used_points:    newUsedPoints,
          total_purchase: newTotalPurchase,
          grade:          newGrade.grade,
        }).eq('id', customerId);
      }
    }

    toast('반품 교환 처리 완료', 'ok');
    setExpanded(null);
    setLineMap({});
    fetchOrders();
  } catch (err) {
    toast('처리 실패: ' + err.message, 'err');
  }
  setSaving(false);
};
```

- [ ] **Step 4: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 5: 수동 검증 (브라우저)**

검증 절차 (controller가 dev server 실행 후 수행):

**반품만 처리 (회귀 검증)**:
1. 한 주문 펼침 → 라인 모드 "반품" → 수량 입력 → 처리 → 기존과 동일하게 returned_qty 증가, 재고 복구, 회원 적립금 회수 동작 확인.

**단순 교환 (동가, 비회원)**:
2. A 단가 50,000원 1개 라인 → 모드 "교환" → 수량 1 → B 검색·선택 (B 단가 50,000원으로 자동) → 차액 0원, 결제 영역 숨김.
3. 처리 → 매출조회에서 A는 returned 처리, B는 새 행으로 등록 (`exchange_from_sale_id = A.id`). B의 store_stock 차감, A의 store_stock 복구.
4. 매장매출 다운로드 시 B 행이 `정상(교환)`으로 표시되는지 확인.

**차액 +, 회원**:
5. 회원 주문 → A 50,000원 1개 → 교환 → B 70,000원 → 차액 +20,000원 → 결제 "카드" 선택 → 처리.
6. 결과 검증: A returned, B insert, 회원 누적 +20,000, 적립금: A 회수 + B 적립으로 net 변화, 등급 재계산.

**차액 -, 회원**:
7. A 70,000원 → B 50,000원 → 차액 -20,000원 → 결제 "현금" 환불 → 처리. 회원 누적 -20,000, 적립금 net 변화.

**차액 적립금사용**:
8. 차액 +X → "적립금사용" 선택 → 처리. 회원 적립금에서 X 차감.

**부분 교환**:
9. A 5개 → 모드 "교환" → 수량 2 → B 선택 → 처리. A.returned_qty +=2, B 새 행 quantity=2.

**한 주문에 반품·교환 동시**:
10. 라인 1: 반품, 라인 2: 교환 → 처리 → 둘 다 정상 처리.

- [ ] **Step 6: Commit**

```
git add src/pages/sales/SalesReturnPage.jsx
git commit -m "feat(sales-return): 교환 처리 로직 + 미리보기 확장 + 처리 버튼 라벨 갱신"
```

---

## Self-Review Checklist (작업자 본인 확인)

플랜 작성 후 자체 검토.

**1. Spec coverage:**
- 3.1 메뉴 라벨 → Task 2 Step 1.
- 3.2 페이지 헤더(탭/카드 라벨) → Task 2 Step 2.
- 3.3 모드 컬럼 + 라디오 → Task 3 Step 5.
- 3.4 교환 확장 영역 (B 검색·단가·차액·결제) → Task 4 Step 3.
- 3.5 차액 부호별 결제 옵션 → Task 4 Step 3.
- 3.6 미리보기 확장 → Task 5 Step 1·2.
- 3.7 처리 버튼 라벨 / confirm → Task 5 Step 2·3.
- 4.1 DB 컬럼/인덱스 → Task 1 Step 1.
- 4.2 컬럼 의미(B 행에 exchange_from_sale_id) → Task 5 Step 3 insert.
- 5.1 통합 처리 함수 (반품/교환 라인 분기) → Task 5 Step 3.
- 5.2 트랜잭션(없음, 순차 update) → Task 5 Step 3.
- 6 매장매출 다운로드 mapType → Task 1 Step 3·4.
- 7 회귀 영향(NULL 기존 데이터, 직접입력 미변경) → Task 1·2의 변경이 보수적이므로 자동 보장.

**2. Placeholder scan:**
- "TBD"/"적절히"/"나중에" 등 없음.
- 모든 Step에 실제 코드/SQL/명령 포함.

**3. Type consistency:**
- `lineMap` shape: `{mode, qty, bProduct, bSearch, bShowSug, bPrice, exchangePayment}` — Task 3에서 정의, Task 4에서 확장된 필드 사용, Task 5에서 처리.
- `mapType` 시그니처: `(s) => string` — Task 1에서 변경, exportSalesRaw 호출부에서 일치.
- `exchange_from_sale_id` 컬럼: Task 1·5에서 일관 사용.
- `preview` shape: Task 5 Step 1에서 확장된 필드(exchangeDiff/exchangeQty/exchangeNewEarn/exchangeByPayment)를 Step 2 미리보기 JSX에서 정확히 참조.
- `getGrade(...).rate` 사용: 기존 utils.js의 export 그대로.
