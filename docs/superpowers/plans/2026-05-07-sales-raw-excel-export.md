# 매장매출 결산 양식 엑셀 다운로드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매장매출 → 판매내역 모드에서 적용된 필터로 sales 데이터를 전체 페이징 fetch 후 외부 결산 양식(매출raw)에 맞춘 xlsx 파일을 생성·다운로드하는 기능을 추가한다.

**Architecture:** `src/pages/sales/SalesListPage.jsx` 단일 파일에 페이징 fetch + ExcelJS 워크북 빌더 함수를 추가하고, 판매내역 모드 필터바에 다운로드 버튼을 노출한다. read-only 동작이라 DB/타 페이지 영향 없음.

**Tech Stack:** React 18, Supabase JS, exceljs(동적 import), 기존 `lib/utils.js` (`dlBlob`, `toast`).

**Spec:** `docs/superpowers/specs/2026-05-07-sales-raw-excel-export-design.md`

**Test 전략:** 본 프로젝트에는 컴포넌트 테스트 인프라가 없으므로 각 작업은 `npm run build` 컴파일 통과 + dev server 수동 검증으로 마무리한다.

---

## File Structure

- Modify: `src/pages/sales/SalesListPage.jsx`
  - 새 비동기 함수 `exportSalesRaw(...)` (컴포넌트 외부 모듈 스코프) — 페이징 fetch + ExcelJS 빌드 + 다운로드.
  - 새 state `exporting` 추가, 다운로드 버튼 JSX 추가.

새 파일 생성 없음.

---

## Task 1: exportSalesRaw 함수 정의 — 페이징 fetch + ExcelJS 빌드

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

이 단계에서 헬퍼 함수만 정의한다. 호출 측(버튼) 연결은 Task 2에서.

- [ ] **Step 1: 현재 SalesListPage.jsx 구조 확인**

`src/pages/sales/SalesListPage.jsx` 파일을 읽어 다음을 확인:
- 파일 최상단의 import 문(현재 `supabase`, `toast`, `uniq` 등이 import됨).
- `export default function SalesListPage(...)` 시그니처와 닫는 위치.

이 단계에선 코드 변경 없음. 함수를 컴포넌트 외부에 추가하기 전 위치 확인용.

- [ ] **Step 2: import에 dlBlob 추가**

기존 import 문 (현재 약 1-3행):

```jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq } from '../../lib/utils';
import SalesTabNav from './SalesTabNav';
```

3행을 다음과 같이 변경:

```jsx
import { toast, uniq, dlBlob } from '../../lib/utils';
```

- [ ] **Step 3: exportSalesRaw 함수 추가 (컴포넌트 외부)**

`export default function SalesListPage(...)` 직전 라인에 다음 함수를 추가:

