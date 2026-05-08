# 발주서 엑셀 다운로드 (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본사 발주현황 탭에 매장발주 양식 31컬럼 xlsx 한 번에 다운로드 기능 추가. `status='requested'/'rerequested' AND exported_at IS NULL` 인 발주를 묶어 export 후 `exported_at` 기록.

**Architecture:** `purchase_orders` 테이블에 `exported_at` 컬럼 추가, `src/lib/constants.js`에 `ORDER_CONSTANTS` 추가, `PurchaseOrderHQPage.jsx`에 export 헬퍼 + 다운로드 버튼 + 출하됨 배지 추가. ExcelJS 동적 import (기존 패턴). store_addresses는 별도 fetch 후 클라이언트 join.

**Tech Stack:** React 18, Supabase JS, exceljs(동적 import), 인라인 스타일.

**Spec:** `docs/superpowers/specs/2026-05-08-purchase-order-excel-export-design.md`

**Test 전략:** 본 프로젝트에는 컴포넌트 테스트 인프라가 없으므로 각 작업은 `npm run build` + dev server 수동 검증으로 마무리한다.

---

## File Structure

- DB: `purchase_orders.exported_at` 컬럼 추가 (Supabase SQL Editor)
- Modify: `src/lib/constants.js` — `ORDER_CONSTANTS` 추가
- Modify: `src/pages/order/PurchaseOrderHQPage.jsx` — export 헬퍼 + 버튼 + 배지

새 파일 없음.

---

## Task 1: DB 스키마 + ORDER_CONSTANTS + 발주현황 fetch에 exported_at·erp_code 포함

**Files:**
- DB: `purchase_orders` (Supabase 콘솔 SQL)
- Modify: `src/lib/constants.js`
- Modify: `src/pages/order/PurchaseOrderHQPage.jsx`

이 단계에서는 양식 데이터의 토대(스키마 + 상수 + 쿼리)를 갖춘다. UI 다운로드 동작은 다음 Task에서.

- [ ] **Step 1: Supabase에 SQL 실행 (controller 확인 필요)**

다음 SQL을 Supabase 콘솔(SQL Editor)에서 실행:

```sql
ALTER TABLE purchase_orders ADD COLUMN exported_at TIMESTAMPTZ;
CREATE INDEX idx_purchase_orders_exported ON purchase_orders(exported_at) WHERE exported_at IS NULL;
```

확인 SQL:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'purchase_orders' AND column_name = 'exported_at';
```

이 단계는 implementer subagent가 직접 실행할 수 없음. controller가 user에게 SQL 실행을 요청한 뒤 완료 응답을 받고 다음 step 진행.

- [ ] **Step 2: ORDER_CONSTANTS를 constants.js에 추가**

`src/lib/constants.js` 파일 끝에 다음을 추가 (파일 마지막 줄 다음):

```jsx
// ════════════════════════════════════════════════════════
// 발주서 양식 상수
// ════════════════════════════════════════════════════════
export const ORDER_CONSTANTS = {
  TRACKING_LABEL: '유통2팀',
  CHANNEL: '기타_유통2팀_매장발주',
  ORDERER_NAME: '한국생활건강(팔레오본사)',
  ORDERER_PHONE: '070-5117-5677',
};
```

- [ ] **Step 3: PurchaseOrderHQPage의 fetchOrders select 보강**

`src/pages/order/PurchaseOrderHQPage.jsx`의 `fetchOrders` 함수(현재 약 194-203행)에서 select 절을 변경하여 `exported_at`과 `products.erp_code`를 포함시킨다.

기존:
```jsx
const { data, error } = await supabase.from('purchase_orders')
  .select('*, items:purchase_order_items(*, product:products(name, code))')
  .order('created_at', { ascending: false })
  .limit(100);
```

다음으로 변경:
```jsx
const { data, error } = await supabase.from('purchase_orders')
  .select('*, items:purchase_order_items(*, product:products(name, code, erp_code))')
  .order('created_at', { ascending: false })
  .limit(100);
```

(`*`로 전체 가져오므로 `exported_at` 자동 포함됨. 명시적으로 select 컬럼 리스트 안 쓰기 때문에 추가 작업 없음.)

- [ ] **Step 4: 빌드 확인**

PowerShell:
```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공.

- [ ] **Step 5: Commit**

```
git add src/lib/constants.js src/pages/order/PurchaseOrderHQPage.jsx
git commit -m "feat(order): exported_at 컬럼 + ORDER_CONSTANTS + erp_code fetch"
```

---

## Task 2: Excel export 헬퍼 함수

**Files:**
- Modify: `src/pages/order/PurchaseOrderHQPage.jsx`

