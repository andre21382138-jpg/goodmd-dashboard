# 매장에서 발주확인 시 상품 추가 요청 (Design)

작성일: 2026-05-11
대상 파일:
- `src/pages/order/PurchaseOrderMgrPage.jsx`
- `src/pages/order/PurchaseOrderHQPage.jsx`
관련 메뉴: 매장 → 재고관리 → 발주 확인 / 본사 → 재고관리 → 발주현황

## 1. 배경 / 목적

현재 발주 워크플로우는 본사가 보낸 상품 목록을 매장이 받아 수량만 수정·요청할 수 있다. 매장이 "본사가 빠뜨린 상품"이나 "추가로 더 필요한 상품"을 같이 요청하려면 별도 채널(전화/카톡)로 본사에 알려야 하고, 시스템에 흔적이 남지 않는다.

매장이 발주확인 단계에서 시스템의 모든 상품 중 임의 상품을 골라 수량과 함께 추가 요청할 수 있게 한다. 본사는 확정 단계에서 이 추가 라인을 일반 라인과 동일하게(또는 거부/수정해서) 처리할 수 있다.

## 2. 사용자 흐름

1. 매장 → 재고관리 → 발주 확인 진입 (`발주 확인` 탭).
2. `status='sent'`인 발주 행 펼침.
3. 본사가 보낸 상품 표가 보임 + 표 마지막에 인라인 "+ 상품 추가" 입력행.
4. 매장이 입력행에서 상품명/코드로 검색 → 드롭다운에서 상품 선택 → 수량 입력 → `+ 추가` 버튼.
5. 표 마지막에 매장추가 라인이 노란색 배경 + `🆕 매장추가` 배지로 추가됨.
6. 여러 개 추가 가능. 잘못 추가한 라인은 `✕` 버튼으로 즉시 삭제(아직 DB 저장 전이므로 state에서만 제거 — 아래 §3 참조).
7. 매장이 `그대로 발주요청` 또는 `수정 후 재요청` 클릭 시 매장추가 라인도 같이 DB에 insert됨.
8. 본사 발주현황에서 `status='requested'`/`rerequested` 발주 펼침 시 매장추가 라인이 `🆕 매장 추가` 배지와 함께 일반 라인 아래에 표시. 본사는 동일하게 수량 input으로 편집(0으로 거부 가능) + 확정.

## 3. 데이터 모델

새 컬럼 추가 없음 (text/숫자 컬럼만으로 식별).

**매장추가 라인 식별 규칙**: `hq_qty = 0 AND store_qty > 0`
- 본사가 보낸 정상 라인은 `hq_qty > 0`
- 매장이 추가한 라인은 본사가 안 보냈으므로 `hq_qty = 0`
- 본사 확정 단계에서 본사가 hq_qty를 0보다 큰 값으로 바꾸면 일반 라인이 됨 — 식별은 "응답 시점"이 아닌 "현재 컬럼 값"으로 하되, 매장추가 배지는 본사가 한번이라도 확정한 라인은 더 이상 표시하지 않아도 됨 (요청 단계에서만 의미)

**State 관리 (매장 펼침 영역)**: 추가 라인은 즉시 DB insert하지 않고 state에 임시 보관.
```js
// 기존: editMap = { itemId: qty }
// 추가: addedItems = [ { tempId, product_id, name, code, qty } ]
```
- "+ 추가" → addedItems에 push
- "✕" 삭제 → addedItems에서 제거
- "그대로 발주요청" / "수정 후 재요청" 클릭 시:
  - 기존 라인들: store_qty update (기존 동작)
  - addedItems: 새 purchase_order_items row insert
- 펼침 닫기 / 페이지 이동: 입력 사라짐(저장 안 됨)

**insert되는 새 row 컬럼**:
```
purchase_order_id = 기존 order.id
product_id        = 선택한 상품
sold_qty          = 0
hq_qty            = 0   ← 식별자
store_qty         = 매장 입력 수량
```
created_at/updated_at은 DB default.

## 4. UI 사양

### 4.1 매장 발주확인 — 펼침 영역 표 하단

기존 표 마지막 라인 다음에 추가 입력행 (status='sent'일 때만):

```
┌─ 표 ────────────────────────────────────────────────────────┐
│ 상품명    | 코드 | 지난주판매 | 본사발주 | 요청 수량         │
├──────────┼──────┼───────────┼─────────┼───────────────────┤
│ 슬리퍼   │ A001 │     8     │   10    │ [10]              │
│ 양말     │ A002 │     3     │    5    │  [5]              │
│ (매장추가)신상품 │ NEW1 │  -  │   -    │  [3]    [✕]      │ ← 노란배경
├──────────┴──────┴───────────┴─────────┴───────────────────┤
│ + 상품 추가: [검색...▼] 수량[ ] [+ 추가]                   │ ← 회색 배경 input행
└────────────────────────────────────────────────────────────┘
```

