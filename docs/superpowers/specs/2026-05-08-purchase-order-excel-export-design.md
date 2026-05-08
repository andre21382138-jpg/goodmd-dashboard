# 발주서 엑셀 다운로드 (Phase 2) Design

작성일: 2026-05-08
대상 파일:
- `src/pages/order/PurchaseOrderHQPage.jsx`
- `src/lib/constants.js`
관련 메뉴: 본사 → 재고관리 → **발주진행 / 발주현황**

## 1. 배경 / 목적

본사는 매주 다음 워크플로우로 발주를 진행한다.

1. **본사 발주진행** (PurchaseOrderHQPage 발주진행 탭): 지난주 매장별 판매 집계 → 매장별 발주안 작성 → DB insert (`purchase_orders.status='sent'`)
2. **매장 발주확인** (PurchaseOrderMgrPage check 탭): 본사 발주안 검토 → "그대로 발주요청"(status='requested') 또는 수정 후 "재요청"(status='rerequested')
3. **본사 발주현황** (PurchaseOrderHQPage 발주현황 탭): 매장 요청 받은 발주들을 외부 택배 시스템에 업로드할 xlsx로 다운로드 ← **이번 스펙의 범위**
4. (이후) 매장 입고 확인(`status='received'`)

3단계의 외부 양식은 31컬럼짜리 매장발주 양식으로, 모든 매장의 모든 상품 라인이 한 파일에 합쳐져 택배사 일괄 업로드 용도로 사용된다. 현재 시스템엔 1·2·4단계는 구현되어 있고 3단계만 빠져 있다.

## 2. 사용자 흐름

1. 본사 → 재고관리 → 발주현황 진입.
2. 매장에서 발주요청 완료된 발주들 목록 표시 (기존 동작).
3. 상단의 `📥 매장발주 엑셀 다운로드` 버튼 클릭.
4. 시스템이 `status IN ('requested','rerequested') AND exported_at IS NULL` 인 발주들을 묶어 한 xlsx 파일 생성·다운로드.
5. 다운로드 즉시 해당 발주들의 `exported_at = NOW()` 설정 → 다음 다운로드에서는 자동 제외.
6. 발주현황 표에 해당 발주들이 "✓ 출하됨" 배지로 표시.

## 3. UI 사양

### 3.1 다운로드 버튼

발주현황 탭의 상단(필터/조회 버튼 영역) 우측에 추가:

```
[ 📥 매장발주 엑셀 다운로드 ]
```

- 다운로드 가능한 발주가 0건이면 disabled + 툴팁 "다운로드 대상 없음".
- 진행 중에는 spinner + disabled.

### 3.2 다운로드 직전 확인

매장 마스터 정보(`store_addresses`) 미등록 매장이 포함되면 confirm:

```
⚠️ N개 매장 마스터 정보 미설정 (예: AK백화점/분당점, ...)
빈 셀로 다운로드하시겠습니까?
[취소] [확인]
```

- 취소 시: 매장주소정보 메뉴로 안내 토스트.
- 확인 시: 진행.

마스터 정보 모두 OK면 confirm 없이 즉시 다운로드.

### 3.3 발주현황 표시 변경

기존 status 컬럼/배지 옆에:
- `exported_at IS NOT NULL` 인 발주: `✓ 출하됨 (yyyy-mm-dd HH:MM)` 작은 배지.
- 그 외: 표시 없음.

## 4. DB 스키마 변경

```sql
ALTER TABLE purchase_orders ADD COLUMN exported_at TIMESTAMPTZ;
CREATE INDEX idx_purchase_orders_exported ON purchase_orders(exported_at) WHERE exported_at IS NULL;
```

부분 인덱스로 미출하 건 빠르게 조회.

## 5. 데이터 처리

### 5.1 다운로드 fetch

```sql
SELECT po.id, po.store_name, po.branch_name,
       sa.shopping_mall_id, sa.postal_code, sa.address, sa.recipient_phone,
       poi.id as item_id, poi.product_id, poi.hq_qty, poi.store_qty,
       p.name AS product_name, p.erp_code, p.code AS product_code
FROM purchase_orders po
JOIN purchase_order_items poi ON poi.order_id = po.id
JOIN products p ON p.id = poi.product_id
LEFT JOIN store_addresses sa ON sa.store_name = po.store_name AND sa.branch_name = po.branch_name
WHERE po.status IN ('requested','rerequested')
  AND po.exported_at IS NULL
ORDER BY po.store_name, po.branch_name, p.name;
```

JS 측에서는 Supabase JS의 nested select로 동등 결과 fetch:

```js
supabase.from('purchase_orders')
  .select('id, store_name, branch_name, items:purchase_order_items(id, product_id, hq_qty, store_qty, product:products(name, erp_code, code))')
  .in('status', ['requested','rerequested'])
  .is('exported_at', null)
  .order('store_name', { ascending: true })
  .order('branch_name', { ascending: true });
```

