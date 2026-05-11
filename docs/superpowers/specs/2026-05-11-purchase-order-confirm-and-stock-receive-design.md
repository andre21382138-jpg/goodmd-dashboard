# 본사 확정 단계 + 매장재고 자동 반영 (Design)

작성일: 2026-05-11
대상 파일:
- `src/pages/order/PurchaseOrderHQPage.jsx`
- `src/pages/order/PurchaseOrderMgrPage.jsx`
관련 메뉴: 본사 → 재고관리 → 발주현황 / 매장 → 재고 관리 → 발주 확인

## 1. 배경 / 목적

현재 발주 워크플로우는 다음과 같다.

```
본사 발주진행(sent) → 매장 발주확인(requested/rerequested) → 본사 엑셀 다운로드 → 매장 입고확인(received)
```

두 가지 누락이 있다.

1. **본사 확정 단계가 없음**: 매장이 `rerequested`(수정 후 재요청)를 보내도 본사가 그 수량을 다시 검토·수정·확정할 단계가 없다. 현재는 매장 요청 그대로 엑셀로 출력되어 본사 통제력이 약하다.
2. **입고확인이 매장재고에 반영 안 됨**: 매장이 입고확인을 눌러도 `store_stock` 테이블이 자동으로 증가하지 않는다. 판매입력 시 자동 차감되는 흐름과 비대칭.

이번 작업으로 `confirmed`라는 새 status를 끼워 본사 확정 단계를 만들고, 입고확인 시 매장재고를 자동 반영한다.

## 2. 사용자 흐름

### 2.1 본사 확정

1. 본사 → 재고관리 → 발주현황 진입.
2. `status='requested'` 또는 `rerequested`인 발주 행 클릭으로 펼침.
3. 펼친 영역에서 각 item의 수량을 input으로 직접 수정 (default = `store_qty` 또는 `hq_qty`).
4. 하단 `✓ 확정` 버튼 클릭 → 모든 item의 `hq_qty`를 사용자 수정값으로 update + order.status='confirmed'.
5. 발주현황 행에 `확정` 배지 표시. 더 이상 편집 불가(read-only).

### 2.2 엑셀 다운로드

기존과 동일하지만 필터가 `status='confirmed' AND exported_at IS NULL`로 변경. 확정된 발주만 다운로드.

### 2.3 매장 입고확인

1. 매장 → 재고 관리 → 발주 확인 → receive 탭.
2. `confirmed` 상태인 발주들이 표시됨 (이전엔 `requested`/`rerequested`).
3. 각 item의 입고 수량 입력 + 확인 → 기존과 동일.
4. **추가**: 입고 처리 완료 시 `store_stock`의 해당 매장+상품 행을 `received_qty`만큼 증가.

## 3. Status 변화

기존:
```
sent → requested/rerequested → received
```

변경 후:
```
sent → requested/rerequested → confirmed → received
        (매장 검토 + 응답)        (본사 확정)   (매장 입고)
```

새 status 값: `confirmed`. text 컬럼이므로 DB 스키마 변경 없음.

## 4. UI 사양

### 4.1 본사 발주현황 페이지 — 발주 펼침 영역

**기존 (read-only 표시)**:
- 컬럼: 상품명 / 코드 / 판매수량 / 본사 발주 / 매장 요청 / 변동 / 입고확인

**변경 후 (조건부 편집)**:

상태별로 다른 모드 표시:

| status | 모드 |
|---|---|
| `requested` / `rerequested` | **편집 가능** — 본사 발주 수량을 input으로 수정 가능 + 하단에 `✓ 확정` 버튼 |
| `confirmed` / `received` | **read-only** — 기존 표시 그대로 |

편집 모드에서 본사 수량 input은 매장 요청 수량(`store_qty`)을 default로 채움 (`store_qty == null`이면 `hq_qty`).

`✓ 확정` 클릭 시:
- 모든 item의 `hq_qty := input value`로 update
- `purchase_orders.status := 'confirmed'`
- `updated_at := NOW()`
- toast "발주 확정 완료" + 펼침 닫고 fetchOrders 새로고침

### 4.2 본사 발주현황 status 배지

기존 STATUS_LABEL에 추가:
```js
confirmed: { label:'확정', color:'#bf360c', bg:'#fff3e0', border:'#ffcc80' },
```

