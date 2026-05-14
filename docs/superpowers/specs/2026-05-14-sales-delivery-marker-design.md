# 판매 입력 시 "택배 요청" 마커 + 매출 조회 별도 집계 (Design)

작성일: 2026-05-14
대상 파일:
- DB: `sales` 테이블 컬럼 추가
- `src/pages/sales/SalesInputPage.jsx` — 판매 입력 폼에 체크박스 추가
- `src/pages/sales/SalesListPage.jsx` — 본사 매출 조회: 요약 카드 + 리스트 배지
- `src/pages/sales/MgrSalesViewPage.jsx` — 매장 매니저 매출 조회: 동일 적용

## 1. 배경 / 목적

매장에서 고객이 상품을 구매했지만 가져가지 않고 택배로 발송해달라고 요청하는 경우가 있다. 현재 시스템은 이 정보를 캡처하지 못해, 매장 운영자가 별도 메모/엑셀로 관리해야 한다.

**단순 마커 방식**으로 sales 한 행에 "택배 요청 여부" 플래그를 추가하여:
- 매장 직원이 판매 입력 시 체크 가능
- 본사·매장 매니저 매출 조회 시 택배발송 건수·매출 별도 집계
- 실제 배송 처리(주소·운송장 등)는 시스템 밖 (별도 운영)

## 2. 사용자 흐름

### 2.1 매장 직원 — 판매 입력

1. 매장 → 판매 입력 진입.
2. 평소처럼 상품·수량·결제 입력.
3. **고객이 택배 발송 요청 시 → `🚚 택배 요청` 체크박스 체크**.
4. 저장 → `sales.delivery_requested = true`로 기록.

체크박스는 기존 입력 영역(메모/결제 근처)에 배치. 미체크 시 false (기본값).

### 2.2 본사 — 매출 조회

1. 본사 → 매출조회 진입.
2. 상단 요약 영역에 신규 카드 표시:
   ```
   ┌─ 🚚 택배발송 ──────┐
   │ 12 건              │
   │ 1,250,000 원       │
   └────────────────────┘
   ```
3. 매출 리스트 각 행 — 택배발송 건은 상품명 옆 또는 우측 컬럼에 작은 `🚚` 배지.
4. 반품된 건(`returned_qty >= quantity`)은 카운트/금액 모두에서 자동 제외 (기존 매출 계산과 동일 패턴).

### 2.3 매장 매니저 — 매출 조회

1. 매장 매니저 → 매출 조회 진입.
2. 본인 매장 매출 중 택배 건수·금액을 동일 형태(상단 카드 + 리스트 배지)로 표시.
3. 매장 단위로 본인 매장 매출만 집계 (기존 RLS/필터 동작 유지).

## 3. 데이터 모델

### 3.1 컬럼 추가

```sql
ALTER TABLE sales
  ADD COLUMN delivery_requested boolean NOT NULL DEFAULT false;
```

| 컬럼 | 의미 |
|---|---|
| `delivery_requested` | true=택배 발송 요청, false=매장 픽업(기본) |

NOT NULL DEFAULT false로 추가하므로 기존 sales 행은 모두 자동으로 `false` 적용. 별도 마이그레이션 UPDATE 불요.

### 3.2 매출 계산 패턴 (반품 차감)

기존 패턴 그대로 활용:
```js
const eff = Math.max(0, (r.quantity||0) - (r.returned_qty||0));
const effAmt = r.price * eff;
```

택배 통계도 동일:
```js
const deliveryCount = sales.filter(r => r.delivery_requested && eff(r) > 0).length;
const deliveryAmt = sales.filter(r => r.delivery_requested).reduce((s,r) => s + r.price * eff(r), 0);
```

전체 반품된 건은 자동 제외됨 (eff=0이면 카운트/금액 0). 부분 반품은 남은 수량만큼 매출 인식.

## 4. UI 사양

### 4.1 SalesInputPage — 체크박스 추가

판매 입력 폼에서 기존 결제수단/메모 입력 근처에 다음 추가:

```jsx
<label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer',
  padding:'10px 14px', border:'1px solid var(--border)', borderRadius:'var(--radius)',
  background: deliveryRequested ? '#fff8e1' : '#fff'}}>
  <input type="checkbox" checked={deliveryRequested}
    onChange={e => setDeliveryRequested(e.target.checked)}
    style={{width:18, height:18, cursor:'pointer'}}/>
  <span style={{fontSize:13, fontWeight:600}}>🚚 택배 요청</span>
  <span style={{fontSize:11, color:'var(--text3)', marginLeft:'auto'}}>
    고객이 택배 발송을 요청한 경우
  </span>
</label>
```

저장 핸들러에서 `sales.insert` 시 `delivery_requested: deliveryRequested` 포함. 저장 후 폼 리셋 시 `setDeliveryRequested(false)`.

판매 수정/반품 흐름에선 변경하지 않음 (체크는 판매 시점 한정).

### 4.2 SalesListPage — 요약 카드 + 리스트 배지

**요약 영역 (상단 카드들)**:

기존 카드 그리드에 한 칸 추가. 위치는 매출 합계 카드 옆이 자연스러움:

```jsx
<div style={{background:'#fff', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'14px 18px'}}>
  <div style={{fontSize:10, fontWeight:600, color:'#e65100', marginBottom:8, letterSpacing:1}}>
    🚚 택배발송
  </div>
  <div style={{fontSize:20, fontWeight:700, color:'#e65100', fontFamily:'var(--mono)', marginBottom:4}}>
    {deliveryAmt.toLocaleString()}원
  </div>
  <div style={{fontSize:11, color:'var(--text3)'}}>
    {deliveryCount.toLocaleString()}건
  </div>
</div>
```

색상은 주황 톤(`#e65100` / `#ffcc80`)으로 다른 카드와 구분.

**매출 리스트 행 배지**:

상품명 셀 안에 inline 배지:

```jsx
<td>
  {it.product?.name || '-'}
  {it.delivery_requested && (
    <span style={{marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px',
      background:'#fff3e0', color:'#e65100', border:'1px solid #ffcc80', borderRadius:3}}>
      🚚 택배
    </span>
  )}
</td>
```

### 4.3 MgrSalesViewPage — 동일 적용

매장 매니저 매출 조회 페이지에도 위 4.2와 같은 요약 카드 + 리스트 배지 적용. 데이터 fetch에서 자기 매장 sales만 조회되는 기존 동작은 그대로 유지.

요약 카드의 deliveryCount/deliveryAmt 계산은 fetch된 매장 sales 기준.

## 5. 회귀 영향 / 안전성

- **기존 데이터**: NOT NULL DEFAULT false로 컬럼 추가하므로 모든 기존 행에 자동 false 적용. 별도 UPDATE 불필요.
- **기존 매출 계산**: 변경 없음. 택배 통계는 별도 reduce로 추가.
- **반품 처리**: 택배 표시는 sales 행 자체에 영향 없음. 반품 흐름은 기존대로 작동, 택배 통계도 `_eff > 0` 필터로 자동 정합성 유지.
- **다른 매출 페이지(LectureSalesPage, BizSalesPage)**: 강좌·특판 매출은 별개 테이블이라 영향 없음. 택배 요청은 매장 상품 판매(`sales` 테이블)에만 해당.
- **HomePage 대시보드**: 매출 합계 표시에 택배 카드 추가 여부는 별도 결정. 현재는 매출조회 페이지에만 표시 (비목표 §6 참조).
- **CSV/엑셀 다운로드**: 기존 다운로드 함수가 sales 컬럼 명시적으로 매핑한다면 `delivery_requested`는 자동 포함 안 됨. 다운로드에 포함하려면 별도 작업 — 이번 범위는 화면 표시까지만.

## 6. 비목표 (Out of Scope)

- 배송지 주소·받는분 연락처·메모 캡처
- 운송장 번호 입력/관리, 발송 상태(미발송/발송중/도착)
- 택배비 별도 계산
- HomePage 대시보드 카드에 택배 통계 추가 (필요 시 별도 spec)
- 엑셀/CSV 다운로드에 택배 정보 포함 (필요 시 별도 spec)
- 강좌/특판 매출 페이지 적용 (대상이 다름)
- 택배 요청한 건의 별도 알림/태스크 흐름 (예: 본사 발송 담당자에게 notify)