```jsx
async function exportSalesRaw({ fStore, fBrand, fFrom, fTo, fKeyword }) {
  // 1) 페이징 fetch (Supabase 1000건 limit 회피)
  const PAGE = 1000;
  let all = [], start = 0;
  while (true) {
    let q = supabase.from('sales')
      .select('id, sold_at, store_name, branch_name, payment, quantity, returned_qty, price, brand:brands(name), product:products(code, name, cost)')
      .order('sold_at', { ascending: true })
      .order('id',      { ascending: true });
    if (fStore) q = q.eq('store_name', fStore);
    if (fBrand) q = q.eq('brand_id', fBrand);
    if (fFrom)  q = q.gte('sold_at', fFrom);
    if (fTo)    q = q.lte('sold_at', fTo);
    const { data, error } = await q.range(start, start + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    start += PAGE;
  }

  // 2) 클라이언트 필터: 완전반품 제외 + 키워드 매칭
  const kw = (fKeyword || '').trim().toLowerCase();
  const rows = all.filter(s => {
    const eff = Math.max(0, (s.quantity || 0) - (s.returned_qty || 0));
    if (eff === 0) return false; // 완전반품 제외
    if (!kw) return true;
    return ((s.product?.name || '').toLowerCase().includes(kw)
         || (s.brand?.name   || '').toLowerCase().includes(kw));
  });

  // 3) payment 매핑
  const mapType = (p) => {
    if (p === '증정') return '증정';
    if (p === '시식') return '샘플';
    return '정상'; // 카드/현금/적립금사용/기타
  };

  // 4) ExcelJS 워크북 생성
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('매출raw');
  ws.columns = [
    { width: 6 },   // A 선택
    { width: 8 },   // B 순번
    { width: 12 },  // C 매출일자
    { width: 16 },  // D 그룹
    { width: 16 },  // E 매장
    { width: 10 },  // F 전표유형
    { width: 18 },  // G 상품코드
    { width: 36 },  // H 상품명
    { width: 10 },  // I 매출수량
    { width: 14 },  // J 최종금액
    { width: 12 },  // K 원가
    { width: 14 },  // L 최종원가
    { width: 12 },  // M 원가율(헤더 없음)
  ];
  const headerRow = ws.addRow(['선택','순번','매출일자','그룹','매장','전표유형','상품코드','상품명','매출수량','최종금액','원가','최종원가','']);
  headerRow.height = 26;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, name: 'Malgun Gothic', size: 10, color: { argb: 'FF1A1A1A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD600' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // 5) 데이터 행
  rows.forEach((s, i) => {
    const effQty = Math.max(0, (s.quantity || 0) - (s.returned_qty || 0));
    const finalAmount = effQty * (Number(s.price) || 0);
    const cost = (s.product && s.product.cost != null) ? Number(s.product.cost) : null;
    const finalCost = cost != null ? cost * effQty : null;
    const ratio = (cost != null && finalAmount > 0) ? (finalCost / finalAmount) : null;
    const dateObj = s.sold_at ? new Date(s.sold_at + 'T00:00:00') : null;

    const row = ws.addRow([
      '0',
      i + 1,
      dateObj,
      s.store_name || '',
      s.branch_name || '',
      mapType(s.payment),
      s.product?.code || '',
      s.product?.name || '',
      effQty,
      finalAmount,
      cost != null ? cost : '',
      finalCost != null ? finalCost : '',
      ratio != null ? ratio : '',
    ]);
    row.height = 18;
    row.eachCell((cell, ci) => {
      cell.font = { name: 'Malgun Gothic', size: 10 };
      // 짝수 행 옅은 배경
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
      // 정렬
      if (ci === 3) cell.alignment = { horizontal: 'center', vertical: 'middle' }; // 매출일자
      else if (ci >= 9 && ci <= 13) cell.alignment = { horizontal: 'right', vertical: 'middle' };
      else cell.alignment = { horizontal: 'left', vertical: 'middle' };
      // 서식
      if (ci === 3 && dateObj) cell.numFmt = 'yyyy-mm-dd';
      if (ci >= 9 && ci <= 12)  cell.numFmt = '#,##0';
      if (ci === 13 && ratio != null) cell.numFmt = '0.0000';
    });
  });

  // 6) 파일명 + 다운로드
  const fname = `매장매출_${fFrom || '시작없음'}_${fTo || '종료없음'}.xlsx`;
  const finalName = (!fFrom && !fTo) ? '매장매출_전체.xlsx' : fname;
  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, finalName);
  return rows.length;
}
```

- [ ] **Step 4: 빌드 확인**

PowerShell:
```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공. unused warning은 허용 (`exportSalesRaw`가 아직 호출되지 않음 — Task 2에서 호출 추가).

만약 빌드가 실패하면 syntax 오류이므로 즉시 수정.

- [ ] **Step 5: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): 매장매출 raw 양식 엑셀 export 헬퍼 함수 추가"
```

---

## Task 2: 다운로드 버튼 + state 연결

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

판매내역 모드 필터바에 버튼을 추가하고, exportSalesRaw 호출 + 진행상태 토글을 연결한다.

