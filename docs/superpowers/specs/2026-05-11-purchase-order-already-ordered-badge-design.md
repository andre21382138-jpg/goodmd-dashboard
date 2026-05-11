# 발주진행 탭에 "발주 완료" 표시 (Design)

작성일: 2026-05-11
대상 파일: `src/pages/order/PurchaseOrderHQPage.jsx`
관련 메뉴: 본사 → 재고관리 → 발주진행

## 1. 배경 / 목적

발주진행 탭은 매번 `sales` 테이블의 지난주 판매 데이터를 새로 집계해 표시한다. 본사가 같은 주에 두 번 들어가면 이미 발주(`purchase_orders`)된 라인도 일반 라인과 똑같이 보여 **중복 발주가 발생할 위험**이 있다. 시스템이 막아주지 않는다.

이미 발주된 라인을 시각적으로 구분하고 체크/편집 불가능하게 만들어 중복 발주를 방지한다.

## 2. 사용자 흐름

1. 본사 → 재고관리 → 발주진행 진입.
2. 시스템이 지난주 판매 집계 + 같은 주(week_start/week_end)에 이미 발주된 라인 fetch.
3. 표 렌더 시 각 라인을 두 가지 모드로:
   - **미발주**: 체크박스 + 수량 input 정상
   - **발주 완료**: 체크박스 비활성, 수량 input read-only, `📋 발주 완료` 배지 표시
4. 전체 선택 / 전체 해제 버튼은 미발주 라인만 토글.
5. 발주 진행 버튼 클릭 시 `alreadyOrdered=true` 라인은 자동 제외.

## 3. 매칭 기준

- 키: `(store_name, branch_name, product_id)` + `week_start = fFrom AND week_end = fTo`
- 매칭되는 `purchase_order_items` 행이 하나라도 있으면 `alreadyOrdered = true`
- status 무관 (sent/requested/rerequested/confirmed/received 전부 "발주됨"으로 간주)

## 4. 데이터 fetch 변경

`fetchAggregation`에 추가 query:

```js
const { data: existing } = await supabase.from('purchase_orders')
  .select('store_name, branch_name, items:purchase_order_items(product_id)')
  .eq('week_start', fFrom)
  .eq('week_end', fTo);
```

클라이언트에서 Set 빌드:

```js
const orderedKeys = new Set();
for (const o of (existing || [])) {
  for (const it of (o.items || [])) {
    orderedKeys.add(`${o.store_name}|${o.branch_name}|${it.product_id}`);
  }
}
```

기존 `aggRows` 빌드 후 각 item에 `alreadyOrdered` 플래그 추가:

```js
const items = [...grp.items.values()]
  .sort((a,b) => (a.name||'').localeCompare(b.name||''))
  .map(it => ({
    ...it,
    hq_qty: it.sold_qty,
    checked: !orderedKeys.has(`${grp.store}|${grp.branch}|${it.product_id}`), // 발주 완료면 초기 unchecked
    alreadyOrdered: orderedKeys.has(`${grp.store}|${grp.branch}|${it.product_id}`),
  }));
```

## 5. UI 변경

### 5.1 라인 row

기존 체크박스 셀(약 287-292행 부근):

```jsx
<td style={{textAlign:'center'}}>
  <input type="checkbox" checked={it.checked}
    onChange={() => toggleItem(sk, it.product_id)}
    style={{cursor:'pointer'}}/>
</td>
```

다음으로 변경:

```jsx
<td style={{textAlign:'center'}}>
  {it.alreadyOrdered ? (
    <span title="이미 발주된 라인" style={{fontSize:14}}>📋</span>
  ) : (
    <input type="checkbox" checked={it.checked}
      onChange={() => toggleItem(sk, it.product_id)}
      style={{cursor:'pointer'}}/>
  )}
</td>
```

수량 input (약 368-372행 부근):

```jsx
<input type="number" min={0} value={it.hq_qty}
  onChange={e => updateQty(sk, it.product_id, e.target.value)}
  style={{...inputStyle, width:90, height:30, textAlign:'right', fontWeight:700}}/>
```

다음으로 변경 (alreadyOrdered면 disabled):

```jsx
<input type="number" min={0} value={it.hq_qty}
  onChange={e => updateQty(sk, it.product_id, e.target.value)}
  disabled={it.alreadyOrdered}
  style={{...inputStyle, width:90, height:30, textAlign:'right', fontWeight:700,
    background: it.alreadyOrdered ? '#f5f5f5' : '#fff',
    color: it.alreadyOrdered ? 'var(--text3)' : 'var(--text)'}}/>
```

상품명 옆 또는 별도 셀에 배지 추가 (상품명 td 안에 inline):

```jsx
<td>
  {it.name}
  {it.alreadyOrdered && (
    <span style={{marginLeft:6, fontSize:10, fontWeight:700, padding:'2px 8px',
      background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', borderRadius:4}}>
      📋 발주 완료
    </span>
  )}
</td>
```

### 5.2 전체 선택 / 해제

`toggleStore(storeKey, on)` 함수와 `toggleAll(on)` 함수 모두 `alreadyOrdered` 라인은 건드리지 않도록 변경. 체크 토글 시 `it.alreadyOrdered`이면 그대로 둠.

```js
const toggleStore = (storeKey, on) => {
  setAggRows(prev => prev.map(g => {
    if (`${g.store}|${g.branch}` !== storeKey) return g;
    return { ...g, items: g.items.map(it => it.alreadyOrdered ? it : { ...it, checked: on }) };
  }));
};
const toggleAll = (on) => {
  setAggRows(prev => prev.map(g => ({
    ...g,
    items: g.items.map(it => it.alreadyOrdered ? it : { ...it, checked: on })
  })));
};
```

### 5.3 단일 체크박스 클릭

`toggleItem(storeKey, pid)`도 동일하게 `alreadyOrdered`면 무시. 단, 체크박스 자체가 렌더링 안 되므로(5.1 참고) 사실상 호출 안 됨. 방어적으로 추가.

## 6. 제출 동작

`handleSubmitOrders`에서 자동 필터 (이중 안전망):

기존:
```js
const checkedGroups = aggRows
  .map(g => ({ ...g, items: g.items.filter(i => i.checked && i.hq_qty > 0) }))
  .filter(g => g.items.length > 0);
```

다음으로:
```js
const checkedGroups = aggRows
  .map(g => ({ ...g, items: g.items.filter(i => i.checked && i.hq_qty > 0 && !i.alreadyOrdered) }))
  .filter(g => g.items.length > 0);
```

## 7. 회귀 영향

- 발주현황 탭은 변경 없음.
- 매장 발주확인 페이지 변경 없음.
- 기존 `sent`/`requested`/`rerequested`/`confirmed`/`received` 발주 모두 "발주 완료"로 동일 처리 — status 구분 없이.
- 같은 주에 같은 매장×상품을 두 번 발주하던 회귀 케이스가 막힘.

## 8. 비목표 (Out of Scope)

- 발주 완료된 라인에 마우스 호버 시 "어느 발주에서, 어떤 status로" 상세 표시.
- "이미 발주된 라인 숨기기" 토글 (지금은 항상 표시).
- 다른 주(week)의 발주 이력 매칭 (현재 fFrom/fTo로 정확히 일치하는 경우만).
- 매뉴얼 추가 상품(`manual: true`)에 대한 발주 완료 검사 (`product_id`가 같으면 자동 매칭됨).
