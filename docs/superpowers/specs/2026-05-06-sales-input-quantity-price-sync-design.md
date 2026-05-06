# 판매입력 - 수량 연동 가격 표시 (Design)

작성일: 2026-05-06
대상 파일: `src/pages/sales/SalesInputPage.jsx`
관련 메뉴: 매니저 → 판매 입력 (`sales_input`)

## 1. 배경 / 목적

매니저가 판매를 입력할 때 같은 상품을 여러 개 한 라인에 합쳐 등록하는 경우가 있다. 현재 정상가·할인금액·판매가 입력란은 항상 **단가(unit price)** 만 표시하고, 수량을 바꿔도 값이 변하지 않는다. 라인 하단에 작게 `소계 = 수량×판매가`만 표시되어, 매니저가 고객에게 안내하거나 입력값을 직관적으로 검수하기 어렵다.

수량을 바꾸면 정상가/할인금액/판매가 세 입력란이 자동으로 **총가(= 단가 × 수량)** 로 표시되도록 변경해 입력 화면이 곧바로 영수증 금액을 반영하게 한다. DB 저장은 기존 단가 의미를 유지해 매출조회/반품 등 다른 페이지와의 호환성을 깨지 않는다.

## 2. 사용자 흐름

1. 매장 매니저가 판매 입력 페이지에서 상품을 검색·선택. 정상가/판매가 입력란에 상품의 단가가 자동 표시(현재 동작).
2. 수량을 2로 늘림 → 정상가/판매가 입력란이 즉시 `단가×2`로 표시. 할인금액 입력란도 `단가할인×2`로 표시.
3. 매니저가 입력란 값을 직접 수정(예: 정상가 90,000원 입력, 수량 2) → 단가가 45,000원으로 역산되어 저장. 이후 수량을 3으로 바꾸면 정상가 입력란이 135,000원 표시.
4. 적립금 사용 모달 등 다른 흐름은 변경 없음.

## 3. UI 사양

### 3.1 변경 대상 입력란

판매 입력 페이지의 라인 그리드에서 다음 3개 input의 `value`와 `onChange` 동작을 변경한다.

| 컬럼 | 변경 전 표시 | 변경 후 표시 |
|---|---|---|
| 정상가 | `l.normalPrice` (단가) | `unit_normalPrice × effQty` (총가) |
| 할인금액 | `l.discount` (단가) | `unit_discount × effQty` (총가) |
| 판매가 | `l.price` (단가) | `unit_price × effQty` (총가) |

`effQty = max(Number(l.quantity) || 0, 1)` — 수량이 0 또는 빈값이어도 1로 간주해 분모/곱셈에서 안전하게 사용.

### 3.2 입력 시 동작

사용자가 위 3개 input에 직접 값을 입력하면 `onChange`에서 `effQty`로 나누어 단가를 역산해 라인 state에 저장한다.

- 정상가 입력: `unit_normalPrice = totalInput / effQty` → 기존 `updateLine(id,'normalPrice',...)` 로직과 동일하게 `price`도 재계산.
- 할인금액 입력: `unit_discount = totalInput / effQty` → 기존 `updateLine(id,'discount',...)` 와 동일하게 `price`도 재계산.
- 판매가 입력: `unit_price = totalInput / effQty` → 기존 `updateLine(id,'price',...)` 와 동일하게 `discount`도 재계산.

소수점 처리: `effQty`로 나눈 결과를 그대로 보관(JS Number, 부동소수점). 단가가 정수가 아닐 때 곱셈으로 다시 환원하면 사용자가 입력한 총가가 그대로 보이도록 한다(누적 오차 방지). DB 컬럼(`sales.price`)이 numeric이므로 소수점 저장은 허용된다.

### 3.3 수량 변경 시 동작

기존 `updateLine`의 `quantity` 분기는 그대로 유지(라인 state의 `quantity`만 갱신). 입력란 표시값은 렌더링 시 `unit × effQty`로 다시 계산되므로 별도 로직 없이 자동 반영된다.

### 3.4 변경하지 않는 표시 영역