- [ ] **Step 1: exporting state 추가**

기존 컴포넌트 내부 state 선언부 (현재 `viewMode` 등 state 선언이 있는 영역, 약 16-19행 부근)에 다음을 추가. `viewMode` 선언 바로 다음 줄에:

```jsx
const [exporting, setExporting] = useState(false);
```

- [ ] **Step 2: 다운로드 핸들러 추가**

`returnedCount` 정의 다음 라인 부근(약 84행)에 다음 핸들러를 추가:

```jsx
const handleExport = async () => {
  if (exporting) return;
  setExporting(true);
  try {
    const n = await exportSalesRaw({ fStore, fBrand, fFrom, fTo, fKeyword });
    toast(`엑셀 다운로드 완료 (${n.toLocaleString()}건)`, 'ok');
  } catch (err) {
    toast('다운로드 실패: ' + (err.message || err), 'err');
  } finally {
    setExporting(false);
  }
};
```

- [ ] **Step 3: 다운로드 버튼 JSX 추가**

기존 `fbar-right` 영역(현재 약 215-224행)을 찾아 판매내역 모드(`viewMode === 'list'`) 분기 안의 합계 span 옆에 버튼을 추가.

기존:
```jsx
{viewMode === 'list' ? (
  <span className="fresult"><b>{filtered.length.toLocaleString()}</b>건 · <b>{totalQty.toLocaleString()}</b>개 · <b>{totalAmt.toLocaleString()}</b>원</span>
) : (
  ...
)}
```

다음으로 변경 (span 다음에 버튼 추가):
```jsx
{viewMode === 'list' ? (
  <>
    <span className="fresult"><b>{filtered.length.toLocaleString()}</b>건 · <b>{totalQty.toLocaleString()}</b>개 · <b>{totalAmt.toLocaleString()}</b>원</span>
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      title="현재 필터 조건으로 매출raw 양식 엑셀 다운로드"
      style={{
        marginLeft: 10, height: 30, padding: '0 12px',
        border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
        background: exporting ? '#fafafa' : '#fff3e0',
        color: 'var(--accent)', fontSize: 12, fontWeight: 700,
        cursor: exporting ? 'not-allowed' : 'pointer',
        opacity: exporting ? 0.7 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {exporting ? <span className="spinner"/> : '📥'} 엑셀 다운로드
    </button>
  </>
) : (
  ...
)}
```

(상품별 집계 모드 분기는 변경하지 않음. 그대로 유지.)

- [ ] **Step 4: 빌드 확인**

PowerShell:
```
$env:CI=$null; npm run build
```
Expected: 컴파일 성공. `exportSalesRaw` unused warning이 사라져야 함 (Task 1의 함수가 이제 호출됨).

- [ ] **Step 5: 수동 검증 (브라우저)**

`npm start`는 controller가 실행할 것. 검증 절차:

1. 본사 계정(`ssakwon@kbh.kr` 등)으로 로그인.
2. 사이드바 → 매출조회 → 매장 매출 진입.
3. 판매내역 모드(기본)에서 필터바 우측 합계 옆에 `📥 엑셀 다운로드` 버튼이 보이는지 확인.
4. 상품별 집계 모드로 토글 → 버튼이 사라지는지 확인.
5. 판매내역 모드로 복귀 → 기간 필터 적용(예: 어제·당월) 후 버튼 클릭 → 다운로드 진행 중 스피너 표시 → `매장매출_<from>_<to>.xlsx` 다운로드.
6. 다운로드 토스트 `엑셀 다운로드 완료 (N건)` 표시 확인.
7. 다운로드된 파일 열어서 확인:
   - 시트명: `매출raw`
   - 헤더 12개 + M열 빈 헤더(`선택 / 순번 / 매출일자 / 그룹 / 매장 / 전표유형 / 상품코드 / 상품명 / 매출수량 / 최종금액 / 원가 / 최종원가`).
   - 헤더 노란 배경 + 굵은 글씨.
   - 매출일자 셀이 Date 형식(`yyyy-mm-dd`)으로 표시.
   - payment 매핑 확인 (예: 행이 카드/현금이면 `정상`, 증정이면 `증정`, 시식이면 `샘플`).
   - 매출수량/최종금액/원가/최종원가 천 단위 콤마 + 우측 정렬.
   - M열 원가율이 0.x 형태(소수)로 표시.
   - 짝수 행 옅은 노랑 배경.
   - 완전반품 행은 결과에 없는지(샘플 데이터로 확인 가능 시).
