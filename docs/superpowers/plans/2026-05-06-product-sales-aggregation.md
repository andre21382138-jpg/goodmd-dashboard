# 매장매출 - 상품별 집계 뷰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본사 매장매출 페이지에 상품 키워드 검색 기반의 상품별 집계 모드와 점포별/날짜별 드릴다운 모달을 추가한다.

**Architecture:** 단일 파일 `src/pages/sales/SalesListPage.jsx` 내부에 보기 모드(state)를 두고 기존 판매내역 뷰와 상품별 집계 뷰를 조건부 렌더. 집계는 클라이언트 사이드(useMemo)로 처리하고, 드릴다운은 모달(MyMembersPage.jsx 스타일)로 표시한다.

**Tech Stack:** React 18, Supabase JS, 인라인 스타일(기존 패턴), 기존 `lib/utils.js`(toast, uniq).

**Spec:** `docs/superpowers/specs/2026-05-06-product-sales-aggregation-design.md`

**Test 전략:** 본 프로젝트에는 컴포넌트 테스트 인프라가 없으므로 각 작업은 dev server에서 브라우저 수동 검증으로 마무리한다. 검증 절차는 각 Task의 마지막 step에 명시.

---

## File Structure

- Modify: `src/pages/sales/SalesListPage.jsx` — 보기 모드 토글, 상품별 집계 useMemo, 집계 테이블 렌더, 드릴다운 모달

새 파일 생성 없음. 기존 컴포넌트에 통합.

---

## Task 1: 보기 모드 토글 추가 (스캐폴드)

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

이 단계의 목표는 모드 state와 토글 UI를 추가하고, 모드 전환 시 기존 판매내역 영역이 그대로 유지되는지 확인. 집계 모드는 임시 placeholder.

- [ ] **Step 1: viewMode state 추가**

`SalesListPage.jsx` 컴포넌트의 state 선언부(showReturned 다음 줄, 약 16번째 줄 근처)에 다음 라인을 추가:

```jsx
const [viewMode, setViewMode] = useState('list'); // 'list' | 'product'
```

- [ ] **Step 2: 모드 토글 버튼 마크업 삽입**

`return (...)` 내부의 `<div className="card">` 바로 다음, `<div className="card-label">판매내역 조회</div>` 위에 모드 토글 영역을 추가. `card-label`도 모드에 따라 다르게 표시:

```jsx
<div style={{display:'flex', gap:8, marginBottom:12}}>
  <button
    style={{
      height:36, padding:'0 16px', border:'2px solid',
      borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
      borderColor: viewMode==='list' ? 'var(--accent)' : 'var(--border)',
      background:  viewMode==='list' ? '#fff3e0' : '#fff',
      color:       viewMode==='list' ? 'var(--accent)' : 'var(--text2)',
    }}
    onClick={() => setViewMode('list')}
  >📋 판매내역</button>
  <button
    style={{
      height:36, padding:'0 16px', border:'2px solid',
      borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
      borderColor: viewMode==='product' ? 'var(--accent)' : 'var(--border)',
      background:  viewMode==='product' ? '#fff3e0' : '#fff',
      color:       viewMode==='product' ? 'var(--accent)' : 'var(--text2)',
    }}
    onClick={() => setViewMode('product')}
  >📊 상품별 집계</button>
</div>
<div className="card-label">{viewMode === 'list' ? '판매내역 조회' : '상품별 집계'}</div>
```

기존 `<div className="card-label">판매내역 조회</div>` 한 줄은 위 블록의 마지막 줄로 대체된다 (중복 제거).

- [ ] **Step 3: 집계 모드 placeholder 추가**

`{loading ? <div className="empty"><span className="spinner"/></div> : (` 부터 시작하는 영역을 다음과 같이 모드 분기로 감싼다.

기존:
```jsx
{loading ? <div className="empty"><span className="spinner"/></div> : (
  <div className="twrap">
    <table>
      ... (판매내역 테이블)
    </table>
  </div>
)}
```

변경 후:
```jsx
{loading ? <div className="empty"><span className="spinner"/></div> : viewMode === 'list' ? (
  <div className="twrap">
    <table>
      ... (판매내역 테이블 - 그대로 유지)
    </table>
  </div>
) : (
  <div className="empty">상품별 집계 (구현 예정)</div>
)}
```

- [ ] **Step 4: 수동 검증 - dev server 실행**

