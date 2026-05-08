# 매장 정보 페이지 (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본사 사이드바에 `📍 매장 정보` 메뉴를 추가하고, 각 매장별 발주 마스터 정보(쇼핑몰ID·우편번호·주소·수취인 전화번호)를 등록·편집·일괄 import할 수 있는 페이지를 구현한다.

**Architecture:** 새 `store_addresses` 테이블에 매장 단위(`store_name + branch_name`)로 마스터 정보를 저장. 매장 목록은 기존 `STORE_MAP` 상수를 source of truth로 사용해 STORE_MAP × store_addresses 좌측 조인으로 표시. 신규 페이지는 `src/pages/store/StoreInfoPage.jsx`에 단일 파일로 구현하고 App.js 라우팅에 등록한다.

**Tech Stack:** React 18, Supabase JS, xlsx (이미 의존성 존재), 인라인 스타일.

**Spec:** `docs/superpowers/specs/2026-05-08-store-info-and-purchase-order-design.md`

**Test 전략:** 본 프로젝트에는 컴포넌트 테스트 인프라가 없으므로 각 작업은 `npm run build` + dev server 수동 검증으로 마무리한다.

---

## File Structure

- DB: `store_addresses` 테이블 (Supabase SQL Editor 직접 실행).
- Modify: `src/lib/constants.js` — HQ_MENUS에 `매장 정보` 메뉴 추가.
- Modify: `src/App.js` — PAGE_TITLES + import + 라우팅 추가.
- Create: `src/pages/store/StoreInfoPage.jsx` — 페이지 본체 (목록·필터·편집 모달·일괄 import).

새 디렉토리 `src/pages/store/`가 생기는 점만 주의(다른 폴더와 동일 패턴).

---

## Task 1: DB 스키마 + 사이드바 메뉴 + 빈 페이지 스캐폴드

**Files:**
- DB: `store_addresses` (Supabase SQL Editor)
- Modify: `src/lib/constants.js`
- Modify: `src/App.js`
- Create: `src/pages/store/StoreInfoPage.jsx`

이 단계의 목표는 메뉴 클릭 시 빈 페이지가 표시되는 데까지. 데이터 표·편집·import는 이후 Task에서 추가.

- [ ] **Step 1: Supabase에 SQL 실행 (controller 확인 필요)**

다음 SQL을 Supabase 콘솔(SQL Editor)에서 실행:

```sql
CREATE TABLE store_addresses (
  id              SERIAL PRIMARY KEY,
  store_name      TEXT NOT NULL,
  branch_name     TEXT NOT NULL,
  shopping_mall_id TEXT NOT NULL,
  postal_code     TEXT,
  address         TEXT,
  recipient_phone TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_name, branch_name)
);

CREATE INDEX idx_store_addresses_pair ON store_addresses(store_name, branch_name);
```

확인 SQL:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'store_addresses'
ORDER BY ordinal_position;
```

이 단계는 implementer subagent가 직접 실행할 수 없음. controller가 user에게 SQL 실행을 요청한 뒤 완료 응답을 받고 다음 step 진행.

- [ ] **Step 2: HQ_MENUS에 매장 정보 메뉴 추가**

`src/lib/constants.js`의 `HQ_MENUS` 배열(약 39-55행)에서 `incentive` 항목 앞에 다음 항목을 삽입:

기존:
```jsx
export const HQ_MENUS = [
  { key: 'product_mgmt', icon: '🛍️', label: '상품관리', sub: [
    { key: 'product_add', icon: '➕', label: '상품추가' },
  ]},
  { key: 'stock_mgmt', icon: '📦', label: '재고관리', sub: [
    { key: 'stock_center', icon: '🏭', label: '센터재고' },
    { key: 'stock_store',  icon: '🏬', label: '매장재고' },
    { key: 'purchase_hq',  icon: '📋', label: '발주관리' },
  ]},
  { key: 'incentive',      icon: '💰', label: '급여관리' },
  ...
];
```

변경 후 (재고관리 sub 마지막에 `store_info`는 두지 않음 — 별도 메뉴):

```jsx
export const HQ_MENUS = [
  { key: 'product_mgmt', icon: '🛍️', label: '상품관리', sub: [
    { key: 'product_add', icon: '➕', label: '상품추가' },
  ]},
  { key: 'stock_mgmt', icon: '📦', label: '재고관리', sub: [
    { key: 'stock_center', icon: '🏭', label: '센터재고' },
    { key: 'stock_store',  icon: '🏬', label: '매장재고' },
    { key: 'purchase_hq',  icon: '📋', label: '발주관리' },
  ]},
  { key: 'store_info',     icon: '📍', label: '매장 정보' },
  { key: 'incentive',      icon: '💰', label: '급여관리' },
  ...
];
```

- [ ] **Step 3: PAGE_TITLES에 store_info 추가**

`src/App.js`의 `PAGE_TITLES` 객체(약 418-451행)에 다음 항목을 추가 (위치는 `member_mgmt` 다음 줄 정도가 자연스러움):

```jsx
store_info:     '매장 정보',
```

- [ ] **Step 4: 빈 StoreInfoPage 컴포넌트 생성**

`src/pages/store/StoreInfoPage.jsx` 파일을 생성. 디렉토리(`src/pages/store/`)도 함께 생성됨.

```jsx
import React from 'react';

