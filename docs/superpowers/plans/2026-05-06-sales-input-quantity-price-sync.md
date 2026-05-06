# 판매입력 - 수량 연동 가격 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매니저 판매입력 페이지에서 정상가/할인금액/판매가 입력란이 수량에 따라 자동으로 총가(단가×수량)로 표시되고, 사용자가 직접 수정한 총가는 단가로 역산되어 저장되도록 변경한다.

**Architecture:** 라인 state는 단가 의미를 그대로 유지하고, UI 단(input의 `value` 표시 + `onChange` 핸들러)에서만 총가↔단가를 환산한다. DB 저장 로직은 변경하지 않는다.

**Tech Stack:** React 18, 인라인 스타일, 기존 `lib/utils.js` (toast).

**Spec:** `docs/superpowers/specs/2026-05-06-sales-input-quantity-price-sync-design.md`

**Test 전략:** 본 프로젝트에는 컴포넌트 테스트 인프라가 없으므로 각 작업은 dev server에서 브라우저 수동 검증으로 마무리한다. 검증 절차는 각 Task의 마지막 step에 명시.

---

## File Structure

- Modify: `src/pages/sales/SalesInputPage.jsx` — `updateLine` 함수의 가격 분기 + 정상가/할인금액/판매가 input 3개의 `value` 표시.

새 파일 생성 없음. 단일 파일 수정.

---

## Task 1: updateLine에서 입력값을 단가로 역산

**Files:**
- Modify: `src/pages/sales/SalesInputPage.jsx`

`updateLine` 함수의 `normalPrice`/`discount`/`price` 분기에서 입력값(총가)을 `effQty`로 나눠 단가로 역산한 뒤 기존 계산식에 사용하도록 변경한다. 이 단계만 적용하면 입력 시점은 단가로 저장되지만, input의 `value`는 아직 단가 그대로 표시되므로 사용자가 입력란에 직접 값을 넣지 않는 한 화면 변화는 없다(다음 Task에서 표시 변경).

- [ ] **Step 1: 현재 SalesInputPage.jsx 구조 확인**

`src/pages/sales/SalesInputPage.jsx` 파일을 읽어 다음 위치를 확인:
- `updateLine` 함수 시작 (현재 약 75행).
- `field === 'normalPrice' || field === 'discount'` 분기 (현재 약 85-90행).
- `field === 'price'` 분기 (현재 약 91-96행).
- 정상가/할인금액/판매가 input의 `value`/`onChange` 줄 (현재 약 378/380/382행).

이 단계에선 코드 변경 없음. 이후 Step에서 정확한 라인을 찾는 데 사용.

- [ ] **Step 2: updateLine의 normalPrice/discount 분기 수정**

기존 코드 (약 85-90행):

```jsx
if (field === 'normalPrice' || field === 'discount') {
  const np = Number(field==='normalPrice' ? value : updated.normalPrice) || 0;
  const dc = Number(field==='discount'    ? value : updated.discount)    || 0;
  const pu = Number(updated.pointsUsed) || 0;
  updated.price = Math.max(0, np - dc - pu);
}
```

다음으로 교체:

```jsx
if (field === 'normalPrice' || field === 'discount') {
  const effQty = Math.max(Number(updated.quantity) || 0, 1);
  const inputUnit = (Number(value) || 0) / effQty;
  if (field === 'normalPrice') updated.normalPrice = inputUnit;
  else                          updated.discount    = inputUnit;
  const np = Number(updated.normalPrice) || 0;
  const dc = Number(updated.discount)    || 0;
  const pu = Number(updated.pointsUsed)  || 0;
  updated.price = Math.max(0, np - dc - pu);
}
```

핵심 변화: 직전 `[field]: value` 할당으로 들어간 총가를 덮어쓰고, 단가로 역산한 값을 다시 저장한다.

- [ ] **Step 3: updateLine의 price 분기 수정**

기존 코드 (약 91-96행):

```jsx
if (field === 'price') {
  const np = Number(updated.normalPrice) || 0;
  const sp = Number(value) || 0;
  const pu = Number(updated.pointsUsed) || 0;
  updated.discount = String(Math.max(0, np - sp - pu));
}
```

다음으로 교체:

```jsx
if (field === 'price') {
  const effQty = Math.max(Number(updated.quantity) || 0, 1);
  const inputUnit = (Number(value) || 0) / effQty;
  updated.price = inputUnit;
  const np = Number(updated.normalPrice) || 0;
  const sp = Number(updated.price) || 0;
  const pu = Number(updated.pointsUsed) || 0;
  updated.discount = Math.max(0, np - sp - pu);
}
```