PowerShell:
```
npm start
```

브라우저 검증 절차:
1. 본사 계정(ssakwon@kbh.kr 등)으로 로그인.
2. 사이드바 → 매출조회 → 매장 매출 진입.
3. 페이지 상단에 `[📋 판매내역]` `[📊 상품별 집계]` 두 버튼이 표시되는지 확인.
4. `📋 판매내역` 활성 상태가 기본인지 확인.
5. 기존 판매내역 테이블이 정상 렌더되는지 확인.
6. `📊 상품별 집계` 클릭 시 카드 라벨이 "상품별 집계"로 바뀌고 본문이 "상품별 집계 (구현 예정)"로 바뀌는지 확인.
7. 다시 `📋 판매내역` 클릭 시 원래 테이블 복귀하는지 확인.

- [ ] **Step 5: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): 매장매출 페이지에 보기 모드 토글 스캐폴드 추가"
```

---

## Task 2: 상품별 집계 useMemo 로직 추가

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

`sales` 배열을 product_id 기준으로 그룹핑하여 상품별 집계 행을 만든다. 기존 `filtered` 배열을 입력으로 사용한다 (이미 키워드/완전반품 필터·정렬이 적용된 상태).

- [ ] **Step 1: productAgg useMemo 추가**

`returnedCount` 정의 다음 줄(약 82번째 줄)에 다음 useMemo를 추가:

```jsx
// 상품별 집계 (filtered 기준)
const productAgg = useMemo(() => {
  const map = new Map();
  for (const s of filtered) {
    const key = s.product_id ?? `name:${s.product?.name || '(미상)'}`;
    const eq = effQty(s);
    const ea = effAmt(s);
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
      cur.qty   += eq;
      cur.amt   += ea;
    } else {
      map.set(key, {
        key,
        product_id: s.product_id,
        product_name: s.product?.name || '(미상)',
        brand_name:   s.brand?.name   || '-',
        count: 1,
        qty:   eq,
        amt:   ea,
      });
    }
  }
  return Array.from(map.values());
}, [filtered]);
```

- [ ] **Step 2: 집계 정렬 state와 정렬된 결과 추가**

`viewMode` state 선언 바로 다음에 정렬 state를 추가:

```jsx
const [aggSortBy, setAggSortBy] = useState('amt_desc'); // 'amt_desc' | 'qty_desc' | 'count_desc' | 'name'
```

`productAgg` 정의 바로 다음에 정렬된 배열 useMemo 추가:

```jsx
const productAggSorted = useMemo(() => {
  const arr = [...productAgg];
  if (aggSortBy === 'amt_desc')   arr.sort((a,b) => b.amt - a.amt);
  if (aggSortBy === 'qty_desc')   arr.sort((a,b) => b.qty - a.qty);
  if (aggSortBy === 'count_desc') arr.sort((a,b) => b.count - a.count);
  if (aggSortBy === 'name')       arr.sort((a,b) => a.product_name.localeCompare(b.product_name, 'ko'));
  return arr;
}, [productAgg, aggSortBy]);
```

- [ ] **Step 3: 합계 계산 + 잘림 경고 플래그**

`productAggSorted` 정의 다음에 추가:

```jsx
const aggTotalCount = useMemo(() => productAgg.reduce((s,r) => s + r.count, 0), [productAgg]);
const aggTotalQty   = useMemo(() => productAgg.reduce((s,r) => s + r.qty,   0), [productAgg]);
const aggTotalAmt   = useMemo(() => productAgg.reduce((s,r) => s + r.amt,   0), [productAgg]);
const truncated     = sales.length === 500;
```

- [ ] **Step 4: 빌드 확인 (lint/syntax)**

PowerShell:
```
npm start
```

브라우저에서 페이지가 에러 없이 로드되는지(콘솔 에러 없음) 확인. 이 단계에선 UI 변화는 없음 — 로직만 추가됨.

- [ ] **Step 5: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): 상품별 집계 useMemo 및 정렬 state 추가"
```

---

## Task 3: 상품별 집계 테이블 렌더

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

placeholder를 실제 집계 테이블로 교체. 정렬 select은 모드별로 다르게 표시.

- [ ] **Step 1: 정렬 select을 모드 분기로 변경**

기존 정렬 select (sortBy 사용하는 부분, 약 130번째 줄):

