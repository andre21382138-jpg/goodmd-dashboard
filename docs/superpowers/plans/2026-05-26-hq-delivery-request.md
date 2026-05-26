# 본사 택배발송 요청 워크플로 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매장 판매입력 시 상품 라인별로 택배 종류(없음/매장발송/본사요청)를 선택하고, 본사요청 시 배송지 정보를 입력하여 본사가 신규 "택배요청" 메뉴에서 거래 단위 그룹 카드로 확인 후 발송처리한다.

**Architecture:** `sales` 테이블에 `delivery_type` 컬럼을 추가하여 기존 boolean을 3-값 enum-like 문자열로 확장하고, `recipient_*` / `delivery_status` / `dispatched_*` 컬럼을 함께 추가. `SalesInputPage`에서 라인별 드롭다운 + 거래 단위 배송지 입력 폼. 신규 `HQDeliveryRequestPage`가 같은 (sold_at + recipient_phone + customer_id + 매장)을 키로 라인을 그룹핑하여 카드 형태로 표시하고, [발송처리] 클릭 시 그룹의 모든 sales 행을 일괄 dispatched로 update. `NotificationCenter` 본사 블록에 pending 카운트 추가.

**Tech Stack:** React 18, Supabase JS, 기존 CRA 빌드. 별도 테스트 프레임워크 없음 — 각 task는 `npm run build` 통과 + 코드 검토로 검증.

**Spec:** [docs/superpowers/specs/2026-05-26-hq-delivery-request-design.md](../specs/2026-05-26-hq-delivery-request-design.md)

---

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/pages/sales/SalesInputPage.jsx` | 라인별 택배 드롭다운, 배송지 입력 섹션, insert payload 확장 | Modify |
| `src/pages/customer/HQDeliveryRequestPage.jsx` | 신규 — 본사 발송 대기/완료 그룹 카드 + 발송처리 | **Create** |
| `src/lib/constants.js` | HQ_MENUS 고객관리 sub에 `📦 택배요청` 추가 | Modify |
| `src/App.js` | 신규 라우트 + import | Modify |
| `src/pages/sales/SalesListPage.jsx` | 행별 본사 발송 상태 배지 (pending/dispatched) | Modify |
| `src/pages/sales/MgrSalesViewPage.jsx` | 동일 배지 (펼침 상세) | Modify |
| `src/components/NotificationCenter.jsx` | 본사 알림에 pending delivery 카운트 추가 | Modify |

---

## Prerequisites (사용자가 Supabase SQL Editor에서 직접 실행)

```sql
-- 컬럼 추가
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

-- 기존 delivery_requested=true 매장발송으로 마이그레이션
UPDATE sales SET delivery_type = 'store'
WHERE delivery_requested = true AND delivery_type = 'none';

-- 검증
SELECT delivery_type, COUNT(*) FROM sales GROUP BY delivery_type;
```

기존 `delivery_requested` 컬럼은 그대로 유지 (호환성).

---

## Task 1: SalesInputPage — 라인 드롭다운 + 배송지 입력 + insert

**Files:**
- Modify: `src/pages/sales/SalesInputPage.jsx`

### Step 1: 라인 state — delivery boolean → 문자열 변경

기존 `newLine()` 약 17~25행:

```jsx
  const newLine = () => ({
    id: Date.now()+Math.random(),
    brandId:'', productId:'', productSearch:'', showSuggestions:false,
    quantity:1, normalPrice:'', discount:'0', price:'',
    payment:'카드',
    delivery:false,
    pointCustomer:null,
    pointsUsed:0,
  });
```

다음으로 변경:

```jsx
  const newLine = () => ({
    id: Date.now()+Math.random(),
    brandId:'', productId:'', productSearch:'', showSuggestions:false,
    quantity:1, normalPrice:'', discount:'0', price:'',
    payment:'카드',
    delivery:'none',  // 'none' | 'store' | 'hq'
    pointCustomer:null,
    pointsUsed:0,
  });
```

- [ ] **Step 2: 배송지 state 추가**

기존 `const [memo, setMemo] = useState('');` (약 8행) 다음에 4개 state 추가:

```jsx
  const [memo,      setMemo]     = useState('');
  // 본사발송 요청 배송지 정보 (한 거래에 본사요청 라인이 1개 이상이면 사용)
  const [recipName,    setRecipName]    = useState('');
  const [recipPhone,   setRecipPhone]   = useState('');
  const [recipAddr,    setRecipAddr]    = useState('');
  const [deliveryNotes,setDeliveryNotes]= useState('');
