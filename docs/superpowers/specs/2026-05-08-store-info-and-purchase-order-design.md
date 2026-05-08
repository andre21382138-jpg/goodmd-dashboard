# 매장 정보 + 발주진행 (Design)

작성일: 2026-05-08
대상 파일:
- `src/lib/constants.js` (사이드바 메뉴)
- `src/pages/store/StoreInfoPage.jsx` (신규)
- `src/pages/stock/PurchaseOrderPage.jsx` (신규)
- `src/pages/stock/StockMgmtPage.jsx` 또는 본사 재고관리 라우팅 (탭 추가)
- `App.js` 또는 라우터 등록

## 1. 배경 / 목적

본사가 매주 매장에 보충 재고를 발주할 때, 외부 택배 시스템에 업로드할 매장발주 엑셀 양식(31컬럼)을 만들어야 한다. 양식의 매장 식별자(`쇼핑몰ID`)는 내부 약식명("롯관악점팔레오")이고, 매장별 우편번호·주소·전화번호도 함께 채워야 한다. 매장당 정보가 4가지밖에 되지 않지만 40개 매장에 대해 매번 손으로 입력하는 건 비효율이다.

또한 발주 수량은 보통 "지난주 판매분 = 이번주 발주분" 패턴이라, 매장×상품별 판매 집계가 자동으로 도출되면 사용자는 일부 라인만 미세 조정 후 다운로드만 누르면 된다.

이 두 흐름을 묶어 (1) 매장 마스터 정보 관리 페이지와 (2) 자동 집계 + 양식 다운로드를 하는 발주진행 탭을 추가한다.

## 2. 사용자 흐름

### 2.1 매장 정보 (한 번 셋업)

1. 본사 사이드바 → `📍 매장 정보` 진입.
2. 매장 목록 자동 표시 (sales 테이블에서 `(store_name, branch_name)` unique 추출).
3. 처음에는 모든 매장이 "⚠️ 미설정". 상단 `[📥 엑셀 일괄 import]` 버튼으로 한 번에 등록.
4. 이후 새 매장이 sales에 들어오면 자동으로 목록에 노출 → `[편집]` 모달로 보충.

### 2.2 발주진행 (매주 1회)

1. 본사 사이드바 → 재고관리 → `발주진행` 탭 진입.
2. 집계기간이 자동으로 "지난주(직전 월~일)" 채워짐. 발송일은 오늘.
3. 표가 자동 로딩 (매장×상품별 판매 집계).
4. 필요 시 일부 라인의 발주 수량 수정 (0으로 두면 제외).
5. `[📥 매장발주 엑셀 다운로드]` 클릭 → 양식 엑셀이 다운로드됨.

## 3. DB 스키마

### 3.1 신규 테이블 `store_addresses`

```sql
CREATE TABLE store_addresses (
  id              SERIAL PRIMARY KEY,
  store_name      TEXT NOT NULL,         -- 백화점 (sales.store_name와 동일)
  branch_name     TEXT NOT NULL,         -- 점포 (sales.branch_name와 동일)
  shopping_mall_id TEXT NOT NULL,        -- 쇼핑몰ID (예: 롯관악점팔레오)
  postal_code     TEXT,                  -- 우편번호
  address         TEXT,                  -- 주소
  recipient_phone TEXT,                  -- 수취인 전화번호
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_name, branch_name)
);

CREATE INDEX idx_store_addresses_pair ON store_addresses(store_name, branch_name);
```

### 3.2 데이터 의미

- 한 매장(=백화점+점포)당 한 행. UNIQUE(store_name, branch_name).
- 신규 매장은 sales에 거래가 생긴 뒤 매장 정보 페이지에서 보충 등록.
- 모든 컬럼은 `recipient_phone`까지 사용자가 입력. `shopping_mall_id`는 NOT NULL로 발주 양식의 핵심 식별자.

## 4. 매장 정보 페이지 (`StoreInfoPage.jsx`)

### 4.1 라우팅 / 메뉴

- 사이드바 (HQ_MENUS): `{ key: 'store_info', icon: '📍', label: '매장 정보' }` 추가
- App.js 또는 라우터에서 `store_info` → `<StoreInfoPage>` 매핑