8. 부분반품 행이 있는 경우 매출수량이 효력수량(`quantity - returned_qty`)으로 표시되는지 확인.
9. products.cost가 비어 있는 상품이 있다면 K/L/M 열이 빈 셀인지 확인.
10. 1,000건 초과 데이터에서도 페이징이 정상 동작하는지 확인 (가능한 데이터 규모로). 토스트의 N건 카운트와 파일 행 수가 일치해야 함.

- [ ] **Step 6: Commit**

```
git add src/pages/sales/SalesListPage.jsx
git commit -m "feat(sales): 판매내역 모드 필터바에 매출raw 엑셀 다운로드 버튼 추가"
```

---

## Self-Review Checklist (작업자 본인 확인)

플랜 작성 후 자체 검토.

**1. Spec coverage:**
- 3.1 다운로드 버튼 위치/조건/스피너 → Task 2 Step 3.
- 3.2 토스트 메시지 → Task 2 Step 2.
- 4.1 페이징 fetch (1,000 단위 루프) → Task 1 Step 3.
- 4.2 클라이언트 필터(완전반품 제외 + 키워드) → Task 1 Step 3.
- 4.3 컬럼 매핑(13컬럼 + 헤더 12개) → Task 1 Step 3.
- 4.3 payment 매핑(카드/현금/적립금사용→정상, 증정→증정, 시식→샘플, 그 외→정상) → Task 1 Step 3 (`mapType`).
- 4.4 효력수량 계산 → Task 1 Step 3.
- 5.1 exceljs 동적 import → Task 1 Step 3.
- 5.2 시트명 `매출raw` + 헤더 노란 배경 + 굵은 글씨 → Task 1 Step 3.
- 5.3 행 스타일(우측 정렬, `#,##0`, 매출일자 yyyy-mm-dd, 짝수 행 옅은 노랑) → Task 1 Step 3.
- 5.4 컬럼 폭 → Task 1 Step 3 (`ws.columns`).
- 5.5 파일명 (시작/종료 미지정 시 fallback, 둘 다 미지정 시 `_전체`) → Task 1 Step 3.
- 6.1 변경 위치 단일 파일 → Task 1·2 모두 SalesListPage.jsx.
- 6.2 timezone 처리 (`sold_at + 'T00:00:00'`) → Task 1 Step 3.
- 6.2 product null/cost null fallback → Task 1 Step 3 (cost == null 분기).
- 6.3 read-only 회귀 영향 없음 → DB 미변경.

**2. Placeholder scan:** 모든 step에 실제 코드/명령/검증 절차 포함. "TBD"/"적절히" 등 없음.

**3. Type consistency:**
- `exportSalesRaw({ fStore, fBrand, fFrom, fTo, fKeyword })`: Task 1 정의, Task 2에서 같은 객체 형태로 호출.
- `effQty`/`finalAmount`/`finalCost`/`ratio`/`dateObj` 명명: Task 1 내에서 일관.
- `mapType(s.payment)`: 5종 + fallback 모두 정의됨.
- `exporting` state: Task 2 step 1·2·3에서 일관 사용.
- ExcelJS API 호환: `addRow`, `eachCell`, `numFmt`, `fill.fgColor.argb` — `SafetyTab.jsx` 패턴과 일치.