```

- [ ] **Step 3: resetForm에 배송지 state 초기화 추가**

기존 약 180행:

```jsx
  const resetForm = () => {
    setLines([newLine()]); setMemo('');
    setCustName(''); setCustPhone(''); setCustBirthday(''); setManagerName('');
    setMemberMode('none'); setMemberSearch(''); setMemberResults([]); setSelMember(null);
  };
```

다음으로 변경:

```jsx
  const resetForm = () => {
    setLines([newLine()]); setMemo('');
    setRecipName(''); setRecipPhone(''); setRecipAddr(''); setDeliveryNotes('');
    setCustName(''); setCustPhone(''); setCustBirthday(''); setManagerName('');
    setMemberMode('none'); setMemberSearch(''); setMemberResults([]); setSelMember(null);
  };
```

- [ ] **Step 4: 저장 직전 validation 추가**

`searchMembers`나 `handleSubmit` 함수 시작 부분 — 구체적으로 `validLines`가 정의된 직후, `for (const l of validLines)` 루프 직전에 다음 검증 코드 추가:

먼저 검증 위치 식별: 약 213행 `const validLines = ...` 라인 이후를 찾아 다음 코드를 그 직후에 삽입:

```jsx
      // 본사발송 요청 라인이 있으면 배송지 필수 검증
      const hasHqRequest = validLines.some(l => l.delivery === 'hq');
      if (hasHqRequest) {
        if (!recipName.trim() || !recipPhone.trim() || !recipAddr.trim()) {
          toast('본사 발송 요청 배송지(받는사람·연락처·주소)를 모두 입력해주세요', 'err');
          setSaving(false);
          return;
        }
      }
```

- [ ] **Step 5: insert payload 변경 — delivery_type 및 recipient**

기존 insert (약 223~231행):

```jsx
        const { error } = await supabase.from('sales').insert({
          sold_at: soldAt, store_name: profile.department, branch_name: profile.branch,
          brand_id: Number(l.brandId), product_id: Number(l.productId),
          quantity: Number(l.quantity), price: Number(String(l.price).replace(/,/g,'')),
          payment: l.payment || '카드', memo: memo.trim() || null, created_by: profile.id,
          customer_id: customerId, points_earned: linePoints,
          points_used: pointsUsedLine,
          delivery_requested: !!l.delivery,
        });
```

다음으로 변경:

```jsx
        const dType = l.delivery || 'none';
        const deliveryFields = dType === 'hq'
          ? {
              delivery_type: 'hq',
              delivery_status: 'pending',
              recipient_name: recipName.trim(),
              recipient_phone: recipPhone.trim(),
              recipient_address: recipAddr.trim(),
              delivery_notes: deliveryNotes.trim() || null,
              delivery_requested: true, // 호환성
            }
          : dType === 'store'
          ? { delivery_type: 'store', delivery_requested: true }
          : { delivery_type: 'none', delivery_requested: false };
        const { error } = await supabase.from('sales').insert({
          sold_at: soldAt, store_name: profile.department, branch_name: profile.branch,
          brand_id: Number(l.brandId), product_id: Number(l.productId),
          quantity: Number(l.quantity), price: Number(String(l.price).replace(/,/g,'')),
          payment: l.payment || '카드', memo: memo.trim() || null, created_by: profile.id,
          customer_id: customerId, points_earned: linePoints,
          points_used: pointsUsedLine,
          ...deliveryFields,
        });
```

- [ ] **Step 6: 라인 택배 셀 — 체크박스 → 드롭다운**

기존 약 429~442행 `{/* 택배 체크박스 */}` 블록:

```jsx
                  {/* 택배 체크박스 */}
                  <label title="택배 발송 요청" style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                    height:38, border:'1px solid', borderRadius:'var(--radius)', cursor:'pointer',
                    borderColor: l.delivery ? '#e65100' : 'var(--border)',
                    background: l.delivery ? '#fff3e0' : '#fff',
                    color: l.delivery ? '#e65100' : 'var(--text2)',
                    fontWeight: l.delivery ? 700 : 500, fontSize:12,
                  }}>
                    <input type="checkbox" checked={!!l.delivery}
                      onChange={e => updateLine(l.id, 'delivery', e.target.checked)}
                      style={{width:14, height:14, cursor:'pointer', margin:0}}/>
                    택배
                  </label>
