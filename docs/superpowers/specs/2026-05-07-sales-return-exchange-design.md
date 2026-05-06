# 반품 교환 통합 처리 (Design)

작성일: 2026-05-07
대상 파일: `src/pages/sales/SalesReturnPage.jsx` + `src/lib/constants.js` + `src/pages/sales/SalesListPage.jsx`
관련 메뉴: 매니저 → 반품 접수 → **반품 교환** (key=`sales_return` 유지)

## 1. 배경 / 목적

매장에서는 고객이 A 상품을 구매한 뒤 다른 상품 B로 교환하는 경우가 빈번하다. 현재 시스템은 반품만 지원하므로, 교환은 매니저가 "반품 + 별도 판매입력"을 두 번 처리해야 하고 차액 추적이 어려우며 외부 결산 양식의 `정상(교환)` 전표유형을 채울 수 없다.

반품접수 페이지를 **반품 교환** 페이지로 확장해 라인별로 반품/교환을 선택할 수 있게 한다. 회원 적립금·등급·재고 자동 조정을 그대로 활용하면서 교환 차액 결제까지 한 화면에서 처리한다. DB에 `exchange_from_sale_id` 컬럼을 추가해 교환 이력을 추적하고, 매장매출 외부 양식 다운로드에서 `정상(교환)` 전표유형으로 매핑한다.

## 2. 사용자 흐름

1. 매장 매니저가 사이드바 → ↩️ **반품 교환** 진입.
2. 기존과 동일하게 날짜/고객으로 주문 조회 → 행 클릭으로 펼침.
3. 펼친 상품 목록의 각 행에서 모드 선택:
   - `반품` (기본): 반품 수량 입력 → 기존 동작.
   - `교환`: 행 아래에 확장 영역이 펼쳐짐. 새 상품(B) 검색·선택 → 차액 자동 계산 → 차액 결제 방법 선택.
4. 한 주문에서 일부 라인은 반품, 다른 라인은 교환을 동시에 처리 가능.
5. 미리보기에서 환불·차액·신규 적립 합계 확인.
6. **반품 교환 처리** 버튼 클릭 → 한 번의 트랜잭션으로 일괄 처리.

## 3. UI 사양

### 3.1 메뉴 이름

`src/lib/constants.js`의 `MANAGER_MENUS`에서:

```js
{ key: 'sales_return', icon: '↩️', label: '반품 접수' }
```

→ `label: '반품 교환'`로 변경. 아이콘과 key는 유지.

### 3.2 페이지 헤더

탭 이름과 카드 라벨을 `반품 교환`으로 통일:
- 탭 1: `반품접수` → `반품 교환`
- 탭 2: `직접입력` (그대로, 교환 미지원)
- 카드 label: `반품 접수` → `반품 교환`

### 3.3 상품 목록 표

기존 컬럼(브랜드 / 상품명·코드 / 판매수량 / 이미반품 / 잔여 / 단가 / 합계 / 적립금사용 / 결제 / 반품 수량)에 좌측 끝에 **모드 컬럼** 추가:

| 모드 | 브랜드 | 상품명 | 판매수량 | … | 반품/교환 수량 |
|---|---|---|---|---|---|
| ⚪반품 / ⚪교환 | … | … | … | … | … |

- 모드는 라디오 버튼 2개. 기본값 `반품`.
- 모드를 `교환`으로 바꾸면 해당 라인의 `반품 수량` 라벨이 `교환 수량`으로 표시되고, 아래로 확장 영역이 펼쳐진다.
- 한 주문 내 라인별로 다른 모드를 선택 가능.

### 3.4 교환 확장 영역

```
교환 → 새 상품
  [상품 검색: 상품명 또는 상품코드 _________________]
  단가: [70,000]    수량: 2 (A의 교환 수량과 동일, 읽기 전용)
  ───
  차액: 50,000 × 2 → 70,000 × 2 = +40,000원 (추가 결제 필요)
  결제 방법: [카드] [현금] [적립금사용]
```

상품 검색 UI는 `SalesInputPage.jsx`의 자동완성 드롭다운 패턴을 그대로 가져온다(상품명/코드/ERP 코드 부분일치, 최대 10개, [단종] 후순위).

### 3.5 차액 처리

라인별 차액 = `B_단가 × 교환수량 - A_단가 × 교환수량`.

| 차액 | 표시 | 결제 방법 옵션 |
|---|---|---|
| > 0 | `추가 결제: +X원` | 카드 / 현금 / 적립금사용 |
| < 0 | `차액 환불: -X원` | 현금 / 카드취소 |
| = 0 | `차액 없음` | (선택 불필요) |

`적립금사용` 선택 시: 선택된 회원이 사용 가능 적립금이 충분해야 함(검증). 차액만큼 회원 적립금에서 차감.
`현금` / `카드취소` 환불은 시스템상 표시만(실물 환불은 매장에서 처리). 적립금사용으로 차감된 부분은 별도로 회원 적립금에 자동 복구.

### 3.6 미리보기 영역 확장

기존 반품 미리보기에 교환 합계 추가:

```
환불 금액(반품): 30,000원
복구 적립금: 3,000원
회수 적립금: 3,000원
───
교환 차액 합계: +20,000원 (카드 1건)
교환 신규 적립: +500원
```

