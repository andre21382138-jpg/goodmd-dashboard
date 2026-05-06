# 매장매출 판매내역 → 결산 양식 엑셀 다운로드 (Design)

작성일: 2026-05-07
대상 파일: `src/pages/sales/SalesListPage.jsx`
관련 메뉴: 본사 → 매출조회 → 매장 매출 (`sales_list`) — 판매내역 모드

## 1. 배경 / 목적

본사에서 결산자료 제출용 외부 엑셀 양식(`매출raw` 시트)으로 매장매출 데이터를 정기적으로 추출해야 한다. 현재 매장매출 페이지는 화면 상의 표만 제공하고, 외부 양식과 컬럼 구성이 달라 매번 손으로 가공해야 한다. 판매내역 모드에서 한 번의 클릭으로 양식에 맞는 엑셀 파일을 생성·다운로드할 수 있게 한다.

## 2. 사용자 흐름

1. 본사 계정으로 매출조회 → 매장 매출 진입.
2. 판매내역 모드에서 점포·브랜드·기간·키워드 등 필요한 필터 적용.
3. 필터바 우측의 `📥 엑셀 다운로드` 버튼 클릭.
4. 진행 중 버튼이 비활성·스피너 표시. 완료 시 `.xlsx` 파일이 브라우저로 다운로드됨.

## 3. UI 사양

### 3.1 다운로드 버튼

판매내역 모드에서만 노출. 상품별 집계 모드에선 숨김.

위치: `fbar-right` 영역, 기존 합계(`N건 · M개 · X원`) 표시 옆.

```
[ 📥 엑셀 다운로드 ]
```

- 다운로드 중: 버튼 disabled + 회전 스피너.
- 키보드 접근성은 기존 다른 버튼 수준(별도 처리 없음).

### 3.2 토스트

- 성공: `엑셀 다운로드 완료` (또는 toast 'ok').
- 실패: `다운로드 실패: <message>` (toast 'err').

## 4. 데이터 처리

### 4.1 데이터 소스 / 페이징

화면 표시는 `.limit(500)` 이지만 다운로드는 **현재 적용된 필터로 전체 행을 가져온다**. Supabase JS 기본 1,000건 제한을 회피하기 위해 `.range(start, start+999)` 루프로 빈 결과가 반환될 때까지 반복.

```text
let all = [], start = 0
loop:
  page = sales.select(... + brand + product:products(code,name,cost)).filter(...).range(start, start+999)
  if page.length === 0 break
  all.push(...page)
  if page.length < 1000 break
  start += 1000
```

쿼리 select에 `product:products(code, name, cost)`가 필수 (그룹/매장은 sales 행 자체에 있음).

### 4.2 클라이언트 필터링

화면 동작과 일치하도록 다음을 클라이언트에서 추가 적용:

- `완전반품 행 제외`: `returned_qty < quantity` 인 행만 사용 (화면의 `showReturned=false` 기본 동작과 동일).
- 키워드 필터(`fKeyword`): 상품명·브랜드명 부분일치 (소문자 비교). 화면 로직과 동일.

부분반품은 효력수량으로 차감 처리(아래 4.4 참조).

### 4.3 컬럼 매핑

| 컬럼 | 헤더 | 값 |
|---|---|---|
| A | 선택 | 리터럴 `'0'` (문자열) |
| B | 순번 | 출력 순서 1..N |
| C | 매출일자 | `new Date(sold_at)` (Date 객체), 셀 서식 `yyyy-mm-dd` |
| D | 그룹 | `s.store_name` |
| E | 매장 | `s.branch_name` |
| F | 전표유형 | `s.payment` 매핑(아래) |
| G | 상품코드 | `s.product?.code || ''` |
| H | 상품명 | `s.product?.name || ''` |
| I | 매출수량 | 효력수량 = `max(0, s.quantity - (s.returned_qty || 0))` |
| J | 최종금액 | 효력수량 × `s.price` |
| K | 원가 | `s.product?.cost ?? null` (없으면 빈 값) |
| L | 최종원가 | 원가가 있으면 `cost × 효력수량`, 없으면 빈 값 |
| M | (헤더 없음) | 직접 계산값: `final_amount > 0 && final_cost != null ? final_cost / final_amount : ''`. 셀 서식 `0.0000` |

**전표유형 매핑** (`s.payment` → 출력값):
- `카드` → `정상`
- `현금` → `정상`
- `적립금사용` → `정상`
- `증정` → `증정`
- `시식` → `샘플`
- 그 외 / 빈 값 → `정상`

`정상(교환)`은 본 스펙에서 사용하지 않음(별도 메뉴 작업으로 분리).

### 4.4 효력수량 / 효력매출 계산

- `effQty = max(0, quantity - (returned_qty || 0))`
- `final_amount = effQty * price`
- `final_cost = (cost != null) ? cost * effQty : null`