핵심 변화:
- `value`를 `effQty`로 나눠 단가로 역산해 `updated.price`에 저장(직전 `[field]: value` 할당이 만든 총가를 덮어씀).
- 단가 단위로 `discount`를 재계산. 이전 코드의 `String(...)` 래핑은 제거한다 — `discount`도 다른 분기에서 number로 다뤄지므로 일관성 확보.

- [ ] **Step 4: productId 분기는 변경 없음 — 확인만**

`field === 'productId'` 분기(약 79-84행)는 상품 단가를 그대로 `normalPrice`/`price`에 단가로 넣는 로직이다. 이는 의도와 일치하므로 변경하지 않는다. 이 단계에선 단순 확인.

- [ ] **Step 5: 빌드/구문 확인**

`npm start` 실행은 controller가 수동 검증할 것이므로 본인이 실행할 필요 없음. JS 구문이 깨지지 않았는지(중괄호/소괄호 균형) 신중히 본인 검토.

이 시점에 화면 동작 변화는 거의 없음. 사용자가 정상가/할인/판매가 input에 값을 직접 입력해야만 단가 역산 결과가 보인다. 그러나 input의 `value` 표시는 다음 Task에서 변경되므로 이 단계만 머지하면 사용자가 입력란을 직접 수정한 직후 표시값이 작아지는(예: 50,000 → 25,000 with qty=2) 어색함이 발생할 수 있다. Task 2와 함께 머지될 것을 전제로 한다.

- [ ] **Step 6: Commit**

```
git add src/pages/sales/SalesInputPage.jsx
git commit -m "refactor(sales-input): updateLine 가격 분기를 effQty 기준 단가 역산으로 변경"
```

---

## Task 2: 입력란 value를 총가 표시로 변경

**Files:**
- Modify: `src/pages/sales/SalesInputPage.jsx`

정상가/할인금액/판매가 input 3개의 `value` 속성을 단가 그대로가 아닌 `unit × effQty`(총가)로 표시. Task 1과 합쳐져야 사용자 흐름이 자연스러워진다.

- [ ] **Step 1: 현재 input 3개 위치 확인**

`SalesInputPage.jsx`에서 라인 그리드 내부의 정상가/할인금액/판매가 input 3개를 찾는다(현재 약 378/380/382행). 각 input은 다음 형태:

```jsx
<input type="number" min={0} value={l.normalPrice} onChange={e => updateLine(l.id,'normalPrice',e.target.value)} ... />
<input type="number" min={0} value={l.discount}    onChange={e => updateLine(l.id,'discount',e.target.value)}    ... />
<input type="number" min={0} value={l.price}       onChange={e => updateLine(l.id,'price',e.target.value)}       ... />
```

- [ ] **Step 2: 라인 렌더 함수 시작부에 effQty/총가 도우미 추가**

`lines.map((l, idx) => { ... })` 콜백 안에서 `selectedProd` 정의 다음 줄(약 327행) 부근에 다음을 추가:

```jsx
const effQtyDisplay = Math.max(Number(l.quantity) || 0, 1);
const totalNormal = Number(l.normalPrice) ? Number(l.normalPrice) * effQtyDisplay : '';
const totalDiscount = Number(l.discount)  ? Number(l.discount)    * effQtyDisplay : '';
const totalPrice  = Number(l.price)       ? Number(l.price)       * effQtyDisplay : '';
```

- 단가가 0/빈값이면 빈 문자열로 표시해 placeholder가 보이도록 한다(기존 동작 유지).
- 단가가 정수가 아닐 수 있으므로(사용자가 임의 총가를 입력한 결과) `Number(...)` 그대로 사용. number input은 부동소수점도 표시 가능.

- [ ] **Step 3: 정상가 input의 value를 totalNormal로 교체**

기존 (약 378행):

```jsx
<input type="number" min={0} value={l.normalPrice} onChange={e => updateLine(l.id,'normalPrice',e.target.value)} style={{...inputStyle, textAlign:'right'}} placeholder="0" />
```

다음으로 변경:

```jsx
<input type="number" min={0} value={totalNormal} onChange={e => updateLine(l.id,'normalPrice',e.target.value)} style={{...inputStyle, textAlign:'right'}} placeholder="0" />
```

- [ ] **Step 4: 할인금액 input의 value를 totalDiscount로 교체**

기존 (약 380행):

```jsx
<input type="number" min={0} value={l.discount} onChange={e => updateLine(l.id,'discount',e.target.value)} style={{...inputStyle, textAlign:'right', color:'var(--danger)'}} placeholder="0" />
```

다음으로 변경:

```jsx
<input type="number" min={0} value={totalDiscount} onChange={e => updateLine(l.id,'discount',e.target.value)} style={{...inputStyle, textAlign:'right', color:'var(--danger)'}} placeholder="0" />
```

- [ ] **Step 5: 판매가 input의 value를 totalPrice로 교체**