- 교환 차액 합계는 라인별 차액의 합. 부호별로 분리해서 보여주는 것도 가능 (예: `+30,000 / -10,000`). 단순화를 위해 net 합계만 표시하되 결제 방법 건수는 별도 표기.
- 교환 신규 적립: 회원이 있는 경우 B 매출에 대한 적립금 누적 (회원 등급 기준).

### 3.7 처리 버튼

- 라벨: `반품 교환 처리 (N개)` — N은 반품 수량 + 교환 수량 합.
- confirm 메시지에 반품/교환 분리 합계 표시.

## 4. DB 스키마 변경

### 4.1 컬럼 추가

```sql
ALTER TABLE sales
  ADD COLUMN exchange_from_sale_id BIGINT
  REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_exchange_from ON sales(exchange_from_sale_id);
```

기존 데이터: 모두 NULL.

### 4.2 의미

- A 행: 일반 sale 그대로. 교환되면 `returned_qty`가 증가하고, 그 뒤로는 `exchange_from_sale_id`를 가진 B 행이 별도 존재.
- B 행: `exchange_from_sale_id = A.id`, `payment = 차액 결제 방법` 또는 차액 0이면 임의값(예: `카드`)으로 두되 매장매출 매핑에서 `정상(교환)`로 처리되므로 영향 없음.

## 5. 처리 로직

### 5.1 통합 처리 함수

`handleReturn` (이후 이름은 그대로 유지)이 라인별 mode에 따라 분기:

**반품 라인** (`mode='반품'`, `qty > 0`): 기존 로직 그대로.

**교환 라인** (`mode='교환'`, `qty > 0`, `B_product_id` 선택됨):
1. A의 `returned_qty` 증가 (반품과 동일).
2. A 재고 복구 (`store_stock` +qty).
3. B 매출 row insert:
   - `sold_at` = A의 `sold_at` (교환은 원본 판매일 기준)
   - `store_name`, `branch_name` = profile
   - `brand_id` = B.brand_id
   - `product_id` = B.id
   - `quantity` = 교환수량
   - `price` = B 단가
   - `payment` = 차액 결제 방법 (또는 차액 0이면 `카드`)
   - `exchange_from_sale_id` = A.id
   - `customer_id` = A.customer_id (그대로 승계)
   - `points_used` = 차액 적립금사용 시 그 금액 (적립금 추가 차감용)
   - `points_earned` = B 매출 × 회원 등급 적립률 (자동 계산)
4. B 재고 차감 (`store_stock` -qty).
5. 회원 처리 (회원 있는 경우):
   - **A 반품 분 회수**: `total_points -= points_earned_A_ratio`, `total_points += points_used_A_ratio`(복구), `used_points -= points_used_A_ratio`, `total_purchase -= A_단가 × qty`.
   - **B 매출 적립**: `total_points += points_earned_B`. 차액 적립금사용 시 `total_points -= 차액`, `used_points += 차액`. `total_purchase += B_단가 × qty`.
   - 등급 재계산.

> 위 적립금/누적구매 로직은 기존 반품 처리(SalesReturnPage 121-190행)와 SalesInputPage(244-255행)의 패턴을 결합한 것. 새 헬퍼 함수로 추출하지 않고 인라인 처리해 기존 스타일 유지.

### 5.2 트랜잭션

기존 반품 처리도 트랜잭션을 명시적으로 쓰지 않고 순차 update를 함. 이번 스펙에서도 동일 패턴 유지(중간 실패 시 부분 처리될 수 있으나 기존 동작과 일관).

## 6. 매장매출 다운로드 매핑 변경

`src/pages/sales/SalesListPage.jsx`의 `exportSalesRaw` 함수 내 `mapType` 변경:

기존:
```js
const mapType = (p) => {
  if (p === '증정') return '증정';
  if (p === '시식') return '샘플';
  return '정상';
};
```

변경 후:
```js
const mapType = (s) => {
  if (s.exchange_from_sale_id) return '정상(교환)';
  if (s.payment === '증정')    return '증정';
  if (s.payment === '시식')    return '샘플';
  return '정상';
};
```

호출 시 `mapType(s.payment)` → `mapType(s)`.
select 절에 `exchange_from_sale_id` 컬럼 포함:

```js
.select('id, sold_at, store_name, branch_name, payment, quantity, returned_qty, price, exchange_from_sale_id, brand:brands(name), product:products(code, name, cost)')
```

## 7. 회귀 영향 / 안전성

- `exchange_from_sale_id`가 NULL인 기존 데이터: `mapType`의 기존 분기로 그대로 정상 처리.
- `SalesReturnPage`의 직접입력 탭: 미변경.
- 다른 페이지(SalesListPage 판매내역/상품별집계, SalesInputPage 등): mapType 외 영향 없음.
- 회원 누적·등급·적립금: A 차감 + B 추가의 net 효과로 일관 유지.

## 8. 비목표 (Out of Scope)

- 직접입력 탭의 교환 기능(원본 sale이 없는 케이스 — YAGNI).
- 교환 이력 전용 조회 페이지.
- B의 수량을 A 교환수량과 다르게 입력 (1:1만 지원. 필요 시 반품 + 별도 판매입력으로 분리).
- 매출조회 화면(SalesListPage 판매내역/상품별집계)의 `정상(교환)` 시각 배지(이번 스펙은 다운로드 매핑까지만).
- 차액 결제의 카드사·승인번호 등 결제 디테일.
- 여러 교환을 단일 트랜잭션으로 묶는 PostgreSQL function/RPC.