```

다음으로 변경 (드롭다운으로):

```jsx
                  {/* 택배 종류 드롭다운 */}
                  <select value={l.delivery || 'none'}
                    onChange={e => updateLine(l.id, 'delivery', e.target.value)}
                    title="택배 발송 종류"
                    style={{
                      height:38, padding:'0 6px',
                      border:'1px solid',
                      borderRadius:'var(--radius)', cursor:'pointer',
                      borderColor: l.delivery === 'none' || !l.delivery ? 'var(--border)' : '#e65100',
                      background: l.delivery === 'none' || !l.delivery ? '#fff' : '#fff3e0',
                      color: l.delivery === 'none' || !l.delivery ? 'var(--text2)' : '#e65100',
                      fontWeight: l.delivery === 'none' || !l.delivery ? 500 : 700, fontSize:12,
                      outline:'none', appearance:'auto'
                    }}>
                    <option value="none">없음</option>
                    <option value="store">매장발송</option>
                    <option value="hq">본사요청</option>
                  </select>
```

- [ ] **Step 7: 그리드 컬럼 폭 60px → 80px (헤더 + 3 grid 위치)**

기존 그리드 템플릿 (3곳 — 309, 354, 426행 부근):

```
'minmax(220px, 1fr) 60px 100px 100px 100px 320px 60px 50px 34px'
```

`80px`로 변경 (택배 컬럼만 폭 늘림):

```
'minmax(220px, 1fr) 60px 100px 100px 100px 320px 80px 50px 34px'
```

각 위치는 Grep으로 찾아서 모두 동일하게 변경. `replace_all` 가능.

- [ ] **Step 8: 배송지 입력 섹션 — 메모 섹션 직후**

메모 섹션 (약 468~471행) 직후, 회원적립 섹션 직전에 다음 추가:

```jsx
          {/* 본사 발송 배송지 (본사요청 라인이 있을 때만 표시) */}
          {lines.some(l => l.delivery === 'hq') && (
            <div style={{ background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#e65100', marginBottom:10 }}>
                📦 본사 발송 배송지 정보 *
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={labelStyle}>받는사람 *</label>
                  <input value={recipName} onChange={e => setRecipName(e.target.value)}
                    style={inputStyle} placeholder="예: 홍길동" />
                </div>
                <div>
                  <label style={labelStyle}>연락처 *</label>
                  <input value={recipPhone} onChange={e => setRecipPhone(e.target.value)}
                    style={inputStyle} placeholder="010-1234-5678" />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={labelStyle}>주소 *</label>
                <input value={recipAddr} onChange={e => setRecipAddr(e.target.value)}
                  style={inputStyle} placeholder="예: 서울 강남구 ..." />
              </div>
              <div>
                <label style={labelStyle}>요청사항</label>
                <input value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                  style={inputStyle} placeholder="예: 부재 시 경비실에 (선택)" />
              </div>
            </div>
          )}
```

- [ ] **Step 9: 빌드 + 커밋**

```bash
cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6
git add src/pages/sales/SalesInputPage.jsx
git commit -m "$(cat <<'EOF'
feat(sales): 판매 입력에 본사 택배요청 옵션 + 배송지 입력 추가

- 라인별 택배 셀: 체크박스 → 드롭다운 (없음/매장발송/본사요청)
- 본사요청 라인이 있으면 거래 단위 배송지 입력 섹션 자동 노출
  (받는사람·연락처·주소·요청사항)
- 저장 시 delivery_type 컬럼 사용 + 본사요청은 delivery_status='pending'
- 기존 delivery_requested boolean도 호환성 유지

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: HQDeliveryRequestPage 신설 + 메뉴 + 라우트

**Files:**
- Create: `src/pages/customer/HQDeliveryRequestPage.jsx`
- Modify: `src/lib/constants.js`
- Modify: `src/App.js`

### Step 1: HQDeliveryRequestPage 작성

`src/pages/customer/HQDeliveryRequestPage.jsx` 신규 파일:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

function groupKey(s) {
  return `${s.sold_at}|${s.recipient_phone || ''}|${s.customer_id || ''}|${s.store_name}|${s.branch_name}`;
}

function groupSales(rows) {
  const map = new Map();
  for (const s of (rows || [])) {
    const k = groupKey(s);
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        sold_at: s.sold_at,
        store_name: s.store_name,
        branch_name: s.branch_name,
        recipient_name: s.recipient_name,
        recipient_phone: s.recipient_phone,
        recipient_address: s.recipient_address,
        delivery_notes: s.delivery_notes,
        dispatched_at: s.dispatched_at,
        items: [],
      });
    }
    map.get(k).items.push(s);
  }
  // 최신 sold_at 우선
  return [...map.values()].sort((a, b) =>
    (b.sold_at || '').localeCompare(a.sold_at || '')
  );
}