다운로드 가능한 발주(`requested`/`rerequested` + `exported_at IS NULL`)를 가져와 매장발주 양식 xlsx로 빌드하는 모듈 스코프 함수를 추가. 호출(버튼)은 다음 Task.

- [ ] **Step 1: import에 dlBlob, ORDER_CONSTANTS 추가**

기존 import 문(현재 약 1-3행):

```jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
```

3행을 다음으로 변경:

```jsx
import { toast, dlBlob } from '../../lib/utils';
```

같은 영역에 4행으로 추가:

```jsx
import { ORDER_CONSTANTS } from '../../lib/constants';
```

- [ ] **Step 2: 모듈 스코프 export 헬퍼 함수 추가**

`STATUS_LABEL` 정의 다음(약 11행 이후)에 다음 함수를 추가:

```jsx
async function exportPurchaseOrders() {
  // 1) 다운로드 대상 발주 fetch
  const { data: orders, error: oErr } = await supabase.from('purchase_orders')
    .select('id, store_name, branch_name, items:purchase_order_items(id, product_id, hq_qty, store_qty, product:products(name, erp_code, code))')
    .in('status', ['requested', 'rerequested'])
    .is('exported_at', null)
    .order('store_name', { ascending: true })
    .order('branch_name', { ascending: true });
  if (oErr) throw oErr;
  if (!orders || orders.length === 0) {
    return { count: 0, missingMaster: [] };
  }

  // 2) store_addresses fetch
  const { data: addrs, error: aErr } = await supabase.from('store_addresses').select('*');
  if (aErr) throw aErr;
  const addrMap = new Map();
  for (const a of (addrs || [])) {
    addrMap.set(`${a.store_name}|${a.branch_name}`, a);
  }

  // 3) 마스터 정보 미설정 매장 식별
  const missingMaster = [];
  for (const o of orders) {
    const key = `${o.store_name}|${o.branch_name}`;
    const a = addrMap.get(key);
    const ok = !!(a && a.shopping_mall_id && a.postal_code && a.address && a.recipient_phone);
    if (!ok) missingMaster.push(`${o.store_name} / ${o.branch_name}`);
  }

  // 4) 라인 펼치기 (매장 정렬 후 각 발주의 items도 product name 정렬)
  const lines = [];
  for (const o of orders) {
    const items = [...(o.items || [])].sort((a, b) =>
      (a.product?.name || '').localeCompare(b.product?.name || ''));
    for (const it of items) {
      lines.push({ order: o, item: it });
    }
  }

  // 5) 발송일 + 주문번호 생성
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyymmdd = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const yyyy_mm_dd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // 6) ExcelJS 워크북 생성
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('매장발주');
  const HEADERS = ['발송일','송장번호','주문번호','채널','매장명','수취인명','결제금액','주문수량','상품명','옵션','품명','수취인명','우편번호','주소','수취인 천화번호1','수취인 전화번호2','배송메세지','상품번호','주문자명','주문자 연락처1','주문자 연락처2','수수료','수수료액','공란','사방넷 주문번호','주문일','주문자 ID','물류바코드(88코드)','송장전송일','ERP코드','수량'];
  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // 7) 라인 별 행 추가
  lines.forEach((ln, idx) => {
    const o = ln.order;
    const it = ln.item;
    const a = addrMap.get(`${o.store_name}|${o.branch_name}`) || {};
    const qty = (it.store_qty != null) ? Number(it.store_qty) : Number(it.hq_qty || 0);
    const orderNo = `${yyyymmdd}-${String(idx + 1).padStart(4, '0')}`;
    const erp = it.product?.erp_code || '';
    const productName = it.product?.name || '';
    const mallId = a.shopping_mall_id || '';
    ws.addRow([
      today,                              // A 발송일
      ORDER_CONSTANTS.TRACKING_LABEL,     // B 송장번호
      orderNo,                            // C 주문번호
      ORDER_CONSTANTS.CHANNEL,            // D 채널
      mallId,                             // E 매장명
      mallId,                             // F 수취인명
      0,                                  // G 결제금액
      1,                                  // H 주문수량
      '',                                 // I 상품명
      '',                                 // J 옵션
      productName,                        // K 품명
      mallId,                             // L 수취인명
      a.postal_code || '',                // M 우편번호
      a.address || '',                    // N 주소
      a.recipient_phone || '',            // O 수취인 천화번호1
      '',                                 // P 수취인 전화번호2
      '',                                 // Q 배송메세지
      '',                                 // R 상품번호
      ORDER_CONSTANTS.ORDERER_NAME,       // S 주문자명
      ORDER_CONSTANTS.ORDERER_PHONE,      // T 주문자 연락처1
      ORDER_CONSTANTS.ORDERER_PHONE,      // U 주문자 연락처2
      '', '', '', '', '', '', '', '',     // V~AC
      erp,                                // AD ERP코드
      qty,                                // AE 수량
    ]);
  });

  // 8) 발송일 셀 서식
  ws.getColumn(1).numFmt = 'yyyy-mm-dd';

  // 9) 저장 + 다운로드
  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `매장발주_${yyyy_mm_dd}.xlsx`);

  // 10) 다운로드된 발주들의 exported_at 일괄 update
  const orderIds = orders.map(o => o.id);
  const { error: uErr } = await supabase.from('purchase_orders')
    .update({ exported_at: new Date().toISOString() })
    .in('id', orderIds);
  if (uErr) throw uErr;

  return { count: orderIds.length, missingMaster };
}
```

