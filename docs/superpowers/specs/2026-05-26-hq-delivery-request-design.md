# 본사 택배발송 요청 워크플로 (Design)

작성일: 2026-05-26
대상 영역:
- DB: `sales` 테이블 컬럼 확장 (delivery_type, recipient_*, delivery_status, dispatched_*)
- `src/pages/sales/SalesInputPage.jsx` — 라인별 택배 종류 선택 + 본사요청 시 배송지 입력 섹션
- `src/pages/customer/HQDeliveryRequestPage.jsx` — 신규: 본사 발송 대기/완료 처리
- `src/lib/constants.js` — HQ_MENUS 고객관리 sub에 `📦 택배요청` 신규 메뉴
- `src/App.js` — 신규 라우트
- `src/pages/sales/SalesListPage.jsx` & `MgrSalesViewPage.jsx` — 본사 발송 상태 배지

## 1. 배경 / 목적

매장에서 판매 입력 시 고객이 택배 발송을 요청하는 경우가 있다. 현재 시스템은 단일 `delivery_requested` boolean으로 표시만 가능. 그러나 실무상 택배 발송 주체는 두 가지:

1. **매장에서 직접 택배 발송** — 매장이 택배 박싱·발송까지 처리, 시스템엔 마커만 기록
2. **본사에 발송 요청** — 매장이 배송지 정보를 입력하고 본사가 받아서 택배 발송 처리

지금까지의 '택배' 체크박스는 (1)에만 해당했다. (2)는 외부 채널(전화/카톡)로 처리되어 시스템에 흔적이 없고, 본사가 매번 매장에 별도 확인해야 했다.

본 작업으로:
- 판매 입력 시 택배 종류를 선택 (없음/매장발송/본사요청)
- 본사요청 시 배송지 정보(받는사람·연락처·주소·요청사항) 캡처
- 본사에 신규 메뉴 `📦 택배요청`에서 대기 건 확인 + 발송처리 워크플로

## 2. 사용자 흐름

### 2.1 매장 매니저 — 판매 입력

1. 매장 → 판매 입력 진입.
2. 평소처럼 상품·수량·결제 입력.
3. 각 상품 라인의 **택배 셀에서 드롭다운 선택**:
   - `없음` (기본) — 일반 매장 판매
   - `매장발송` — 매장이 직접 택배 발송 (단순 마커)
   - `본사요청` — 본사에 발송 요청
4. 라인 중 **하나라도 `본사요청`이 있으면** 폼 하단에 자동으로 **배송지 입력 섹션** 펼침:
   ```
   ┌─ 📦 본사 발송 배송지 정보 ───────────────┐
   │ 받는사람 *  [홍길동]                     │
   │ 연락처   *  [010-1234-5678]              │
   │ 주소     *  [서울 강남구 ...]            │
   │ 요청사항    [부재 시 경비실에]           │
   └────────────────────────────────────────┘
   ```
5. 모든 본사요청 라인은 같은 배송지 사용 (입력 1회).
6. 저장 시:
   - 매장발송 라인: `delivery_type='store'`, status=null
   - 본사요청 라인: `delivery_type='hq'`, recipient_*, delivery_status='pending'

### 2.2 본사 — 신규 메뉴 "📦 택배요청"에서 처리

1. 본사 → 고객관리 → **📦 택배요청** 진입.
2. 화면 상단 두 탭:
   - **발송 대기** (`delivery_status='pending'`) — 처리 필요
   - **발송 완료** (`delivery_status='dispatched'`) — 최근 50건
3. 발송 대기 탭 — 표 표시:
   | 매출일 | 매장/지점 | 상품 | 받는사람 | 연락처 | 주소 | 요청사항 | 작업 |
   |---|---|---|---|---|---|---|---|
   | 2026-05-26 | 팔레오 광진점 | 슬리퍼 ×2 | 홍길동 | 010-... | 강남구... | 경비실 | [✓ 발송처리] |