완전반품(`effQty === 0`) 행은 4.2에서 이미 제외되므로 본 단계에선 부분반품(`effQty > 0`)만 들어옴.

## 5. 엑셀 포맷

### 5.1 라이브러리

기존 패턴대로 `exceljs` 동적 import (`src/pages/stock/SafetyTab.jsx` precedent). `xlsx`(SheetJS)는 셀별 스타일링을 지원하지 않아 부적합.

### 5.2 시트 / 헤더

- 시트명: `매출raw`
- 헤더 행(1행): 위 4.3의 12개 컬럼 헤더 + 13번째(M) 컬럼은 헤더 비움.
- 헤더 스타일(SafetyTab 패턴): 노란 배경(`FFFFD600`), 굵은 글씨, 가운데 정렬, Malgun Gothic.

### 5.3 데이터 행 스타일

- 숫자 컬럼(I·J·K·L): 우측 정렬, 정수 천 단위 콤마(`#,##0`).
- 매출일자(C): 가운데 정렬, `yyyy-mm-dd`.
- 그룹/매장/상품명: 좌측 정렬.
- 행 높이 18, 폰트 Malgun Gothic 10pt.
- 짝수 행 옅은 노랑(`FFFFF8E1`) 배경(SafetyTab 패턴).

### 5.4 컬럼 폭

| 컬럼 | width |
|---|---|
| A 선택 | 6 |
| B 순번 | 8 |
| C 매출일자 | 12 |
| D 그룹 | 16 |
| E 매장 | 16 |
| F 전표유형 | 10 |
| G 상품코드 | 18 |
| H 상품명 | 36 |
| I 매출수량 | 10 |
| J 최종금액 | 14 |
| K 원가 | 12 |
| L 최종원가 | 14 |
| M (원가율) | 12 |

### 5.5 파일명

`매장매출_<fFrom>_<fTo>.xlsx`

- `fFrom` 미지정: `시작없음`
- `fTo` 미지정: `종료없음`
- 둘 다 미지정: `매장매출_전체.xlsx`

예: `매장매출_2026-04-01_2026-04-30.xlsx`, `매장매출_전체.xlsx`

## 6. 구현 메모

### 6.1 변경 위치

`src/pages/sales/SalesListPage.jsx` 단일 파일.

- 새 비동기 함수 `exportSalesRaw()` 컴포넌트 외부 또는 내부 정의: 인자로 현재 필터값 + 키워드 + showReturned 등을 받아 페이징 fetch + ExcelJS workbook 생성 + `dlBlob` 호출.
- 새 state: `exporting` (Boolean) — 버튼 disabled 토글.
- 다운로드 버튼 JSX 추가 (판매내역 모드 한정).
- 의존성 import: `dlBlob` (이미 `lib/utils.js`에 존재).

### 6.2 위험 / 제약

- **대용량 fetch**: 6개월치 수만 건이면 페이징 루프가 길어진다. 메모리/네트워크 측면에서 일반적인 규모(연 단위 < 10만건)는 크게 문제 없을 것으로 예상. 향후 필요 시 서버 사이드 페이징 옵션 분리.
- **products 조인 누락**: 과거 sales 행의 `product_id`가 null이거나 매칭되는 product가 삭제됐으면 `s.product`가 null. 이 경우 상품코드/상품명/원가 모두 빈 값으로 출력.
- **부동소수점 가격**: 직전 작업(판매입력 수량 연동)에서 `sales.price`가 비정수일 수 있음. 출력 시 정수 반올림은 적용하지 않고 그대로 둔다(원본 보존). 셀 서식 `#,##0`은 표시상 반올림되지만 셀 값은 보존.
- **timezone 표기**: `sold_at`은 DATE 컬럼(YYYY-MM-DD 문자열)이므로 `new Date(sold_at)` 파싱 시 UTC 자정으로 해석돼 표시 timezone에 따라 하루 어긋날 수 있음. 본 스펙에선 `new Date(sold_at + 'T00:00:00')` 로 로컬 자정 고정.

### 6.3 회귀 영향 없음

다운로드는 read-only. sales/products 테이블에 영향 없음. 상품별 집계 모드와 다른 페이지(매니저 매출조회 등)도 영향 없음.

## 7. 비목표 (Out of Scope)

- 특판(`biz_sales`)·강좌(`lecture_sales`) 합본 다운로드.
- 상품별 집계 모드 다운로드(별도 양식이 필요함).
- 정상(교환) 매핑(별도 메뉴 작업: 반품접수 → 반품/교환 메뉴 변경 + 교환 기능 신설).
- 결산 보고서/원가 시트/공식 자동 생성.
- 다운로드 진행률 progress bar(스피너만).
- CSV 등 대체 포맷 지원.