- [ ] **Step 3: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공. unused warning 가능 (`exportPurchaseOrders` 아직 호출 안 됨 — Task 3에서 호출 추가).

- [ ] **Step 4: Commit**

```
git add src/pages/order/PurchaseOrderHQPage.jsx
git commit -m "feat(order): 매장발주 xlsx export 헬퍼 함수 추가"
```

---

## Task 3: 다운로드 버튼 + handler + 출하됨 배지

**Files:**
- Modify: `src/pages/order/PurchaseOrderHQPage.jsx`

발주현황 탭 상단에 다운로드 버튼 추가, handler에서 마스터 미설정 confirm 처리, 발주현황 표 status 옆에 출하됨 배지 추가.

- [ ] **Step 1: exporting state 추가**

기존 컴포넌트 내부 state 선언부에 다음 추가 (`statusLoading` 다음 줄 부근):

```jsx
  const [exporting, setExporting] = useState(false);
```

- [ ] **Step 2: handleExport 핸들러 추가**

`fetchOrders` 정의 다음(현재 약 205행 부근)에 다음을 추가:

```jsx
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // 미리 조회해서 미설정 매장 확인
      const { data: previewOrders, error: pErr } = await supabase.from('purchase_orders')
        .select('store_name, branch_name')
        .in('status', ['requested', 'rerequested'])
        .is('exported_at', null);
      if (pErr) throw pErr;
      if (!previewOrders || previewOrders.length === 0) {
        toast('다운로드 대상 발주가 없습니다', 'inf');
        setExporting(false);
        return;
      }

      const { data: addrs } = await supabase.from('store_addresses').select('*');
      const addrMap = new Map();
      for (const a of (addrs || [])) addrMap.set(`${a.store_name}|${a.branch_name}`, a);
      const missing = [];
      const seen = new Set();
      for (const o of previewOrders) {
        const k = `${o.store_name}|${o.branch_name}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const a = addrMap.get(k);
        const ok = !!(a && a.shopping_mall_id && a.postal_code && a.address && a.recipient_phone);
        if (!ok) missing.push(`${o.store_name} / ${o.branch_name}`);
      }
      if (missing.length > 0) {
        const sample = missing.slice(0, 5).join('\n  ');
        const more = missing.length > 5 ? `\n  ... 외 ${missing.length - 5}개` : '';
        const ok = window.confirm(
          `⚠️ ${missing.length}개 매장 마스터 정보 미설정\n  ${sample}${more}\n\n빈 셀로 다운로드하시겠습니까?`
        );
        if (!ok) {
          toast('매장 정보 → 매장주소정보 메뉴에서 보충 후 재시도해주세요', 'inf');
          setExporting(false);
          return;
        }
      }

      const { count } = await exportPurchaseOrders();
      toast(`매장발주 ${count}건 다운로드 완료`, 'ok');
      fetchOrders();
    } catch (err) {
      toast('다운로드 실패: ' + (err.message || err), 'err');
    } finally {
      setExporting(false);
    }
  };