export default function HQDeliveryRequestPage({ profile }) {
  const [tab, setTab] = useState('pending'); // 'pending' | 'dispatched'
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null); // groupKey 처리 중

  const fetchData = useCallback(async () => {
    setLoading(true);
    const limit = tab === 'pending' ? 200 : 50;
    const { data, error } = await supabase.from('sales')
      .select(`id, sold_at, store_name, branch_name, quantity, price,
               recipient_name, recipient_phone, recipient_address, delivery_notes,
               dispatched_at, customer_id,
               product:products(name, code)`)
      .eq('delivery_type', 'hq')
      .eq('delivery_status', tab)
      .order(tab === 'pending' ? 'sold_at' : 'dispatched_at', { ascending: false })
      .limit(limit);
    if (error) toast(error.message, 'err');
    else setGroups(groupSales(data));
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDispatch = async (group) => {
    const ok = window.confirm(
      `${group.recipient_name}님 (${group.recipient_phone})\n` +
      `${group.items.length}개 상품을 발송처리하시겠습니까?\n\n` +
      `처리 후 매장 매출조회에서 "✅ 본사발송 완료"로 표시됩니다.`
    );
    if (!ok) return;
    setProcessing(group.key);
    try {
      const ids = group.items.map(it => it.id);
      const { error } = await supabase.from('sales').update({
        delivery_status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        dispatched_by: profile.id,
      }).in('id', ids);
      if (error) throw error;
      toast(`${ids.length}건 발송처리 완료`, 'ok');
      fetchData();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='pending'?'on':''}`} onClick={() => setTab('pending')}>
          📦 발송 대기
        </button>
        <button className={`tab ${tab==='dispatched'?'on':''}`} onClick={() => setTab('dispatched')}>
          ✅ 발송 완료 (최근 50건)
        </button>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <span className="fresult">
            {tab === 'pending' ? '발송 대기 중인 본사 택배 요청' : '최근 발송 완료 건'} — <b>{groups.length}</b>건
          </span>
          <button className="btn btn-s" onClick={fetchData} disabled={loading}>
            {loading ? <span className="spinner"/> : '🔄 새로고침'}
          </button>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
          : groups.length === 0 ? <div className="empty">
              {tab === 'pending' ? '발송 대기 중인 요청이 없습니다' : '발송 완료 이력이 없습니다'}
            </div>
          : (
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            {groups.map(g => {
              const isProc = processing === g.key;
              return (
                <div key={g.key} style={{
                  border:'1px solid #ffcc80', borderRadius:'var(--radius)',
                  background:'#fffaf0', padding:'14px 18px'
                }}>
                  {/* 헤더 — 받는사람 + 연락처 + 주소 */}
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:15, fontWeight:700, color:'var(--text)'}}>
                      📦 {g.recipient_name} <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)', marginLeft:6}}>{g.recipient_phone}</span>
                    </div>
                    <div style={{fontSize:12, color:'var(--text2)', marginTop:3}}>📍 {g.recipient_address}</div>
                    {g.delivery_notes && (
                      <div style={{fontSize:11, color:'var(--text3)', marginTop:3}}>💬 {g.delivery_notes}</div>
                    )}
                  </div>
                  {/* 매장 + 날짜 */}
                  <div style={{display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--text3)', marginBottom:8}}>
                    <span className="badge badge-dept">{g.store_name}</span>
                    <span className="badge badge-store">{g.branch_name}</span>
                    <span className="mono">{g.sold_at}</span>
                    {tab === 'dispatched' && g.dispatched_at && (
                      <span style={{marginLeft:'auto', color:'var(--success)'}}>
                        ✅ 발송완료: {new Date(g.dispatched_at).toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>
                  {/* 상품 라인 */}
                  <div style={{background:'#fff', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', marginBottom: tab==='pending' ? 12 : 0}}>
                    {g.items.map(it => (
                      <div key={it.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:12, padding:'3px 0'}}>
                        <span style={{flex:1}}>{it.product?.name || '-'}</span>
                        <span className="mono" style={{color:'var(--text3)', fontSize:11}}>{it.product?.code || '-'}</span>
                        <span style={{fontFamily:'var(--mono)', fontWeight:700}}>×{it.quantity}</span>
                      </div>
                    ))}
                  </div>
                  {/* 발송처리 버튼 (pending 탭만) */}
                  {tab === 'pending' && (
                    <div style={{display:'flex', justifyContent:'flex-end'}}>
                      <button className="btn btn-p" onClick={() => handleDispatch(g)} disabled={isProc}
                        style={{padding:'0 18px', height:36, fontWeight:700, fontSize:13}}>
                        {isProc ? <span className="spinner"/> : '✓ 발송처리'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 2: constants.js — 사이드바 메뉴 추가

기존 `HQ_MENUS` `member_mgmt` sub (약 56~60행):

```js
  { key: 'member_mgmt', icon: '👥', label: '고객관리', sub: [
    { key: 'member_mgmt',         icon: '🔍', label: '회원 조회' },
    { key: 'sms_history',         icon: '📨', label: '문자 내역' },
    { key: 'sms_unsubscribe_sync', icon: '🚫', label: '수신거부 동기화' },
  ]},
```

다음으로 변경:

```js
  { key: 'member_mgmt', icon: '👥', label: '고객관리', sub: [
    { key: 'member_mgmt',          icon: '🔍', label: '회원 조회' },
    { key: 'sms_history',          icon: '📨', label: '문자 내역' },
    { key: 'sms_unsubscribe_sync', icon: '🚫', label: '수신거부 동기화' },
    { key: 'hq_delivery_request',  icon: '📦', label: '택배요청' },
  ]},
```

### Step 3: App.js — import + 라우트

`src/App.js` 상단 import 영역 (`SmsUnsubscribeSyncPage` import 줄 다음에):

```js
import HQDeliveryRequestPage from './pages/customer/HQDeliveryRequestPage';
```

페이지 라벨 dict (약 615행 부근, `sms_unsubscribe_sync: '수신거부 동기화',` 다음):

```js
    sms_unsubscribe_sync: '수신거부 동기화',
    hq_delivery_request: '택배요청',
```

라우트 (약 677행 부근, SmsUnsubscribeSyncPage 라인 다음):

```jsx
            {page === 'sms_unsubscribe_sync' && canSeeMain && <SmsUnsubscribeSyncPage/>}
            {page === 'hq_delivery_request' && canSeeMain && <HQDeliveryRequestPage profile={profile}/>}
```

### Step 4: 빌드 + 커밋

```bash
cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6
git add src/pages/customer/HQDeliveryRequestPage.jsx src/lib/constants.js src/App.js
git commit -m "$(cat <<'EOF'
feat(delivery): 본사 택배요청 처리 페이지 신설

본사 → 고객관리 → 📦 택배요청 메뉴 신설.
- 발송 대기 / 완료 탭
- 같은 거래(sold_at + recipient_phone + customer_id + 매장) 그룹 카드
- 받는사람·주소·요청사항·상품 라인 표시
- [✓ 발송처리] 클릭 시 그룹 모든 행 일괄 dispatched 처리

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: SalesListPage 본사 매출조회 — 상태 배지

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

### Step 1: 매출 리스트 상품명 셀 — 본사 발송 배지 추가

기존 기존 매장발송 배지(`s.delivery_requested` 사용)가 있는 상품명 td를 찾아 다음과 같이 변경.

`Grep`으로 `delivery_requested` 검색하여 위치 확인 후, 기존 매장발송 배지 분기를 다음 패턴으로 교체:

기존:
```jsx
                      <td style={strikeStyle}>
                        {s.product?.name || '-'}
                        {s.delivery_requested && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>🚚 택배</span>}
                        {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                        {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {s.returned_qty}개</span>}
                      </td>
```

다음으로 변경:

```jsx
                      <td style={strikeStyle}>
                        {s.product?.name || '-'}
                        {s.delivery_type === 'store' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>🚚 매장발송</span>}
                        {s.delivery_type === 'hq' && s.delivery_status === 'pending' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>📦 본사발송 대기</span>}
                        {s.delivery_type === 'hq' && s.delivery_status === 'dispatched' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 6px', borderRadius:3}}>✅ 본사발송 완료</span>}
                        {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                        {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {s.returned_qty}개</span>}
                      </td>
```

### Step 2: select 절에 신규 컬럼 추가 (필요한 경우)

기존 fetchSales 함수의 select 절을 확인 — `delivery_type`, `delivery_status` 컬럼 없으면 추가 필요.

`Grep`으로 `from('sales').select`를 찾아 select 절 확인. 만약 `.select('*, ...')` 형태면 자동으로 모든 컬럼 포함되므로 변경 불필요. 명시적 컬럼 나열이면 `delivery_type, delivery_status` 추가.

### Step 3: 빌드 + 커밋

```bash
cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6
git add src/pages/sales/SalesListPage.jsx
git commit -m "$(cat <<'EOF'
feat(sales): 본사 매출조회에 본사발송 대기/완료 배지

- 🚚 매장발송: 기존 delivery_requested → delivery_type='store' 기준으로 변경
- 📦 본사발송 대기: delivery_type='hq' + status='pending' (주황)
- ✅ 본사발송 완료: delivery_type='hq' + status='dispatched' (녹색)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: MgrSalesViewPage 매장 매출조회 — 상태 배지

**Files:**
- Modify: `src/pages/sales/MgrSalesViewPage.jsx`

### Step 1: 일자별 펼침 상세의 상품 셀 변경

기존 매장발송 배지 위치를 `Grep`으로 찾아 (검색어: `delivery_requested` 또는 `🚚 택배`):

기존 (한 줄로 매장발송 배지만 있음):
```jsx
                                      {it.delivery_requested && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>🚚 택배</span>}
```

다음 3개 배지로 변경 (해당 라인을 다음 블록으로 교체):

```jsx
                                      {it.delivery_type === 'store' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>🚚 매장발송</span>}
                                      {it.delivery_type === 'hq' && it.delivery_status === 'pending' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>📦 본사발송 대기</span>}
                                      {it.delivery_type === 'hq' && it.delivery_status === 'dispatched' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 6px', borderRadius:3}}>✅ 본사발송 완료</span>}
```

### Step 2: 빌드 + 커밋

```bash
cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6
git add src/pages/sales/MgrSalesViewPage.jsx
git commit -m "$(cat <<'EOF'
feat(sales): 매장 매출조회 일자별 상세에 본사발송 배지 추가

매장발송 / 본사발송 대기 / 본사발송 완료 3가지 상태 배지로 통합.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: NotificationCenter — 본사 발송 대기 알림

**Files:**
- Modify: `src/components/NotificationCenter.jsx`

### Step 1: canHQ 블록에 알림 추가

기존 약 86~96행에 있는 매장 새 재고요청 알림 코드 다음에 다음 블록 추가:

```jsx
      // 본사 택배발송 대기
      const { count: pendingDelivery } = await supabase.from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_type', 'hq')
        .eq('delivery_status', 'pending');
      if (pendingDelivery && pendingDelivery > 0) {
        list.push({
          key: `hq_delivery_pending`, color:'orange', icon:'📦',
          title:`택배 발송요청 ${pendingDelivery}건`,
          msg:'본사 발송 처리 대기 중',
          page:'hq_delivery_request',
        });
      }
```

### Step 2: Realtime 구독에 sales 테이블 추가

기존 약 145~155행의 Realtime 구독 블록에 sales 추가:

```jsx
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales',
            filter: 'delivery_type=eq.hq' }, () => {
        buildNotifs();
      })
      .subscribe();
```

(filter 옵션이 작동 안하는 환경이면 filter 제거하고 모든 sales 변경에 buildNotifs — 약간 부하는 있지만 무해)

### Step 3: 빌드 + 커밋

```bash
cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6
git add src/components/NotificationCenter.jsx
git commit -m "$(cat <<'EOF'
feat(notif): 본사 알림에 택배 발송요청 대기 카운트 추가

sales delivery_type='hq' + status='pending' 카운트를 본사 알림센터에 표시.
클릭 시 hq_delivery_request 페이지로 이동.
Realtime 구독에 sales 테이블 추가 (delivery_type='hq' 필터).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 통합 빌드 + 푸시

### Step 1: 최종 빌드

```bash
cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -10
```
Expected: Compiled with warnings (기존만), 새 에러 없음.

### Step 2: 푸시

```bash
git push origin main
```

### Step 3: 수동 점검 (사용자가 직접)

```
☐ Supabase SQL Editor에서 Prereq SQL 실행 (ALTER TABLE + index + UPDATE)
☐ 매장 → 판매 입력
   ☐ 라인 택배 셀에 드롭다운(없음/매장발송/본사요청) 노출
   ☐ 본사요청 선택 시 폼 하단에 배송지 입력 섹션 자동 표시
   ☐ 받는사람·연락처·주소 미입력 시 저장 거부 + toast 에러
   ☐ 저장 성공 → 폼 리셋
☐ 본사 → 고객관리 → 📦 택배요청 메뉴 노출
   ☐ 발송 대기 탭 — 새 요청 카드 표시
   ☐ 카드에 받는사람·주소·상품 라인 모두 보임
   ☐ [✓ 발송처리] 클릭 → confirm → 처리 → 발송 완료 탭으로 이동
☐ 본사 알림센터 — "택배 발송요청 N건" 표시, 클릭 시 페이지 이동
☐ 본사 매출조회 — 행별 배지 (🚚 매장발송 / 📦 본사발송 대기 / ✅ 본사발송 완료)
☐ 매장 매출조회 — 펼침 상세에 동일 배지
```

---

## Self-Review

### Spec coverage

| Spec 섹션 | 대응 Task |
|---|---|
| §2.1 매장 판매 입력 흐름 | Task 1 |
| §2.2 본사 처리 흐름 | Task 2 |
| §2.3 매장 매출조회 상태 확인 | Task 4 |
| §3.1 컬럼 추가 | Prerequisites |
| §3.2 마이그레이션 | Prerequisites |
| §3.3 컬럼 의미 | Task 1 insert 매핑에 반영 |
| §4 HQDeliveryRequestPage 위치/구조 | Task 2 |
| §5.1 라인 드롭다운 | Task 1 (Step 6) |
| §5.2 배송지 입력 섹션 | Task 1 (Step 8) |
| §5.3 저장 validation + insert | Task 1 (Step 4, 5) |
| §5.4 폼 리셋 | Task 1 (Step 3) |
| §6.1 SalesListPage 배지 | Task 3 |
| §6.2 MgrSalesViewPage 배지 | Task 4 |
| §6.3 요약 카드 추가 | (간소화 — 비목표) |
| §7 알림 통합 | Task 5 |
| §8 회귀 영향 | 각 Task에서 기존 호환성 유지 |
| §9 비목표 | 구현 안 함 |

### Placeholder scan

- "TBD" / "implement later" 없음.
- Task 1 Step 4의 "검증 위치 식별" — `validLines` 정의 직후라는 명확한 위치 지정 있음.
- Task 3 Step 2의 "select 절 확인" — 자동 포함이면 변경 불필요, 명시적이면 추가하라는 분기 안내 있음.

### Type consistency

- `delivery_type` 값: `'none'` / `'store'` / `'hq'` — Task 1, 2, 3, 4 모두 동일
- `delivery_status` 값: `'pending'` / `'dispatched'` — Task 1, 2, 3, 4, 5 모두 동일
- `recipient_name` / `recipient_phone` / `recipient_address` / `delivery_notes` — 모두 일관
- 라인 state `delivery` 값: 이전 boolean → 이번에 문자열 `'none'/'store'/'hq'`로 변경. Task 1 내부에서 newLine, updateLine, select, 저장 payload 모두 일관.
- 페이지 key `'hq_delivery_request'` — constants.js, App.js 라우트, NotificationCenter page 모두 동일.
- 그룹 키 `${sold_at}|${recipient_phone}|${customer_id}|${store_name}|${branch_name}` — Task 2 내부 일관.