### 4.2 화면 구성

**필터바**:
- 백화점(store_name) select
- 키워드 검색 (점포명·쇼핑몰ID 부분일치)
- `[📥 엑셀 일괄 import]` 버튼

**테이블 컬럼**:
| 백화점 | 점포 | 쇼핑몰ID | 우편번호 | 주소 | 수취인 전화 | 상태 | 액션 |
|---|---|---|---|---|---|---|---|

- 매장 목록 = `sales` 테이블의 distinct `(store_name, branch_name)` 좌측 조인 `store_addresses`.
- 상태: 모든 4개 필드(`shopping_mall_id`, `postal_code`, `address`, `recipient_phone`) 채워졌으면 ✅, 아니면 ⚠️.
- 액션: `[편집]` 버튼 → 모달 오픈.

**편집 모달**:
- 입력 필드: shopping_mall_id (필수), postal_code, address, recipient_phone.
- 저장 시 upsert (UNIQUE(store_name, branch_name)).
- 취소 / 저장.

### 4.3 일괄 import

- 사용자가 `.xlsx` 파일 업로드.
- 컬럼(예시): `백화점 / 점포 / 쇼핑몰ID / 우편번호 / 주소 / 수취인전화`.
- 헤더 검증 후 행마다 upsert.
- 결과 토스트: "X건 등록, Y건 업데이트, Z건 오류".

## 5. 발주진행 탭 (`PurchaseOrderPage.jsx`)

### 5.1 라우팅

- 본사 재고관리(`StockMgmtPage`)에 새 탭 `발주진행` 추가.
- 기존 탭(센터재고/매장재고/안전재고)은 그대로.

### 5.2 화면 구성

**상단 입력 영역**:
- 발송일 (default = 오늘)
- 집계기간 from / to (default = 지난주 월요일 ~ 일요일)
- `지난주` 빠른 버튼
- `🔄 집계 새로고침` 버튼 (필터 변경 시 수동 재로드)

**집계 표**:
| 백화점 | 점포 | 쇼핑몰ID | 상품명 | ERP코드 | 집계수량 | 발주수량 | 마스터 |
|---|---|---|---|---|---|---|---|

- 데이터 소스: sales 테이블의 row를 (store_name, branch_name, product_id) 기준 그룹핑.
- 집계수량 = `Σ(quantity - returned_qty)` (반품 차감).
- 발주수량 = 입력 가능한 number input. default = 집계수량. 0이면 다운로드 시 제외.
- 마스터: store_addresses에 매칭 행 + 4개 필드 모두 있으면 ✅, 아니면 ⚠️.
- ⚠️ 매장은 다운로드 시 자동 제외 + 토스트 경고.

**하단**:
- 합계 표시: 매장 N / 라인 M / 총 수량 X
- `[📥 매장발주 엑셀 다운로드]` 버튼 (다운로드 중 spinner)

### 5.3 집계 쿼리

```js
const { data } = await supabase.from('sales')
  .select('store_name, branch_name, product_id, quantity, returned_qty, product:products(name, code, erp_code)')
  .gte('sold_at', from)
  .lte('sold_at', to);
```

대용량(1만건 이하 평균) 가정하에 페이징 없이 단일 쿼리. 필요 시 1,000건씩 페이징.

클라이언트에서 `(store_name, branch_name, product_id)` Map 그룹핑.

매칭되는 store_addresses는 별도 조회 후 join.

## 6. 발주 엑셀 양식

### 6.1 시트 구조

- 시트명: `매장발주` (또는 `발주`)
- 한 행 = 한 매장의 한 상품 발주 라인.

### 6.2 컬럼 매핑 (전체 31개)