4. 같은 매출 단위(거래)는 같은 배송지 정보를 가지므로 시각적으로 그룹핑 (`recipient_phone + sold_at + customer_id` 기준 카드형):
   ```
   ┌─ 홍길동 (010-1234-5678) ─ 강남구 ... ─┐
   │ 2026-05-26 · 팔레오 광진점          │
   │ ├─ 슬리퍼 ×2                        │
   │ ├─ 양말 ×3                          │
   │ 요청사항: 부재 시 경비실에           │
   │                       [✓ 발송처리]   │
   └─────────────────────────────────────┘
   ```
   [발송처리] 클릭 시 그룹 내 모든 라인을 한번에 dispatched 처리.
5. [✓ 발송처리] 클릭 → confirm → `delivery_status='dispatched'`, `dispatched_at=NOW()`, `dispatched_by=본사ID` 일괄 update.
6. 발송 완료 탭으로 이동되어 보임.

### 2.3 매장 매니저 — 매출조회에서 상태 확인

매장 본인 매출조회(`MgrSalesViewPage`) 일자별 펼침 상세 + 본사 매출조회(`SalesListPage`) 리스트:

- 상품명 옆 작은 배지 — `delivery_type`에 따라:
  - `매장발송`: `🚚 매장발송` (기존 동작, 주황 유지)
  - `본사요청 + pending`: `📦 본사발송 대기` (주황)
  - `본사요청 + dispatched`: `✅ 본사발송 완료` (녹색)
- 매장은 본인이 보낸 요청의 처리 상태를 매출 화면에서 자연스럽게 확인

## 3. 데이터 모델

### 3.1 컬럼 추가

```sql
ALTER TABLE sales
  ADD COLUMN delivery_type text NOT NULL DEFAULT 'none',
  ADD COLUMN recipient_name text,
  ADD COLUMN recipient_phone text,
  ADD COLUMN recipient_address text,
  ADD COLUMN delivery_notes text,
  ADD COLUMN delivery_status text,
  ADD COLUMN dispatched_at timestamptz,
  ADD COLUMN dispatched_by uuid REFERENCES auth.users(id);

CREATE INDEX idx_sales_delivery_status ON sales (delivery_type, delivery_status)
  WHERE delivery_type = 'hq';
```

### 3.2 기존 데이터 마이그레이션

```sql
-- 기존 delivery_requested=true 였던 행은 매장발송으로 분류
UPDATE sales SET delivery_type = 'store'
WHERE delivery_requested = true AND delivery_type = 'none';

-- 검증
SELECT delivery_type, COUNT(*) FROM sales GROUP BY delivery_type;
```

기존 `delivery_requested` 컬럼은 일단 유지 (호환성). 신규 코드는 모두 `delivery_type` 사용.

### 3.3 컬럼 의미

| 컬럼 | 값 | 의미 |
|---|---|---|
| `delivery_type` | `'none'` | 매장 픽업 (기본) |
| | `'store'` | 매장이 직접 택배 발송 (단순 마커) |
| | `'hq'` | 본사에 발송 요청 |
| `recipient_name/phone/address` | text | hq일 때 필수 |
| `delivery_notes` | text | hq일 때 선택 (요청사항) |
| `delivery_status` | `'pending'` | hq 신규 요청, 본사 처리 대기 |
| | `'dispatched'` | 본사가 발송처리 완료 |
| `dispatched_at` | timestamptz | 본사 처리 시각 |
| `dispatched_by` | uuid | 처리한 본사 사용자 |

## 4. 본사 신규 페이지 (HQDeliveryRequestPage)

### 4.1 위치

`src/pages/customer/HQDeliveryRequestPage.jsx` (신규)

사이드바: `HQ_MENUS` → `member_mgmt` (고객관리) sub 에 추가:
```js
{ key: 'hq_delivery_request', icon: '📦', label: '택배요청' }
```