```jsx
<select className="fsel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
  <option value="date">최신순</option>
  <option value="qty_desc">판매건수 높은순</option>
  <option value="amt_desc">매출액 높은순</option>
</select>
```

위 select을 다음으로 교체:

```jsx
{viewMode === 'list' ? (
  <select className="fsel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
    <option value="date">최신순</option>
    <option value="qty_desc">판매건수 높은순</option>
    <option value="amt_desc">매출액 높은순</option>
  </select>
) : (
  <select className="fsel" value={aggSortBy} onChange={e => setAggSortBy(e.target.value)}>
    <option value="amt_desc">매출액 높은순</option>
    <option value="qty_desc">수량 높은순</option>
    <option value="count_desc">판매건수 높은순</option>
    <option value="name">상품명순</option>
  </select>
)}
```

- [ ] **Step 2: fbar-right 합계 표시도 모드별로 분기**

기존:
```jsx
<div className="fbar-right">
  <span className="fresult"><b>{filtered.length.toLocaleString()}</b>건 · <b>{totalQty.toLocaleString()}</b>개 · <b>{totalAmt.toLocaleString()}</b>원</span>
</div>
```

다음으로 교체:
```jsx
<div className="fbar-right">
  {viewMode === 'list' ? (
    <span className="fresult"><b>{filtered.length.toLocaleString()}</b>건 · <b>{totalQty.toLocaleString()}</b>개 · <b>{totalAmt.toLocaleString()}</b>원</span>
  ) : (
    <span className="fresult">
      <b>{productAgg.length.toLocaleString()}</b>개 상품 · <b>{aggTotalCount.toLocaleString()}</b>건 · <b>{aggTotalQty.toLocaleString()}</b>개 · <b>{aggTotalAmt.toLocaleString()}</b>원
      {truncated && <span style={{marginLeft:8, fontSize:11, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'2px 8px', borderRadius:3}}>⚠️ 결과 500건 초과 - 기간을 좁혀주세요</span>}
    </span>
  )}
</div>
```

- [ ] **Step 3: 집계 placeholder를 실제 테이블로 교체**

기존:
```jsx
) : (
  <div className="empty">상품별 집계 (구현 예정)</div>
)}
```

다음으로 교체:
```jsx
) : (
  <div className="twrap">
    <table>
      <thead>
        <tr>
          <th>브랜드</th>
          <th>상품명</th>
          <th className="r">판매건수</th>
          <th className="r">총 수량</th>
          <th className="r">총 매출액</th>
          <th>상세</th>
        </tr>
      </thead>
      <tbody>
        {productAggSorted.length === 0
          ? <tr><td colSpan={6} className="empty">조회된 상품이 없습니다</td></tr>
          : productAggSorted.map(p => (
            <tr key={p.key}>
              <td>{p.brand_name}</td>
              <td style={{fontWeight:600}}>{p.product_name}</td>
              <td className="r">{p.count.toLocaleString()}</td>
              <td className="r">{p.qty.toLocaleString()}</td>
              <td className="r" style={{fontWeight:600}}>{p.amt.toLocaleString()}</td>
              <td>
                <button
                  style={{height:26, padding:'0 8px', fontSize:11, fontWeight:600, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor:'pointer', marginRight:4}}
                  onClick={() => { /* 다음 Task에서 연결 */ }}
                >🏬 점포별</button>
                <button
                  style={{height:26, padding:'0 8px', fontSize:11, fontWeight:600, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor:'pointer'}}
                  onClick={() => { /* 다음 Task에서 연결 */ }}
                >📅 날짜별</button>
              </td>
            </tr>
          ))
        }
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 4: 수동 검증**

브라우저 검증 절차:
1. dev server가 실행 중인지 확인 (`npm start`).
2. 매장 매출 페이지에서 `📊 상품별 집계` 클릭.
3. 시작일/종료일을 적절히 잡고(예: 당월 버튼) 키워드는 비워둔 상태에서 상품별 집계가 표시되는지 확인.
4. 키워드(예: 자주 팔린 상품 일부 단어)를 입력했을 때 매칭 상품만 행으로 표시되는지 확인.
5. 합계 영역이 `N개 상품 · M건 · X개 · Y원` 형식으로 표시되는지 확인.
6. 정렬 select에서 `매출액↓ / 수량↓ / 판매건수↓ / 상품명순` 전환이 동작하는지 확인.
7. 점포 select과 브랜드 select 변경 시 집계가 재계산되는지 확인.
8. 데이터가 500건에 도달하는 넓은 기간으로 조회 시 ⚠️ 경고 배지가 표시되는지 확인 (옵션 검증 — 데이터 부족 시 스킵 가능).

- [ ] **Step 5: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): 상품별 집계 테이블 및 합계/경고 표시"
```