### 4.3 본사 발주현황 엑셀 다운로드 필터

`exportPurchaseOrders` 함수 내 fetch query 변경:

기존:
```jsx
.in('status', ['requested', 'rerequested'])
.is('exported_at', null)
```

변경 후:
```jsx
.eq('status', 'confirmed')
.is('exported_at', null)
```

`handleExport`의 preview query도 동일하게 변경.

### 4.4 매장 발주확인 페이지

**STATUS_LABEL 추가** (HQ와 동일 라벨, 다른 색상 가능):
```js
confirmed: { label:'본사 확정',   color:'#bf360c', bg:'#fff3e0', border:'#ffcc80' },
```

**탭별 필터 변경**:

```js
const filterStatuses = tab === 'check'
  ? ['sent']                              // 기존: ['sent','requested','rerequested']
  : ['confirmed', 'received'];            // 기존: ['requested','rerequested','received']
```

- **check 탭**: `sent`만 (매장이 응답해야 할 신규 발주). 응답한 `requested`/`rerequested`는 더 이상 check 탭에 안 보임 — 본사의 확정 대기 상태.
- **receive 탭**: `confirmed` (입고 대기) + `received` (이미 받음).

이로써 매장은 본사가 확정한 발주만 입고할 수 있다.

### 4.5 매장 입고확인 시 store_stock 자동 반영

기존 `handleReceive` (PurchaseOrderMgrPage.jsx)에 추가:

기존 흐름:
```js
// 1. items.received_qty / received_ok 업데이트
// 2. order.status = 'received'
```

변경 후 (1과 2 사이에):
```js
// 1.5. 각 아이템마다 store_stock에서 received_qty만큼 증가
for (const it of (order.items||[])) {
  const recv = Number(recvMap[it.id]?.qty) || 0;
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
  // stockRow 없으면 무시 (현재는 신규 insert 안 함 — 비목표 §8)
}
```

판매입력의 store_stock 차감 로직(`src/pages/sales/SalesInputPage.jsx`)의 거울 패턴이라 코드 구조 일관성 유지.

## 5. 데이터 처리 정리

| 단계 | 변경되는 컬럼 |
|---|---|
| 본사 발주진행 | `purchase_orders` insert (status='sent') + `purchase_order_items` insert (hq_qty 입력) |
| 매장 그대로요청 | `items.store_qty := hq_qty` + `orders.status := 'requested'` |
| 매장 재요청 | `items.store_qty := 입력값` + `orders.status := 'rerequested'` |
| **본사 확정** (신규) | `items.hq_qty := 입력값` + `orders.status := 'confirmed'` |
| 엑셀 다운로드 | `orders.exported_at := NOW()` (수량은 `hq_qty` 사용) |
| 매장 입고확인 | `items.received_qty/received_ok` + `orders.status := 'received'` + **`store_stock.stock_qty += received_qty`** (신규) |

## 6. 회귀 영향 / 안전성

- `confirmed` status는 신규 값. 기존 데이터는 영향 없음.
- 기존 발주(`requested`/`rerequested` 상태로 남아있는 경우): 매장 페이지에서 check 탭에 더 이상 안 보이고, receive 탭에도 안 보임 → "잊혀질" 위험. 보통 이런 발주는 본사가 확정·다운로드 처리하므로 자연 해소되지만, 기존 데이터 정리는 user 책임.
- 엑셀 다운로드 필터 변경: 이전에 `requested`/`rerequested`로 묶어 다운받던 흐름은 더 이상 작동 안 함. 확정 단계 필수.
- 입고확인 시 store_stock 미존재 product는 무시 → 기존 동작 변경 없음 (insert 안 함).

## 7. 비목표 (Out of Scope)

- 확정 후 un-confirm (`confirmed` → `requested`/`rerequested` 되돌리기) — SQL 직접 수정만.
- 부분 확정 (item별 다른 status).
- `store_stock`에 매장×상품 행이 없을 때 자동 insert.
- 본사가 확정 시 차이 미리보기/검토 UI.
- 매장 입고확인 시 received_qty와 hq_qty 차이 detect 알림.
- 다중 라운드(매장→본사→매장→본사 ping-pong) — 1라운드만 지원.
- 재고 트랜잭션/감사 로그(stock_logs 등) 추가.