### 4.2 페이지 구조

```jsx
function HQDeliveryRequestPage() {
  const [tab, setTab] = useState('pending'); // 'pending' | 'dispatched'
  const [groups, setGroups] = useState([]);

  const fetchPending = async () => {
    const { data } = await supabase.from('sales')
      .select(`id, sold_at, store_name, branch_name, quantity, price,
               recipient_name, recipient_phone, recipient_address, delivery_notes,
               dispatched_at, customer_id,
               product:products(name, code)`)
      .eq('delivery_type', 'hq')
      .eq('delivery_status', tab)
      .order('sold_at', { ascending: false })
      .limit(tab === 'pending' ? 200 : 50);
    // 같은 거래 그룹핑: recipient_phone + sold_at + customer_id
    const grouped = groupSales(data || []);
    setGroups(grouped);
  };

  const handleDispatch = async (group) => {
    if (!window.confirm(`${group.recipient_name}님 ${group.items.length}개 상품을 발송처리하시겠습니까?`)) return;
    const ids = group.items.map(it => it.id);
    const { error } = await supabase.from('sales').update({
      delivery_status: 'dispatched',
      dispatched_at: new Date().toISOString(),
      dispatched_by: profile.id,
    }).in('id', ids);
    if (error) toast(error.message, 'err');
    else { toast(`${ids.length}건 발송처리 완료`, 'ok'); fetchPending(); }
  };

  // 렌더: 탭 + 카드형 그룹 리스트
}
```

### 4.3 그룹핑 키

같은 거래(한 번의 판매 입력)는 같은 배송지를 가지므로:
- 키: `${recipient_phone}|${sold_at}|${store_name}|${branch_name}|${customer_id || 'guest'}`
- 같은 키의 라인들 → 하나의 카드로 표시
- 발송처리는 카드 단위(모든 라인 일괄 update)

라인별 부분 발송처리는 비목표 (한 거래 = 한 박스 가정).

## 5. 매장 측 UI (SalesInputPage)

### 5.1 라인별 택배 셀

기존 `[□ 택배]` 체크박스 자리를 **드롭다운**으로 교체:

```jsx
<select value={l.delivery || 'none'}
  onChange={e => updateLine(l.id, 'delivery', e.target.value)}
  style={{ /* 결제 버튼과 비슷한 높이/스타일 */ }}>
  <option value="none">없음</option>
  <option value="store">매장발송</option>
  <option value="hq">본사요청</option>
</select>
```

라인 state `delivery`는 기존 boolean → `'none' | 'store' | 'hq'` 문자열로 변경.

### 5.2 배송지 입력 섹션 (조건부)

라인 중 `delivery === 'hq'` 가 하나라도 있으면 폼 하단에 자동 표시:

```jsx
const hasHqRequest = lines.some(l => l.delivery === 'hq');

{hasHqRequest && (
  <div style={{background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14}}>
    <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:'#e65100'}}>
      📦 본사 발송 배송지 정보 *
    </div>
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
      <input value={recipName} onChange={...} placeholder="받는사람 *"/>
      <input value={recipPhone} onChange={...} placeholder="연락처 *"/>
    </div>
    <input value={recipAddr} onChange={...} placeholder="주소 *" style={{width:'100%', marginBottom:10}}/>
    <input value={deliveryNotes} onChange={...} placeholder="요청사항 (선택)" style={{width:'100%'}}/>
  </div>
)}
```

### 5.3 저장 validation + insert

저장 시:
- `hasHqRequest`면 받는사람/연락처/주소 필수 (없으면 toast 에러)
- 각 라인 insert payload에 `delivery_type`, 그리고 hq면 `recipient_*` + `delivery_status='pending'` 같이 저장
- 모든 hq 라인은 같은 recipient 정보 복사