export default function StoreInfoPage() {
  return (
    <div className="card">
      <div className="card-label">매장 정보</div>
      <div className="empty">
        매장 마스터 데이터 페이지<br/>
        <span style={{fontSize:11, color:'var(--text3)'}}>(다음 Task에서 목록 표시 추가 예정)</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: App.js에 import + 라우팅 추가**

`src/App.js`의 import 영역(약 4-38행)에 다음 라인 추가 (`import ProductMgmtPage` 다음 줄 정도):

```jsx
import StoreInfoPage from './pages/store/StoreInfoPage';
```

`content-body` 영역의 라우팅 분기(약 478-512행) 안에 추가. `member_mgmt` 줄 이후가 자연스러움:

```jsx
{page === 'store_info'     && canSeeMain && <StoreInfoPage/>}
```

- [ ] **Step 6: 빌드 확인**

PowerShell:
```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 7: 수동 검증 (브라우저 — controller 수행)**

1. dev server 실행 (`npm start`).
2. 본사 계정 로그인.
3. 사이드바에 `📍 매장 정보` 메뉴가 보이는지 확인 (재고관리 아래, 급여관리 위).
4. 클릭 시 페이지 헤더 "매장 정보" 표시되고 본문에 "매장 마스터 데이터 페이지 / (다음 Task에서 목록 표시 추가 예정)" 표시 확인.
5. 매니저 계정으로는 보이지 않는지 확인 (canSeeMain 조건).

- [ ] **Step 8: Commit**

```
git add src/lib/constants.js src/App.js src/pages/store/StoreInfoPage.jsx
git commit -m "feat(store-info): 매장 정보 메뉴 + 빈 페이지 스캐폴드 + DB 스키마"
```

---

## Task 2: 매장 목록 표시 + 상태 (✅/⚠️) + 필터

**Files:**
- Modify: `src/pages/store/StoreInfoPage.jsx`

기존 `STORE_MAP`을 source of truth로 매장 목록을 도출하고, store_addresses와 좌측 조인해 상태를 표시한다. 편집은 다음 Task.

- [ ] **Step 1: STORE_MAP에서 (store_name, branch) 모든 페어 도출**

`StoreInfoPage.jsx`에서 import + state 셋업:

```jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { STORE_MAP, STORE_NAMES } from '../../lib/constants';
import { toast } from '../../lib/utils';

export default function StoreInfoPage() {
  const [addresses, setAddresses] = useState([]);   // store_addresses rows
  const [loading,   setLoading]   = useState(true);
  const [fStore,    setFStore]    = useState('');
  const [fKeyword,  setFKeyword]  = useState('');
```

- [ ] **Step 2: store_addresses fetch 함수**

```jsx
  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('store_addresses').select('*');
    if (error) toast(error.message, 'err');
    else setAddresses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);
```

- [ ] **Step 3: 매장 목록 도출 (STORE_MAP × addresses)**

```jsx
  const allRows = useMemo(() => {
    const addrMap = new Map();
    for (const a of addresses) {
      addrMap.set(`${a.store_name}|${a.branch_name}`, a);
    }
    const rows = [];
    for (const store_name of STORE_NAMES) {
      for (const branch_name of STORE_MAP[store_name]) {
        const key = `${store_name}|${branch_name}`;
        const addr = addrMap.get(key) || null;
        const complete = !!(addr && addr.shopping_mall_id && addr.postal_code && addr.address && addr.recipient_phone);
        rows.push({
          key, store_name, branch_name,
          shopping_mall_id: addr?.shopping_mall_id || '',
          postal_code: addr?.postal_code || '',
          address: addr?.address || '',
          recipient_phone: addr?.recipient_phone || '',
          complete, addr,
        });
      }
    }
    return rows;
  }, [addresses]);

  const filtered = useMemo(() => {
    let r = allRows;
    if (fStore) r = r.filter(x => x.store_name === fStore);
    if (fKeyword.trim()) {
      const kw = fKeyword.toLowerCase();
      r = r.filter(x =>
        x.branch_name.toLowerCase().includes(kw) ||
        x.shopping_mall_id.toLowerCase().includes(kw)
      );
    }
    return r;
  }, [allRows, fStore, fKeyword]);

  const completeCount = useMemo(() => allRows.filter(r => r.complete).length, [allRows]);
```

- [ ] **Step 4: render 작성**

함수의 `return` 부분을 다음으로 교체 (Task 1의 placeholder return을 대체):

```jsx
  return (
    <div className="card">
      <div className="card-label">매장 정보</div>
      <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
        <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
          <option value="">전체 백화점</option>
          {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="finput" value={fKeyword} onChange={e => setFKeyword(e.target.value)}
          placeholder="🔍 점포명·쇼핑몰ID 검색" style={{minWidth:240}}/>
        {(fStore || fKeyword) &&
          <button className="btn-ghost" onClick={() => { setFStore(''); setFKeyword(''); }}>✕ 초기화</button>}
        <div className="fbar-right">
          <span className="fresult">
            <b>{filtered.length.toLocaleString()}</b>개 매장 ·
            <b style={{marginLeft:6, color:'var(--success)'}}>{completeCount}</b> 등록 ·
            <b style={{marginLeft:6, color:'var(--danger)'}}>{allRows.length - completeCount}</b> 미설정
          </span>
        </div>
      </div>
      {loading ? <div className="empty"><span className="spinner"/></div> : (
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th>백화점</th>
                <th>점포</th>
                <th>쇼핑몰ID</th>
                <th>우편번호</th>
                <th>주소</th>
                <th>수취인 전화</th>
                <th style={{textAlign:'center', width:60}}>상태</th>
                <th style={{textAlign:'center', width:80}}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8} className="empty">조회된 매장이 없습니다</td></tr>
                : filtered.map(r => (
                  <tr key={r.key}>
                    <td><span className="badge badge-dept">{r.store_name}</span></td>
                    <td><span className="badge badge-store">{r.branch_name}</span></td>
                    <td className="mono">{r.shopping_mall_id || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td className="mono">{r.postal_code || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td style={{fontSize:12}}>{r.address || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td className="mono">{r.recipient_phone || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td style={{textAlign:'center', fontSize:14}}>{r.complete ? '✅' : '⚠️'}</td>
                    <td style={{textAlign:'center'}}>
                      <button className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}}
                        onClick={() => { /* Task 3에서 모달 연결 */ }}>편집</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공. unused warning 가능 (`fetchAddresses` 등은 사용 중이지만 편집 모달 미구현이므로 일부 import unused일 수 있음 — 실제로는 모두 사용됨).

- [ ] **Step 6: 수동 검증 (controller 수행)**

1. 본사 계정 → 매장 정보 진입.
2. 표에 STORE_MAP의 모든 매장(약 50개+) 표시되는지 확인.
3. 모든 행이 ⚠️(미설정) 상태인지 확인 (DB 비어 있음).
4. 백화점 select로 필터 → 해당 백화점 매장만 보임.
5. 키워드 검색 (점포명 일부) → 매칭 행만 보임.
6. 합계 영역에 `N개 매장 · 0 등록 · N 미설정` 표시 확인.

- [ ] **Step 7: Commit**

```
git add src/pages/store/StoreInfoPage.jsx
git commit -m "feat(store-info): 매장 목록 + 필터 + 상태 표시"
```

---

## Task 3: 편집 모달 (upsert)

**Files:**
- Modify: `src/pages/store/StoreInfoPage.jsx`

`[편집]` 버튼 클릭 시 모달이 열리고, 4개 필드를 입력해 저장하면 store_addresses에 upsert.

- [ ] **Step 1: 편집 state 추가**

기존 state 선언부에 다음 추가:

```jsx
  const [editing,    setEditing]    = useState(null);  // {key, store_name, branch_name, ...} | null
  const [eForm,      setEForm]      = useState({ shopping_mall_id:'', postal_code:'', address:'', recipient_phone:'' });
  const [saving,     setSaving]     = useState(false);
```

- [ ] **Step 2: 편집 시작/취소 핸들러**

`fetchAddresses` 정의 다음에 추가:

```jsx
  const openEdit = (row) => {
    setEditing(row);
    setEForm({
      shopping_mall_id: row.shopping_mall_id || '',
      postal_code:      row.postal_code || '',
      address:          row.address || '',
      recipient_phone:  row.recipient_phone || '',
    });
  };
  const closeEdit = () => { setEditing(null); setSaving(false); };

  const saveEdit = async () => {
    if (!editing) return;
    if (!eForm.shopping_mall_id.trim()) { toast('쇼핑몰ID는 필수입니다', 'err'); return; }
    setSaving(true);
    const payload = {
      store_name:  editing.store_name,
      branch_name: editing.branch_name,
      shopping_mall_id: eForm.shopping_mall_id.trim(),
      postal_code:      eForm.postal_code.trim() || null,
      address:          eForm.address.trim() || null,
      recipient_phone:  eForm.recipient_phone.trim() || null,
      updated_at:       new Date().toISOString(),
    };
    const { error } = await supabase.from('store_addresses')
      .upsert(payload, { onConflict: 'store_name,branch_name' });
    setSaving(false);
    if (error) { toast(error.message, 'err'); return; }
    toast('저장 완료', 'ok');
    closeEdit();
    fetchAddresses();
  };
```

- [ ] **Step 3: 행 [편집] 버튼 onClick 연결**

Task 2에서 placeholder로 둔 `onClick={() => { /* Task 3에서 모달 연결 */ }}` 부분을 다음으로 변경:

```jsx
onClick={() => openEdit(r)}
```

- [ ] **Step 4: ESC 키로 모달 닫기**

useEffect 영역에 추가 (`fetchAddresses` useEffect 다음):

```jsx
  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => { if (e.key === 'Escape') closeEdit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);
```

- [ ] **Step 5: 모달 JSX 추가**

`return (...)` 의 최상위 `<div className="card">` 직전에 모달을 두고, 두 요소를 React.Fragment로 감싼다.

기존:
```jsx
  return (
    <div className="card">
      ...
    </div>
  );
```

다음으로:
```jsx
  return (
    <>
      <div className="card">
        ...
      </div>
      {editing && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={closeEdit}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:16, width:'min(560px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{padding:'20px 24px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:17, fontWeight:700}}>매장 정보 편집</div>
                <div style={{fontSize:12, color:'var(--text2)', marginTop:4}}>
                  <span className="badge badge-dept" style={{marginRight:6}}>{editing.store_name}</span>
                  <span className="badge badge-store">{editing.branch_name}</span>
                </div>
              </div>
              <button onClick={closeEdit}
                style={{height:30, padding:'0 12px', border:'1px solid var(--border)', borderRadius:6, background:'#fff', fontSize:12, cursor:'pointer'}}>✕ 닫기</button>
            </div>
            <div style={{padding:'18px 24px'}}>
              <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:10, alignItems:'center', marginBottom:10}}>
                <label style={{fontSize:12, fontWeight:600}}>쇼핑몰ID *</label>
                <input value={eForm.shopping_mall_id} onChange={e => setEForm(p => ({...p, shopping_mall_id:e.target.value}))}
                  placeholder="예: 롯관악점팔레오"
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontFamily:'var(--mono)'}}/>
                <label style={{fontSize:12, fontWeight:600}}>우편번호</label>
                <input value={eForm.postal_code} onChange={e => setEForm(p => ({...p, postal_code:e.target.value}))}
                  placeholder="예: 06141"
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontFamily:'var(--mono)'}}/>
                <label style={{fontSize:12, fontWeight:600}}>주소</label>
                <input value={eForm.address} onChange={e => setEForm(p => ({...p, address:e.target.value}))}
                  placeholder="예: 서울 관악구 ..."
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13}}/>
                <label style={{fontSize:12, fontWeight:600}}>수취인 전화</label>
                <input value={eForm.recipient_phone} onChange={e => setEForm(p => ({...p, recipient_phone:e.target.value}))}
                  placeholder="010-0000-0000"
                  style={{height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, fontFamily:'var(--mono)'}}/>
              </div>
            </div>
            <div style={{padding:'14px 24px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button className="btn btn-s" onClick={closeEdit} disabled={saving}>취소</button>
              <button className="btn btn-p" onClick={saveEdit} disabled={saving}>
                {saving ? <span className="spinner"/> : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
```

- [ ] **Step 6: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 7: 수동 검증 (controller 수행)**

1. 매장 정보 페이지 → 한 행의 `[편집]` 클릭 → 모달 오픈.
2. 모달 헤더에 백화점·점포 배지가 정확히 표시되는지 확인.
3. 4개 필드 입력 → 저장 → 토스트 "저장 완료" → 모달 닫힘 → 표가 새로고침되며 해당 행 ✅ 상태로 변경.
4. 다시 편집 → 기존 값 자동 채워져 있는지 확인.
5. 쇼핑몰ID 비우고 저장 → 토스트 "쇼핑몰ID는 필수입니다" 에러.
6. 모달 외부 클릭, ESC, ✕ 닫기 — 세 가지 모두 모달 닫히는지 확인.
7. 합계 영역의 `등록 / 미설정` 카운트가 갱신되는지 확인.

- [ ] **Step 8: Commit**

```
git add src/pages/store/StoreInfoPage.jsx
git commit -m "feat(store-info): 매장 정보 편집 모달 + upsert"
```

---

## Task 4: 엑셀 일괄 import

**Files:**
- Modify: `src/pages/store/StoreInfoPage.jsx`

사용자가 `.xlsx` 파일을 업로드하면 헤더 검증 후 행마다 upsert.

- [ ] **Step 1: xlsx import + state 추가**

파일 상단 import에 추가:

```jsx
import * as XLSX from 'xlsx';
```

state 영역에 추가:

```jsx
  const [importing, setImporting] = useState(false);
```

- [ ] **Step 2: import 핸들러**

`saveEdit` 정의 다음에 추가:

```jsx
  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const REQUIRED_COLS = ['백화점', '점포', '쇼핑몰ID'];
      if (rows.length === 0) { toast('엑셀에 데이터 행이 없습니다', 'err'); setImporting(false); return; }
      const sample = rows[0];
      for (const c of REQUIRED_COLS) {
        if (!(c in sample)) { toast(`필수 헤더 누락: ${c}`, 'err'); setImporting(false); return; }
      }
      let inserted = 0, errors = 0;
      for (const row of rows) {
        const sn = String(row['백화점'] || '').trim();
        const bn = String(row['점포'] || '').trim();
        const sid = String(row['쇼핑몰ID'] || '').trim();
        if (!sn || !bn || !sid) { errors++; continue; }
        const payload = {
          store_name:       sn,
          branch_name:      bn,
          shopping_mall_id: sid,
          postal_code:      String(row['우편번호'] || '').trim() || null,
          address:          String(row['주소'] || '').trim() || null,
          recipient_phone:  String(row['수취인전화'] || row['수취인 전화'] || '').trim() || null,
          updated_at:       new Date().toISOString(),
        };
        const { error } = await supabase.from('store_addresses')
          .upsert(payload, { onConflict: 'store_name,branch_name' });
        if (error) errors++; else inserted++;
      }
      toast(`완료: ${inserted}건 처리 / ${errors}건 오류`, errors > 0 ? 'err' : 'ok');
      fetchAddresses();
    } catch (err) {
      toast('파일 처리 실패: ' + err.message, 'err');
    }
    setImporting(false);
  };
```

- [ ] **Step 3: 필터바에 import 버튼 추가**

기존 fbar의 `fbar-right` 영역(합계 표시 옆)에 import 버튼 추가. 기존:

```jsx
        <div className="fbar-right">
          <span className="fresult">...</span>
        </div>
```

다음으로 변경:

```jsx
        <div className="fbar-right">
          <span className="fresult">...</span>
          <label className="btn btn-s" style={{cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1}}>
            {importing ? <span className="spinner"/> : '📥'} 엑셀 일괄 import
            <input type="file" accept=".xlsx,.xls"
              onChange={e => { if (e.target.files?.[0]) { handleImport(e.target.files[0]); e.target.value=''; } }}
              disabled={importing}
              style={{display:'none'}}/>
          </label>
        </div>
```

- [ ] **Step 4: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 5: 수동 검증 (controller 수행)**

1. 매장 정보 페이지 → `📥 엑셀 일괄 import` 클릭 → 파일 선택 다이얼로그.
2. 양식 예: 첫 행 헤더 `백화점 / 점포 / 쇼핑몰ID / 우편번호 / 주소 / 수취인전화` 데이터 행 5개 정도 들어간 .xlsx 업로드.
3. 토스트: "완료: 5건 처리 / 0건 오류".
4. 표가 자동 새로고침되며 해당 5개 매장의 상태가 ✅로 변경.
5. 같은 파일 재업로드 → upsert로 동일 5건 업데이트(중복 추가 없음).
6. 헤더가 누락된 파일 업로드 → 에러 토스트 (예: "필수 헤더 누락: 쇼핑몰ID").
7. 빈 파일 업로드 → "엑셀에 데이터 행이 없습니다".

- [ ] **Step 6: Commit**

```
git add src/pages/store/StoreInfoPage.jsx
git commit -m "feat(store-info): 엑셀 일괄 import (xlsx 헤더 검증 + upsert)"
```

---

## Self-Review Checklist (작업자 본인 확인)

플랜 작성 후 자체 검토.

**1. Spec coverage:**
- 3.1 신규 테이블 → Task 1 Step 1.
- 4.1 라우팅 / 메뉴 (사이드바 + App.js) → Task 1 Step 2·3·5.
- 4.2 화면 구성(필터바 + 표) → Task 2.
- 4.2 상태 ✅/⚠️ → Task 2 Step 3 (`complete` 계산).
- 4.2 편집 모달 → Task 3.
- 4.3 일괄 import → Task 4.
- 5 발주진행 탭 → 본 plan(Phase 1)에서 비목표, Phase 2로 분리.

**2. Placeholder scan:**
- 모든 step에 실제 코드/SQL/명령 포함.
- "TBD"/"적절히" 등 없음.
- Task 2에서 [편집] 버튼 onClick은 일시적으로 빈 placeholder(`/* Task 3에서 모달 연결 */`) → Task 3에서 명시적 교체. 의도된 유보.

**3. Type consistency:**
- `addresses` state shape: store_addresses row 그대로.
- `allRows` 항목 shape: `{key, store_name, branch_name, shopping_mall_id, postal_code, address, recipient_phone, complete, addr}` — Task 2 정의, Task 3 openEdit 인자로 사용.
- `eForm` shape: `{shopping_mall_id, postal_code, address, recipient_phone}` — Task 3 정의·사용 일관.
- upsert payload key: `store_name, branch_name, shopping_mall_id, ...` — DB 컬럼명과 정확히 일치.
- `onConflict: 'store_name,branch_name'` — Task 1의 UNIQUE 제약과 매칭.
- import 핸들러의 헤더명 `백화점/점포/쇼핑몰ID/우편번호/주소/수취인전화` — Task 4에서 정의되며 spec section 4.3과 일치.