---

## Task 4: 드릴다운 모달 state 및 빌드

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

상품 행의 `[점포별]`/`[날짜별]` 버튼을 모달 오픈에 연결하고, 모달 내부에 점포별/날짜별 토글과 분해 테이블을 구현한다.

- [ ] **Step 1: 모달 state 추가**

`aggSortBy` state 선언 다음 줄에 추가:

```jsx
const [drillProduct, setDrillProduct] = useState(null); // {key, product_id, product_name, brand_name, count, qty, amt} | null
const [drillTab,     setDrillTab]     = useState('store'); // 'store' | 'date'
```

- [ ] **Step 2: 드릴다운 분해 useMemo 추가**

`truncated` 정의 다음에 추가. `filtered`에서 선택된 상품의 행만 뽑아 점포별/날짜별로 분해.

```jsx
const drillRows = useMemo(() => {
  if (!drillProduct) return [];
  return filtered.filter(s => {
    if (drillProduct.product_id != null) return s.product_id === drillProduct.product_id;
    return (s.product?.name || '(미상)') === drillProduct.product_name;
  });
}, [filtered, drillProduct]);

const drillByStore = useMemo(() => {
  const map = new Map();
  for (const s of drillRows) {
    const k = `${s.store_name || '-'}|${s.branch_name || '-'}`;
    const eq = effQty(s);
    const ea = effAmt(s);
    const cur = map.get(k);
    if (cur) { cur.count += 1; cur.qty += eq; cur.amt += ea; }
    else map.set(k, { store_name: s.store_name || '-', branch_name: s.branch_name || '-', count:1, qty:eq, amt:ea });
  }
  return Array.from(map.values()).sort((a,b) => b.amt - a.amt);
}, [drillRows]);

const drillByDate = useMemo(() => {
  const map = new Map();
  for (const s of drillRows) {
    const k = s.sold_at;
    const eq = effQty(s);
    const ea = effAmt(s);
    const cur = map.get(k);
    if (cur) { cur.count += 1; cur.qty += eq; cur.amt += ea; }
    else map.set(k, { sold_at: k, count:1, qty:eq, amt:ea });
  }
  return Array.from(map.values()).sort((a,b) => String(a.sold_at).localeCompare(String(b.sold_at)));
}, [drillRows]);
```

- [ ] **Step 3: 상품 행 버튼 onClick 연결**

Task 3에서 추가한 `[점포별]`/`[날짜별]` 버튼의 빈 onClick을 다음으로 채운다:

```jsx
onClick={() => { setDrillProduct(p); setDrillTab('store'); }}
```
```jsx
onClick={() => { setDrillProduct(p); setDrillTab('date'); }}
```

- [ ] **Step 4: ESC 키로 모달 닫기**

컴포넌트 내부 (다른 useEffect 다음)에 추가:

```jsx
useEffect(() => {
  if (!drillProduct) return;
  const onKey = (e) => { if (e.key === 'Escape') setDrillProduct(null); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [drillProduct]);
```

- [ ] **Step 5: 모달 JSX 추가**

`return (...)` 내부 최상위 `<div>...</div>`의 닫는 태그 직전(즉 가장 바깥 `</div>` 직전)에 모달 영역을 추가:

```jsx
{drillProduct && (
  <div
    style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
    onClick={() => setDrillProduct(null)}
  >
    <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
    <div
      style={{position:'relative', background:'#fff', borderRadius:16, width:'min(880px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
      onClick={e => e.stopPropagation()}
    >
      {/* 헤더 */}
      <div style={{padding:'20px 24px 16px', borderBottom:'1px solid var(--border)'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
          <div>
            <div style={{fontSize:18, fontWeight:700}}>{drillProduct.product_name}</div>
            <div style={{fontSize:12, color:'var(--text2)', marginTop:4}}>
              {drillProduct.brand_name}
              {(fFrom || fTo) && <span style={{marginLeft:10}}>· {fFrom || '~'} ~ {fTo || '~'}</span>}
              <span style={{marginLeft:10}}>· {drillProduct.count.toLocaleString()}건 · {drillProduct.qty.toLocaleString()}개 · {drillProduct.amt.toLocaleString()}원</span>
            </div>
          </div>
          <button
            onClick={() => setDrillProduct(null)}
            style={{height:32, padding:'0 12px', border:'1px solid var(--border)', borderRadius:6, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer'}}
          >✕ 닫기</button>
        </div>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <button
            style={{
              height:32, padding:'0 14px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
              borderColor: drillTab==='store' ? 'var(--accent)' : 'var(--border)',
              background:  drillTab==='store' ? '#fff3e0' : '#fff',
              color:       drillTab==='store' ? 'var(--accent)' : 'var(--text2)',
            }}
            onClick={() => setDrillTab('store')}
          >🏬 점포별</button>
          <button
            style={{
              height:32, padding:'0 14px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
              borderColor: drillTab==='date' ? 'var(--accent)' : 'var(--border)',
              background:  drillTab==='date' ? '#fff3e0' : '#fff',
              color:       drillTab==='date' ? 'var(--accent)' : 'var(--text2)',
            }}
            onClick={() => setDrillTab('date')}
          >📅 날짜별</button>
        </div>
      </div>
      {/* 본문 */}
      <div style={{padding:'16px 24px 24px'}}>
        {drillTab === 'store' ? (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>점포</th><th>지점</th>
                  <th className="r">판매건수</th><th className="r">수량</th><th className="r">매출액</th>
                </tr>
              </thead>
              <tbody>
                {drillByStore.length === 0
                  ? <tr><td colSpan={5} className="empty">데이터 없음</td></tr>
                  : drillByStore.map(r => (
                    <tr key={`${r.store_name}|${r.branch_name}`}>
                      <td><span className="badge badge-dept">{r.store_name}</span></td>
                      <td><span className="badge badge-store">{r.branch_name}</span></td>
                      <td className="r">{r.count.toLocaleString()}</td>
                      <td className="r">{r.qty.toLocaleString()}</td>
                      <td className="r" style={{fontWeight:600}}>{r.amt.toLocaleString()}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        ) : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th className="r">판매건수</th><th className="r">수량</th><th className="r">매출액</th>
                </tr>
              </thead>
              <tbody>
                {drillByDate.length === 0
                  ? <tr><td colSpan={4} className="empty">데이터 없음</td></tr>
                  : drillByDate.map(r => (
                    <tr key={r.sold_at}>
                      <td className="mono">{r.sold_at}</td>
                      <td className="r">{r.count.toLocaleString()}</td>
                      <td className="r">{r.qty.toLocaleString()}</td>
                      <td className="r" style={{fontWeight:600}}>{r.amt.toLocaleString()}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: 수동 검증**

브라우저 검증 절차:
1. 매장 매출 → 상품별 집계 모드 진입.
2. 적절한 기간/키워드 입력해 상품 집계 확인.
3. 한 상품 행의 `🏬 점포별` 버튼 클릭 → 모달 오픈 + 점포별 탭 활성화 확인.
4. 모달 헤더에 상품명/브랜드/기간/총합이 표시되는지 확인.
5. 점포별 표에 백화점·지점·건수·수량·매출액이 매출액 내림차순으로 표시되는지 확인.
6. 모달 상단 `📅 날짜별` 토글 클릭 시 같은 모달 안에서 날짜별 표로 전환되는지 확인 (모달 닫히지 않아야 함).
7. 날짜별 표가 sold_at 오름차순(과거→최근)으로 정렬되는지 확인.
8. 다른 상품 행의 `📅 날짜별` 직접 클릭 시 모달이 날짜 탭으로 바로 열리는지 확인.
9. 닫기 동작 검증: ✕ 닫기 버튼 / 오버레이 클릭 / ESC 키 — 세 가지 모두 동작해야 함.
10. 모달 내부 클릭 시 닫히지 않는지 확인 (이벤트 전파 차단 동작).
11. 점포 select 필터를 건 상태에서 드릴다운 점포별 보기가 해당 점포만 나오는지 확인.

- [ ] **Step 7: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): 상품별 집계 드릴다운 모달(점포별/날짜별 토글) 추가"
```

---

## Task 5: 폴리시 - 모드 전환 시 정렬 리셋, 메뉴 활성 상태 검증

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