| 컬럼 | 헤더 | 출처 / 값 |
|---|---|---|
| A | 발송일 | `Date(발송일)`, 셀 서식 yyyy-mm-dd |
| B | 송장번호 | 상수 `유통2팀` |
| C | 주문번호 | 자동 `yyyymmdd-NNNN` (발송일 기준 + 라인 순번 4자리) |
| D | 채널 | 상수 `기타_유통2팀_매장발주` |
| E | 매장명 | `store_addresses.shopping_mall_id` |
| F | 수취인명 | `store_addresses.shopping_mall_id` (E와 동일) |
| G | 결제금액 | 상수 `0` |
| H | 주문수량 | 상수 `1` |
| I | 상품명 | 빈 값 |
| J | 옵션 | 빈 값 |
| K | 품명 | `products.name` |
| L | 수취인명 | `store_addresses.shopping_mall_id` (E와 동일) |
| M | (헤더 없음) | `store_addresses.postal_code` (우편번호) |
| N | 주소 | `store_addresses.address` |
| O | 수취인 천화번호1 | `store_addresses.recipient_phone` |
| P | 수취인 전화번호2 | 빈 값 |
| Q | 배송메세지 | 빈 값 |
| R | 상품번호 | 빈 값 |
| S | 주문자명 | 상수 `한국생활건강(팔레오본사)` |
| T | 주문자 연락처1 | 상수 `070-5117-5677` |
| U | 주문자 연락처2 | 상수 `070-5117-5677` (T와 동일) |
| V~AC | (수수료/공란/사방넷 등) | 빈 값 |
| AD | ERP코드 | `products.erp_code` (없으면 `products.code`) |
| AE | 수량 | 사용자가 조정한 발주수량 |
| AF~ | (택배사 채움) | 빈 값 |

상수는 모듈 상단에 모음:
```js
const ORDER_CONSTANTS = {
  TRACKING_LABEL: '유통2팀',
  CHANNEL: '기타_유통2팀_매장발주',
  ORDERER_NAME: '한국생활건강(팔레오본사)',
  ORDERER_PHONE: '070-5117-5677',
};
```

### 6.3 주문번호 자동 생성 규칙

- `yyyymmdd-NNNN` 형식.
- yyyymmdd = 발송일.
- NNNN = 라인 순번 4자리 (`0001`부터 시작, 같은 발송일 내 다운로드 안에서만 고유).
- 매장 순서대로 묶어서 순번 부여 (한 매장의 라인이 연속 번호가 되도록).

### 6.4 라이브러리 / 스타일

- ExcelJS 사용 (기존 `SafetyTab.jsx`/`SalesListPage.jsx` 패턴).
- 헤더 행 단순(굵게, 회색/연한 배경) — 정확한 양식 시각 일치는 다음 이터레이션에서 다룸. **이번 이터레이션은 데이터 정확성 우선**.
- 발송일/수량은 numFmt 적용. 우편번호는 텍스트(`@`).

### 6.5 파일명

`매장발주_{발송일 yyyy-mm-dd}.xlsx`

### 6.6 다운로드 시 처리

1. 발주수량 > 0 + 마스터 ✅ 라인만 추출.
2. 매장 정렬(store_name → branch_name) → 라인 순번 부여 → 주문번호 생성.
3. ExcelJS 워크북 생성 → buffer → `dlBlob`.
4. 토스트: "발주 N건 다운로드 완료" / 마스터 미설정 매장 K개 제외 안내.

## 7. 변경 범위

- DB: `store_addresses` 테이블 신규 (Supabase SQL 직접 실행).
- 사이드바: HQ_MENUS에 `매장 정보` 메뉴 추가.
- 신규 파일: `src/pages/store/StoreInfoPage.jsx`, `src/pages/stock/PurchaseOrderPage.jsx`.
- 라우팅: App.js 또는 본사 재고관리 탭 정의에 등록.
- 회귀 영향: read-only 신규 페이지. sales/products 등 기존 데이터 변경 없음.

## 8. 비목표 (Out of Scope)

- 발주 진행 이력(다운로드한 양식) DB 저장.
- 매장 마스터 변경 이력.
- 송장번호/주문번호 외부 시스템 연동(자동 발급).
- 양식의 시각 디테일(폰트/배경/줄높이) 외부 양식과 100% 일치(이번은 데이터 정확성 위주).
- 매장별 발주 한도/안전재고 자동 추천.
- 다른 양식(.xls/.csv 등) 지원.
- 매장 정보 일괄 export(이번은 import만).