```

- [ ] **Step 3: 발주현황 상단에 다운로드 버튼 추가**

발주현황 탭 영역의 상단 헤더(현재 약 387-393행 부근)에 다운로드 버튼 추가.

기존:
```jsx
      {tab === 'status' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
            <div className="card-label" style={{margin:0}}>📊 발주 현황</div>
            <button className="btn btn-s" onClick={fetchOrders} disabled={statusLoading}>
              {statusLoading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>
```

다음으로 변경 (새로고침 버튼 옆에 다운로드 버튼 추가):

```jsx
      {tab === 'status' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
            <div className="card-label" style={{margin:0}}>📊 발주 현황</div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-p" onClick={handleExport} disabled={exporting}
                title="매장 발주요청 + 미출하 발주를 한 번에 묶어 매장발주 양식 xlsx 다운로드">
                {exporting ? <span className="spinner"/> : '📥'} 매장발주 엑셀 다운로드
              </button>
              <button className="btn btn-s" onClick={fetchOrders} disabled={statusLoading}>
                {statusLoading ? <span className="spinner"/> : '🔄 새로고침'}
              </button>
            </div>
          </div>
```

- [ ] **Step 4: 출하됨 배지 추가**

발주현황 표의 상태 컬럼 셀(현재 약 424-427행 부근)을 변경.

기존:
```jsx
                        <td style={{textAlign:'center'}}>
                          <span style={{display:'inline-block', padding:'2px 10px', borderRadius:4, fontSize:11, fontWeight:700,
                            background:st.bg, color:st.color, border:`1px solid ${st.border}`}}>{st.label}</span>
                        </td>
```

다음으로 변경 (status 배지 옆에 출하됨 배지 conditional):

```jsx
                        <td style={{textAlign:'center'}}>
                          <span style={{display:'inline-block', padding:'2px 10px', borderRadius:4, fontSize:11, fontWeight:700,
                            background:st.bg, color:st.color, border:`1px solid ${st.border}`}}>{st.label}</span>
                          {o.exported_at && (
                            <span style={{display:'inline-block', marginLeft:6, padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700,
                              background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7'}}
                              title={`출하됨: ${new Date(o.exported_at).toLocaleString('ko-KR')}`}>
                              ✓ 출하됨
                            </span>
                          )}
                        </td>
```

- [ ] **Step 5: 빌드 확인**

```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공. `exportPurchaseOrders` unused warning이 사라져야 함.

- [ ] **Step 6: 수동 검증 (controller가 dev server에서 수행)**

검증 절차:
1. Supabase에 SQL 실행됐고 컬럼 추가 확인.
2. 본사 계정으로 로그인 → 재고관리 → 발주진행 → 지난주 데이터로 발주 진행 → 매장에서 발주요청 (다른 계정으로 접속해서 처리하거나 SQL로 status update).
3. 본사 → 발주현황 진입.
4. `📥 매장발주 엑셀 다운로드` 버튼 클릭.
5. 마스터 미설정 매장이 있으면 confirm 표시 → 확인.
6. xlsx 파일 다운로드(`매장발주_yyyy-mm-dd.xlsx`).
7. 토스트: "매장발주 N건 다운로드 완료".
8. 발주현황 표가 자동 새로고침되며, 다운로드된 발주들에 ✓ 출하됨 배지 표시.
9. 다시 다운로드 버튼 클릭 → "다운로드 대상 발주가 없습니다" 토스트 (이미 exported됨).
10. 다운로드된 xlsx 열어서 31컬럼 + 데이터 확인.

- [ ] **Step 7: Commit**

```
git add src/pages/order/PurchaseOrderHQPage.jsx
git commit -m "feat(order): 발주현황에 매장발주 엑셀 다운로드 버튼 + 출하됨 배지"
```

---

## Self-Review Checklist (작업자 본인 확인)

플랜 작성 후 자체 검토.

**1. Spec coverage:**
- 3.1 다운로드 버튼 (발주현황 탭) → Task 3 Step 3.
- 3.2 마스터 미설정 confirm → Task 3 Step 2 (handleExport).
- 3.3 출하됨 배지 → Task 3 Step 4.
- 4 DB 스키마 → Task 1 Step 1.
- 5.1 fetch 쿼리 → Task 2 Step 2.
- 5.2 라인 생성/주문번호 → Task 2 Step 2 (lines + idx 기반).
- 5.3 수량 결정 (store_qty || hq_qty) → Task 2 Step 2.
- 5.4 다운로드 후 exported_at update → Task 2 Step 2 step 10.
- 6.1 컬럼 매핑 → Task 2 Step 2 (addRow 매핑).
- 6.2 ORDER_CONSTANTS → Task 1 Step 2.
- 6.3 ExcelJS 동적 import → Task 2 Step 2.
- 6.4 파일명 → Task 2 Step 2 step 9.

**2. Placeholder scan:** 모든 step에 실제 코드/SQL 포함. "TBD"/"적절히" 등 없음.

**3. Type consistency:**
- `exportPurchaseOrders` 시그니처: 인자 없음, return `{count, missingMaster}` — Task 2 정의, Task 3 호출.
- `ORDER_CONSTANTS` 키: TRACKING_LABEL, CHANNEL, ORDERER_NAME, ORDERER_PHONE — Task 1·2에서 일관 사용.
- `addrMap` 키 형식: `${store_name}|${branch_name}` — Task 2 Step 2의 `lines` 펼침과 ws.addRow에서 동일.
- `exported_at` 컬럼: Task 1에서 추가, Task 2에서 update, Task 3에서 read.
- `is('exported_at', null)` Supabase JS 문법: 정확함 (NULL 체크).