스펙 3.1 마지막 항목("정렬값은 모드별로 의미가 다르므로 모드 전환 시 각 모드의 기본 정렬로 리셋한다")을 적용. 이미 `sortBy`/`aggSortBy`가 분리돼 있으므로, 모드 전환 시 활성 모드의 정렬을 기본값으로 강제 리셋한다.

- [ ] **Step 1: 모드 전환 onClick에 정렬 리셋 추가**

Task 1에서 추가한 모드 토글 두 버튼의 onClick을 다음으로 변경:

```jsx
onClick={() => { setViewMode('list'); setSortBy('date'); }}
```
```jsx
onClick={() => { setViewMode('product'); setAggSortBy('amt_desc'); }}
```

- [ ] **Step 2: 초기화 버튼 동작 재검토**

기존 초기화 버튼 onClick은 `setSortBy('date')`만 호출함. 집계 모드에서 초기화 시 `aggSortBy`도 기본값으로 리셋되어야 한다. 약 140번째 줄의 초기화 버튼 onClick을 다음으로 변경:

```jsx
onClick={() => { setFStore(''); setFBrand(''); setFFrom(''); setFTo(''); setFKeyword(''); setSortBy('date'); setAggSortBy('amt_desc'); }}
```

- [ ] **Step 3: 수동 검증**

브라우저 검증 절차:
1. 판매내역 모드에서 정렬을 `매출액↓`로 변경.
2. 상품별 집계 모드로 전환 → 정렬 select이 `매출액 높은순`(기본)으로 표시되는지 확인.
3. 집계 모드에서 정렬을 `상품명순`으로 변경.
4. 판매내역 모드로 전환 → 정렬 select이 `최신순`(기본)으로 표시되는지 확인.
5. 어떤 모드에서든 필터 일부 채운 뒤 ✕ 초기화 클릭 → 모든 필터 빈값, 양 모드 정렬 모두 기본값으로 돌아오는지 확인.

- [ ] **Step 4: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): 모드 전환 및 초기화 시 양쪽 정렬 기본값 리셋"
```

---

## Self-Review Checklist (작업자 본인 확인)

플랜 작성 후 자체 검토. 본 plan 자체 점검 완료:

**1. Spec coverage:**
- 3.1 보기 모드 토글 → Task 1 (정렬 리셋은 Task 5에서 보강)
- 3.2 필터바 → 기존 구조 재사용, Task 3에서 정렬 select 모드 분기, Task 5에서 초기화 보강
- 3.3 상품별 집계 테이블(컬럼/정렬/합계/빈상태) → Task 2~3
- 3.4 드릴다운 모달(헤더/토글/점포별/날짜별/닫기) → Task 4
- 4.1 데이터 소스(기존 select 재사용) → Task 2 (filtered 입력)
- 4.2 필터 적용(서버사이드 store/brand/date + 클라이언트 keyword/return) → 기존 구조 그대로 사용
- 4.3 집계 로직(product_id 그룹핑, fallback, store/branch 복합키, sold_at 그룹핑) → Task 2, Task 4
- 4.4 반품 처리(effQty/effAmt/완전반품 제외) → 기존 함수 재사용
- 5.1 500건 잘림 경고 → Task 2 truncated 플래그, Task 3 배지
- 5.1 product_id null fallback → Task 2 키 생성에서 처리
- 5.1 모달 ESC/외부 클릭 닫기 → Task 4 step 4·5
- 5.2 단일 파일 변경 → 모든 Task가 SalesListPage.jsx만 수정

**2. Placeholder scan:** 모든 step에 실제 코드/명령/검증 절차 포함. "TBD"/"TODO"/"적절한 처리" 등 없음.

**3. Type consistency:**
- `viewMode`: 'list' | 'product' — 모든 Task에서 일관.
- `aggSortBy` 값: 'amt_desc' | 'qty_desc' | 'count_desc' | 'name' — Task 2 정의, Task 3 select 옵션, Task 5 리셋에서 일치.
- `productAgg` 행 shape: {key, product_id, product_name, brand_name, count, qty, amt} — Task 2 정의, Task 3 표 렌더, Task 4 drillProduct 헤더에서 동일 키 사용.
- `drillTab`: 'store' | 'date' — Task 4 정의 및 사용 일치.
- `effQty`/`effAmt`: 기존 함수 재사용, 새로 정의하지 않음.