`store_addresses` 매칭은 별도 fetch + Map 조인.

### 5.2 라인 생성 / 주문번호

`(store_name, branch_name)` 정렬 후 각 발주의 items도 product name 정렬. 한 라인 = 한 (매장, 상품) 발주.

순번은 라인 위치 인덱스(0부터) → `yyyymmdd-NNNN` (발송일 + 4자리). 예: 1번째 라인 `20260508-0001`.

### 5.3 수량 결정

- `store_qty`가 NULL이 아니면 그 값 사용 (매장이 수정한 수량 또는 그대로요청 후 hq_qty로 set한 값).
- `store_qty`가 NULL이면 `hq_qty` 사용 (방어).

(그대로요청 시 매니저 페이지에서 `store_qty := hq_qty`로 설정하므로 정상 흐름에서는 NULL이 거의 없음.)

### 5.4 다운로드 후 처리

```js
const orderIds = filteredOrders.map(o => o.id);
await supabase.from('purchase_orders')
  .update({ exported_at: new Date().toISOString() })
  .in('id', orderIds);
```

이후 `fetchOrders()`로 화면 새로고침.

## 6. 엑셀 양식 (31컬럼, 매장발주 파일과 동일)

### 6.1 컬럼 매핑

| 컬럼 | 출처 / 값 |
|---|---|
| A 발송일 | `new Date()` (오늘) — Date 객체, `numFmt: yyyy-mm-dd` |
| B 송장번호 | 상수 `유통2팀` |
| C 주문번호 | 자동 생성 `yyyymmdd-NNNN` |
| D 채널 | 상수 `기타_유통2팀_매장발주` |
| E 매장명 | `store_addresses.shopping_mall_id` (없으면 빈) |
| F 수취인명 | E와 동일 |
| G 결제금액 | 상수 `0` |
| H 주문수량 | 상수 `1` |
| I 상품명 | 빈 |
| J 옵션 | 빈 |
| K 품명 | `products.name` |
| L 수취인명 | E와 동일 |
| M 우편번호 | `store_addresses.postal_code` (없으면 빈) |
| N 주소 | `store_addresses.address` (없으면 빈) |
| O 수취인 천화번호1 | `store_addresses.recipient_phone` (없으면 빈) |
| P 수취인 전화번호2 | 빈 |
| Q 배송메세지 | 빈 |
| R 상품번호 | 빈 |
| S 주문자명 | 상수 `한국생활건강(팔레오본사)` |
| T 주문자 연락처1 | 상수 `070-5117-5677` |
| U 주문자 연락처2 | 상수 `070-5117-5677` |
| V~AC | 빈 (수수료/공란/사방넷 등 택배사 채움 영역) |
| AD ERP코드 | `products.erp_code` (없으면 빈) |
| AE 수량 | `store_qty` 또는 `hq_qty` |
| AF~ | 빈 (택배사 채움) |

### 6.2 상수 정의

`src/lib/constants.js`에 추가:

```js
export const ORDER_CONSTANTS = {
  TRACKING_LABEL: '유통2팀',
  CHANNEL: '기타_유통2팀_매장발주',
  ORDERER_NAME: '한국생활건강(팔레오본사)',
  ORDERER_PHONE: '070-5117-5677',
};
```

### 6.3 라이브러리 / 스타일

- `exceljs` 동적 import (`SafetyTab.jsx`, `SalesListPage.jsx` 패턴 동일).
- 시트명: `매장발주`.
- 헤더 행: 굵은 글씨, 가벼운 회색 배경 (양식의 시각 디테일 100% 일치는 비목표 — 데이터 정확성 우선).
- 매출일자 셀: Date 객체 + `yyyy-mm-dd` 서식.
- 숫자 셀: 우측 정렬, 천 단위 콤마 적용 안 함 (택배사 양식이 raw number).

### 6.4 파일명

`매장발주_{yyyy-mm-dd}.xlsx` — 오늘 날짜.

## 7. 회귀 영향 / 안전성

- 기존 발주진행 / 매장 발주확인 / 입고 확인 flow는 미변경.
- `exported_at` 컬럼 추가는 nullable 기본값 NULL이므로 기존 행에 영향 없음.
- 다운로드 후 status는 변경되지 않음 (여전히 `requested`/`rerequested`). 입고 확인 시 `received`로 전환되는 기존 흐름 유지.

## 8. 비목표 (Out of Scope)

- 발송일 직접 선택 / 미래 발송일 / 과거 발송일 (오늘 자동만).
- 매장별 개별 다운로드 (한 번에 묶기만 지원).
- 체크박스로 일부만 선택해서 다운로드.
- 재다운로드 / 출하 취소 (`exported_at` reset).
- 양식의 폰트·셀 색상·행 높이 100% 일치.
- 매장 마스터 미설정 시 자동 차단 (현재는 confirm으로 진행 가능).
- 다운로드 이력 별도 페이지.