```js
const lineExtras = (l) => {
  if (l.delivery === 'hq') {
    return {
      delivery_type: 'hq',
      delivery_status: 'pending',
      recipient_name: recipName.trim(),
      recipient_phone: recipPhone.trim(),
      recipient_address: recipAddr.trim(),
      delivery_notes: deliveryNotes.trim() || null,
    };
  } else if (l.delivery === 'store') {
    return { delivery_type: 'store' };
  } else {
    return { delivery_type: 'none' };
  }
};
```

### 5.4 폼 리셋

저장 후: 라인들 `delivery: 'none'` + 배송지 입력 모두 초기화.

## 6. 매출조회 페이지 — 상태 배지

### 6.1 SalesListPage (본사 매출조회) — 상품명 옆 배지

기존 매장발송 배지 + 본사요청 상태 배지 추가:

```jsx
{s.delivery_type === 'store' && !fully && <span style={{...주황}}>🚚 매장발송</span>}
{s.delivery_type === 'hq' && s.delivery_status === 'pending' && !fully &&
  <span style={{...주황}}>📦 본사발송 대기</span>}
{s.delivery_type === 'hq' && s.delivery_status === 'dispatched' && !fully &&
  <span style={{...녹색}}>✅ 본사발송 완료</span>}
```

### 6.2 MgrSalesViewPage (매장 매니저 매출조회) 펼침 상세

동일한 배지 적용.

### 6.3 요약 카드 (선택)

본사 매출조회 상단 기존 "🚚 택배발송" 카드 유지하되, 본사발송 별도 표시:
```
🚚 매장발송: 12건 / 1,200,000원
📦 본사발송 (대기): 5건
📦 본사발송 (완료): 8건
```
이번 스펙은 우선 매장발송 카드 유지 + **본사발송 대기 카드만 신규 추가** (간소화).

## 7. 알림 (선택)

본사 측 알림센터에 신규 `delivery_status='pending'` 카운트 추가 가능 (NotificationCenter `canHQ` 블록):

```jsx
const { count: pendingDelivery } = await supabase.from('sales')
  .select('id', { count: 'exact', head: true })
  .eq('delivery_type', 'hq')
  .eq('delivery_status', 'pending');
if (pendingDelivery > 0) {
  list.push({
    key: `hq_delivery_pending`, color:'orange', icon:'📦',
    title:`택배 발송요청 ${pendingDelivery}건`,
    msg:'본사 발송 처리 대기 중',
    page:'hq_delivery_request',
  });
}
```

본 spec에 포함. 매장이 새 요청 보내자마자 본사 알림에 표시되어 처리 진입점이 됨.

## 8. 회귀 영향 / 안전성

- **기존 `delivery_requested` 컬럼**: 제거 안 함, 신규 코드는 `delivery_type` 사용. 기존 코드가 boolean 컬럼 참조하면 그대로 동작 (`delivery_requested = true` → `delivery_type='store'` 매핑).
- **기존 매출 계산**: 변경 없음. delivery 정보는 별도 컬럼.
- **반품 처리**: delivery 정보에 영향 없음. 반품된 행은 매출에서 제외되지만 delivery_status는 그대로 (관리상 무해).
- **다중 회원/적립금**: 무관.
- **새 회원 vs 비회원**: 모두 본사요청 가능.

## 9. 비목표 (Out of Scope)

- 운송장 번호 입력/추적 (외부 시스템 별도 관리)
- 발송업체(CJ/롯데/한진) 선택
- 배송비 계산/청구
- 회원 등록 주소 자동 채우기 (직접 입력만)
- 부분 발송처리 (한 거래의 일부 상품만)
- 매장의 발송요청 취소 (잘못 입력 시 본사가 SQL 수동 처리)
- 본사 발송 완료 시 매장에 별도 알림 (매출조회 상태 표시로 충분)
- 배송지 주소 자동완성 (도로명 API 등)
- 매장발송 라인에도 배송지 캡처 (현재는 본사요청만 캡처)