기존 (약 382행):

```jsx
<input type="number" min={0} value={l.price} onChange={e => updateLine(l.id,'price',e.target.value)} style={{...inputStyle, textAlign:'right', fontWeight:700, color:'var(--accent)'}} placeholder="0" required />
```

다음으로 변경:

```jsx
<input type="number" min={0} value={totalPrice} onChange={e => updateLine(l.id,'price',e.target.value)} style={{...inputStyle, textAlign:'right', fontWeight:700, color:'var(--accent)'}} placeholder="0" required />
```

- [ ] **Step 6: 수동 검증 (브라우저)**

`npm start`는 controller가 실행할 것. controller가 수행할 검증 절차:

1. 매니저 계정으로 로그인.
2. 사이드바 → 판매 입력 진입.
3. 상품을 검색해 선택. 정상가/판매가 입력란이 단가(예: 50,000) 표시되는지 확인.
4. 수량을 1 → 2 → 3으로 변경하면서 정상가/판매가 입력란이 자동으로 100,000 / 150,000으로 바뀌는지 확인.
5. 수량 1로 되돌리면 50,000 복귀 확인.
6. 수량 2 상태에서 정상가 입력란에 90,000 직접 입력 → 라인 하단 소계가 90,000원으로 보이고, 수량을 3으로 늘리면 입력란이 135,000으로 바뀌는지 확인(단가 45,000 유지).
7. 수량 2 상태에서 할인금액 입력란에 10,000 입력 → 정상가 100,000, 할인 10,000, 판매가 90,000(또는 적립금 사용 시 추가 차감) 표시. 라인 하단 소계가 90,000원, 할인 영역 "할인 -10,000원"으로 표시되는지 확인.
8. 수량 2 상태에서 판매가 입력란에 80,000 직접 입력 → 정상가 100,000, 할인 20,000, 판매가 80,000으로 표시되는지 확인.
9. 적립금 사용 모달을 열어 회원 검색·금액 입력·확정 → 모달 내부 표시는 단가 기준 그대로(스펙 비목표). 적용 후 라인 본 화면의 판매가 입력란이 (단가-적립금) × 수량으로 표시되는지 확인.
10. 판매 저장 → 매장 매출조회 또는 최근 입력 내역에서 단가/수량/매출이 정상 기록됐는지 확인. 매출 합계 = 수량 × 단가가 화면에 입력했던 총가와 일치해야 함.

- [ ] **Step 7: Commit**

```
git add src/pages/sales/SalesInputPage.jsx
git commit -m "feat(sales-input): 정상가/할인/판매가 입력란을 수량 연동 총가로 표시"
```

---

## Self-Review Checklist (작업자 본인 확인)

플랜 작성 후 자체 검토.

**1. Spec coverage:**
- 3.1 변경 대상 입력란 (정상가/할인/판매가) → Task 2 Step 3-5.
- 3.2 입력 시 동작(총가 → 단가 역산) → Task 1 Step 2-3.
- 3.3 수량 변경 시 동작(자동 반영) → Task 2 Step 2-5 (렌더 시 자동 계산).
- 3.4 변경하지 않는 표시 영역(소계, 합계) → 본 plan에서 건드리지 않음.
- 4.1 라인 state 의미 유지 → Task 1·2 모두 단가 보존.
- 4.2 DB 저장 변경 없음 → handleSubmit 미수정.
- 4.3 적립금 모달 변경 없음 → 본 plan에서 건드리지 않음.
- 5.1 변경 위치 → SalesInputPage.jsx 단일.
- 5.2 위험(부동소수점/적립금 단가 환산 버그/빈 입력) → spec에 명시되어 본 plan은 건드리지 않음.
- 5.3 회귀 영향 없음 → DB·후속 로직 미수정으로 자동 보장.

**2. Placeholder scan:** 모든 step에 실제 코드/명령/검증 절차 포함. "TBD"/"적절히 처리" 등 없음.

**3. Type consistency:**
- `effQty`(Task 1) / `effQtyDisplay`(Task 2): 동일한 의미(`max(quantity, 1)`)이지만 사용 위치가 다름(updateLine 내부 vs 라인 렌더 함수 내부). 명시적으로 다른 이름을 쓴 이유 — Task 1의 `effQty`는 `updated.quantity` 기반, Task 2의 `effQtyDisplay`는 `l.quantity` 기반(렌더 시점의 라인 객체). 동일한 변수 이름을 두 컨텍스트에서 사용하면 헷갈리므로 일부러 다르게 명명.
- `inputUnit`(Task 1 step 2·3): 두 분기에서 같은 의미·동일 계산식(`Number(value)/effQty`).
- 모든 새 변수가 plan 내에서 일관되게 사용됨. 외부 함수/타입 의존 없음.