검색 UX:
- input에 2글자 이상 입력 시 supabase에서 products 검색 (name ilike or code ilike)
- debounce 300ms, 상위 10개 결과 드롭다운
- 이미 표에 있는 product_id(본사 라인 + addedItems)는 검색 결과에서 회색 + "이미 있음" 표시 (선택 불가)
- 결과 선택 → input 닫고 수량 input에 focus

수량 input 기본값: 빈칸 (0 강요는 안 함). 수량 > 0이고 상품 선택된 상태에서만 `+ 추가` 버튼 활성.

매장추가 라인 표시:
- 배경 `#fffde7` (연한 노랑)
- 상품명 좌측에 `🆕` 작게 또는 우측에 작은 `매장추가` 배지
- 지난주 판매 / 본사 발주 컬럼은 `-` 표시
- 요청 수량 input은 `addedItems[i].qty`에 직접 binding (editMap 아님 — DB id가 없으므로 state 분리)
- 우측 끝에 `✕` 삭제 버튼 (addedItems에서 해당 entry 제거)

### 4.2 응답 처리

**`handleRequestAsIs(order)` 변경**:
```js
// 기존: 모든 item의 store_qty = hq_qty로 update
// 변경: 기존 item만 store_qty = hq_qty로 update + addedItems insert
const itemUpdates = (order.items||[]).map(it =>
  supabase.from('purchase_order_items').update({ store_qty: it.hq_qty }).eq('id', it.id)
);
const itemInserts = addedItems.map(a => supabase.from('purchase_order_items').insert({
  purchase_order_id: order.id,
  product_id: a.product_id,
  sold_qty: 0, hq_qty: 0, store_qty: Number(a.qty)||0,
}));
await Promise.all([...itemUpdates, ...itemInserts]);
```

**`handleRerequest(order)` 변경**:
```js
// 기존: editMap[it.id]로 store_qty update
// 변경: 동일 + addedItems insert
```
addedItems 처리는 위와 동일. 기존 item은 editMap 값 사용.

### 4.3 본사 발주현황 — 매장추가 라인 표시

기존 펼침 표에 `hq_qty === 0 && store_qty > 0`인 라인은 `🆕 매장 추가` 배지를 상품명 우측에 inline 표시. 라인 자체는 일반 라인과 동일하게 수량 input + 확정 가능.

본사 확정 시:
- hq_qty input을 수정하면 그대로 update (0이면 사실상 무시되는 라인)
- 0으로 두면 엑셀 다운로드에서 해당 라인은 출력 안 됨 (양식이 수량 0을 의미 없게 처리)
- 또는 본사가 0으로 확정하면 confirm 단계에서 자동으로 row delete까지 할지는 비목표 (§7 참조)

## 5. 회귀 영향

- 기존 데이터: `hq_qty > 0`이므로 식별 규칙에 걸리지 않음 → 변경 없음.
- 본사 발주진행 페이지: 변경 없음 (매장이 추가하는 흐름만 영향).
- 본사 발주현황: 펼침 표에 배지만 추가 표시. 확정 흐름 동일.
- 입고확인: 동일하게 처리. 매장추가 라인이 confirmed 상태로 받아진 경우 정상적으로 received_qty 입력 가능 + store_stock 자동 반영.
- 엑셀 다운로드: hq_qty>0인 라인만 출력하는 기존 동작 — 본사가 매장추가 라인을 확정하면 hq_qty>0이 되므로 정상 포함. 본사가 0으로 두면 출력 안 됨.

## 6. 검색 쿼리 패턴

```js
const { data } = await supabase.from('products')
  .select('id, name, code')
  .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
  .limit(10);
```

브랜드 필터/매장 취급여부 필터 없음(모든 products 검색).

## 7. 비목표 (Out of Scope)

- 매장이 응답한 후(`requested`/`rerequested`) 추가 라인 더 추가 — sent 상태에서만.
- 신상품 등록 (products에 없는 상품은 추가 불가).
- 본사가 확정 시 hq_qty=0인 라인을 자동 row delete (현재는 store_qty만 남고 hq_qty=0인 상태로 DB에 잔존; 양식 출력은 0 라인 제외하므로 무해).
- 매장추가 라인에 대한 `지난주 판매` 자동 계산 (수동 입력 0 고정).
- 매장이 동일 상품을 본사 라인 + 매장추가로 함께 보내는 경우 — 같은 product_id는 추가 검색 결과에서 차단(중복 방지).
- "이 발주에 임의로 N개 추가" 같은 본사 측 추가 기능 (필요시 별도 spec).