- 라인 하단 소계 영역(`소계 / 할인 -X원 / 적립금 사용`): 기존과 동일. 이미 `quantity × price` / `quantity × discount` 로 총가를 표시하고 있다.
- 라인 상단 그리드의 컬럼 라벨(`정상가 / 할인금액 / 판매가`): 변경 없음.
- 합계 표시(여러 라인 총합): 변경 없음.

## 4. 데이터 처리

### 4.1 라인 state

기존 라인 state의 의미를 유지한다.

```js
{
  normalPrice: number, // 단가
  discount:    number, // 단가 할인
  price:       number, // 단가 판매가
  quantity:    number,
  // ... 기타 필드
}
```

신규 필드 추가 없음. UI 단에서만 입력값/표시값을 총가로 환산한다.

### 4.2 DB 저장 (`handleSubmit`)

기존 동작 그대로. `sales.price = Number(l.price)` (단가), `sales.quantity = Number(l.quantity)`. 매출 합계 계산도 그대로 `quantity × price`.

→ 이번 변경은 입출력 표시만 바꾸므로 매출조회·반품·재고 차감·회원 적립금 등 모든 후속 로직은 영향받지 않는다.

### 4.3 적립금 사용 모달

`pointsModalLine` 모달의 `maxAllowed = max(0, np - dc)` 계산 등 모든 로직은 라인 state의 단가 의미에 의존하므로 변경 없음. 모달 내부에서 보여주는 "상품가 / 적립금 사용 / 최종 판매가"도 단가 기준 그대로 둔다(이번 스펙 범위 외).

## 5. 구현 메모

### 5.1 변경 위치

`src/pages/sales/SalesInputPage.jsx` 단일 파일.

- `updateLine` 함수: `field === 'normalPrice' | 'discount' | 'price'` 분기에서 입력 값을 `effQty`로 나눠 단가로 변환한 뒤 기존 계산식에 사용. (기존 분기 코드는 그대로 두고, 입력값만 사전 변환.)
- 라인 렌더링부의 정상가/할인금액/판매가 input 3개:
  - `value` 속성: `(Number(l.<field>) || 0) * effQty` 또는 빈 문자열 (값이 0/없을 때).
  - `onChange`: 기존 그대로 `updateLine(l.id, '<field>', e.target.value)`. `updateLine` 내부에서 단가로 환산.

### 5.2 위험 / 제약

- **부동소수점 누적 오차**: 사용자가 총가 99,999원·수량 2를 입력하면 단가 49999.5가 저장되어 DB에 그대로 들어간다. 매장 단위 매출 보고는 모든 라인을 `quantity × price`로 합치므로 결과는 정확. 단, `sales.price`만 보면 소수점이 보일 수 있다. 화면 표시 시점에서는 `Number().toLocaleString()`이 자동으로 천 단위 콤마와 정수 표현을 제공하므로 문제 없음.
- **기존 알려진 이슈(스펙 범위 외)**: `price = normalPrice - discount - pointsUsed` 계산식의 `pointsUsed`는 라인 단위 고정 금액인데 단가에서 차감되어 수량이 클 때 효과가 과대해지는 문제가 이미 코드에 존재. 본 스펙은 이를 건드리지 않고 기존 동작을 유지한다.
- **빈 입력**: 사용자가 입력란을 비우면 (`e.target.value === ''`) `Number('')`은 0이 되어 자연스럽게 `unit = 0`으로 처리. 표시도 `0 × effQty = 0`이 되어 placeholder로 복귀.

### 5.3 회귀 영향 없음

다른 페이지/기능은 라인 state의 단가 의미에 의존하지 않거나, `sales.price` 컬럼을 단가로 읽기 때문에 본 변경의 영향이 없다. 본사 매출조회, 매장 재고 차감, 회원 적립금 누적, 반품 처리 모두 기존 동작 유지.

## 6. 비목표 (Out of Scope)

- 적립금 사용(`pointsUsed`) 단가 환산 버그 수정.
- 모달 내부 표시 단위 변경.
- 매니저가 같은 상품을 여러 라인에 분산 입력하는 흐름 변경.
- 다른 페이지(매출조회 등)의 단가/총가 표시 변경.
- DB 스키마 변경.
