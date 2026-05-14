# 판매 입력 택배 요청 마커 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 판매 입력 시 "택배 요청" 체크박스를 추가하고, 본사·매장 매출 조회에서 택배발송 건수·매출을 별도 집계로 표시한다.

**Architecture:** `sales` 테이블에 `delivery_requested boolean` 단일 컬럼 추가. SalesInputPage에 체크박스 + insert 시 함께 전달. SalesListPage(본사)와 MgrSalesViewPage(매장 매니저)에 요약 카드와 리스트 배지 추가. 반품 처리는 기존 `_eff = quantity - returned_qty` 패턴을 그대로 활용해 자동 정합성 유지.

**Tech Stack:** React 18, Supabase JS. 별도 테스트 프레임워크 없음 — 각 task는 `npm run build` 통과 + UI 검토로 검증.

**Spec:** [docs/superpowers/specs/2026-05-14-sales-delivery-marker-design.md](../specs/2026-05-14-sales-delivery-marker-design.md)

---

## File Structure

| 파일 | 역할 | 변경 종류 |
|---|---|---|
| `src/pages/sales/SalesInputPage.jsx` | 판매 입력 — 택배 요청 체크박스, state, insert 전달 | Modify |
| `src/pages/sales/SalesListPage.jsx` | 본사 매출 조회 — 요약 카드 + 리스트 배지 | Modify |
| `src/pages/sales/MgrSalesViewPage.jsx` | 매장 매니저 매출 조회 — 4번째 카드 + 일자별 상세 배지 | Modify |

---

## Prerequisites (사용자가 Supabase SQL Editor에서 직접 실행)

```sql
ALTER TABLE sales
  ADD COLUMN delivery_requested boolean NOT NULL DEFAULT false;

-- 검증
SELECT
  COUNT(*) AS 전체,
  COUNT(*) FILTER (WHERE delivery_requested) AS 택배요청수
FROM sales;
```

기존 모든 sales 행은 DEFAULT false로 자동 채워짐. UPDATE 별도 불필요.

---

## Task 1: SalesInputPage — 체크박스 + state + insert

**Files:**
- Modify: `src/pages/sales/SalesInputPage.jsx`

- [ ] **Step 1: state 추가**

기존 state 묶음 근처에 `deliveryRequested` 추가. 약 8행에 `const [memo, setMemo] = useState('');` 이후 다음 추가:

```jsx
const [memo,      setMemo]     = useState('');
const [deliveryRequested, setDeliveryRequested] = useState(false);
```

- [ ] **Step 2: 메모 섹션 직후 택배 체크박스 추가**

기존 메모 섹션(약 467~471행) 직후, 회원적립 섹션 직전에 추가:

```jsx
          {/* 메모 섹션 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10 }}>📝 메모</div>
            <input value={memo} onChange={e => setMemo(e.target.value)} style={inputStyle} placeholder="특이사항 입력... (선택)" />
          </div>

          {/* 택배 요청 섹션 (신규) */}
          <label style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer',
            padding:'12px 16px', border:'1px solid var(--border)', borderRadius:'var(--radius)',
            marginBottom:14,
            background: deliveryRequested ? '#fff8e1' : '#f8f9fa'}}>
            <input type="checkbox" checked={deliveryRequested}
              onChange={e => setDeliveryRequested(e.target.checked)}
              style={{width:18, height:18, cursor:'pointer'}}/>
            <span style={{fontSize:13, fontWeight:700}}>🚚 택배 요청</span>
            <span style={{fontSize:11, color:'var(--text3)', marginLeft:'auto'}}>
              고객이 택배 발송을 요청한 경우 체크
            </span>
          </label>

          {/* 회원적립 섹션 */}
```

- [ ] **Step 3: sales insert payload에 delivery_requested 추가**

기존 insert (약 212~219행):

```jsx
        const { error } = await supabase.from('sales').insert({
          sold_at: soldAt, store_name: profile.department, branch_name: profile.branch,
          brand_id: Number(l.brandId), product_id: Number(l.productId),
          quantity: Number(l.quantity), price: Number(String(l.price).replace(/,/g,'')),
          payment: l.payment || '카드', memo: memo.trim() || null, created_by: profile.id,
          customer_id: customerId, points_earned: linePoints,
          points_used: pointsUsedLine,
        });
```

다음으로 변경 (필드 1줄 추가):

```jsx
        const { error } = await supabase.from('sales').insert({
          sold_at: soldAt, store_name: profile.department, branch_name: profile.branch,
          brand_id: Number(l.brandId), product_id: Number(l.productId),
          quantity: Number(l.quantity), price: Number(String(l.price).replace(/,/g,'')),
          payment: l.payment || '카드', memo: memo.trim() || null, created_by: profile.id,
          customer_id: customerId, points_earned: linePoints,
          points_used: pointsUsedLine,
          delivery_requested: deliveryRequested,
        });
```

- [ ] **Step 4: 저장 성공 후 폼 리셋에 deliveryRequested 초기화**

판매 저장 성공 후 폼을 리셋하는 영역(기존 setMemo(''), setLines 등 호출하는 곳)을 찾아 `setDeliveryRequested(false)` 추가. 일반적으로 toast 호출 직전이나 직후에 위치. 정확한 위치는 파일 검색으로:

`Grep`으로 `setMemo\('\)` 또는 `setLines\(` 검색해서 폼 리셋 영역 식별 후, 그 블록에 `setDeliveryRequested(false);` 추가.

- [ ] **Step 5: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled, no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/sales/SalesInputPage.jsx
git commit -m "$(cat <<'EOF'
feat(sales): 판매 입력에 택배 요청 체크박스 추가

메모 섹션 직후 🚚 택배 요청 체크박스. 체크 시 sales.delivery_requested
true로 insert. 저장 성공 후 폼 리셋.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: SalesListPage — 요약 카드 + 리스트 배지 (본사)

**Files:**
- Modify: `src/pages/sales/SalesListPage.jsx`

- [ ] **Step 1: delivery 통계 useMemo 추가**

기존 `totalQty`, `totalAmt` useMemo (약 202~204행) 바로 다음에 추가:

```jsx
  const totalQty = useMemo(() => filtered.reduce((s, r) => s + effQty(r), 0), [filtered]);
  const totalAmt = useMemo(() => filtered.reduce((s, r) => s + effAmt(r), 0), [filtered]);
  const returnedCount = useMemo(() => sales.filter(isFullyReturned).length, [sales]);

  // 택배 발송 통계 (반품 차감 후)
  const deliveryCount = useMemo(
    () => filtered.filter(r => r.delivery_requested && effQty(r) > 0).length,
    [filtered]
  );
  const deliveryAmt = useMemo(
    () => filtered.filter(r => r.delivery_requested).reduce((s, r) => s + effAmt(r), 0),
    [filtered]
  );
```

- [ ] **Step 2: 요약 카드 (인라인 한 줄)**

본문 영역의 카드(card-label "판매내역 조회" 가 있는 div) 시작 직전에 삽입. 약 354행 근처 `<div className="card-label">...</div>` 위 또는 카드 영역 시작 직전:

`Grep`으로 `<div className="card-label">{viewMode === 'list'` 검색 → 그 div가 속한 부모 `<div className="card">` 직전에 다음 추가:

```jsx
      {viewMode === 'list' && deliveryCount > 0 && (
        <div style={{
          background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)',
          padding:'12px 18px', marginBottom:12,
          display:'flex', alignItems:'center', gap:14, flexWrap:'wrap'
        }}>
          <span style={{fontSize:13, fontWeight:700, color:'#e65100', letterSpacing:0.3}}>🚚 택배발송</span>
          <span style={{fontFamily:'var(--mono)', fontSize:16, fontWeight:700, color:'#bf360c'}}>
            {deliveryAmt.toLocaleString()}원
          </span>
          <span style={{fontSize:12, color:'var(--text2)'}}>
            ({deliveryCount.toLocaleString()}건)
          </span>
        </div>
      )}
```

- [ ] **Step 3: 매출 리스트 행 — 상품명 옆 🚚 배지**

기존 상품명 td (약 448~452행):

```jsx
                      <td style={strikeStyle}>
                        {s.product?.name || '-'}
                        {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                        {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {s.returned_qty}개</span>}
                      </td>
```

다음으로 변경 (택배 배지 추가, fully가 아닐 때만 표시 — 반품완료 행은 흐리게 처리되어 있어 시각적 혼란 방지):

```jsx
                      <td style={strikeStyle}>
                        {s.product?.name || '-'}
                        {s.delivery_requested && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>🚚 택배</span>}
                        {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                        {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {s.returned_qty}개</span>}
                      </td>
```

- [ ] **Step 4: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled, no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/sales/SalesListPage.jsx
git commit -m "$(cat <<'EOF'
feat(sales): 본사 매출조회에 택배발송 요약 + 행 배지

- deliveryCount/deliveryAmt useMemo (반품 차감 후 집계)
- 카드 상단에 주황 요약 라인 (택배 건수>0일 때만 표시)
- 매출 리스트 상품명 옆에 🚚 택배 배지 (반품완료 라인엔 미표시)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: MgrSalesViewPage — 카드 + 일자별 펼침 상세 배지

**Files:**
- Modify: `src/pages/sales/MgrSalesViewPage.jsx`

- [ ] **Step 1: totals에 택배 집계 포함**

기존 useMemo (약 52~68행):

```jsx
  const { dailyRows, dailyDetails, totals } = useMemo(() => {
    const dMap = new Map();
    const dDetails = {};
    let totC = 0, totQ = 0, totA = 0;
    for (const r of sales) {
      if (r._eff <= 0) continue;
      const d = r.sold_at;
      if (!dMap.has(d)) dMap.set(d, { date: d, count: 0, qty: 0, amt: 0 });
      const e = dMap.get(d);
      e.count++; e.qty += r._eff; e.amt += r.price * r._eff;
      if (!dDetails[d]) dDetails[d] = [];
      dDetails[d].push(r);
      totC++; totQ += r._eff; totA += r.price * r._eff;
    }
    const list = [...dMap.values()].sort((a,b) => b.date.localeCompare(a.date));
    return { dailyRows: list, dailyDetails: dDetails, totals: { count: totC, qty: totQ, amt: totA } };
  }, [sales]);
```

다음으로 변경 (택배 카운트/금액 누적):

```jsx
  const { dailyRows, dailyDetails, totals } = useMemo(() => {
    const dMap = new Map();
    const dDetails = {};
    let totC = 0, totQ = 0, totA = 0;
    let delC = 0, delA = 0;
    for (const r of sales) {
      if (r._eff <= 0) continue;
      const d = r.sold_at;
      if (!dMap.has(d)) dMap.set(d, { date: d, count: 0, qty: 0, amt: 0 });
      const e = dMap.get(d);
      e.count++; e.qty += r._eff; e.amt += r.price * r._eff;
      if (!dDetails[d]) dDetails[d] = [];
      dDetails[d].push(r);
      totC++; totQ += r._eff; totA += r.price * r._eff;
      if (r.delivery_requested) { delC++; delA += r.price * r._eff; }
    }
    const list = [...dMap.values()].sort((a,b) => b.date.localeCompare(a.date));
    return { dailyRows: list, dailyDetails: dDetails, totals: { count: totC, qty: totQ, amt: totA, deliveryCount: delC, deliveryAmt: delA } };
  }, [sales]);
```

- [ ] **Step 2: 요약 카드 그리드를 4-column으로 확장 (택배 카드 추가)**

기존 카드 그리드 (약 111~125행):

```jsx
      {/* 요약 */}
      {sales.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
          {[
            { label:'기간 매출', value: totals.amt.toLocaleString()+'원', color:'var(--accent)', big:true },
            { label:'판매 건수', value: totals.count.toLocaleString()+'건' },
            { label:'판매 수량', value: totals.qty.toLocaleString()+'개' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', border: s.big?'2px solid var(--sidebar)':'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 18px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:s.big?22:18, fontWeight:700, color: s.color || 'var(--text)', fontFamily:'var(--mono)', lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
```

다음으로 변경 (4-column + delivery 항목 + 색상 분기):

```jsx
      {/* 요약 */}
      {sales.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
          {[
            { label:'기간 매출', value: totals.amt.toLocaleString()+'원', color:'var(--accent)', big:true },
            { label:'판매 건수', value: totals.count.toLocaleString()+'건' },
            { label:'판매 수량', value: totals.qty.toLocaleString()+'개' },
            { label:'🚚 택배발송', value: totals.deliveryAmt.toLocaleString()+'원 ('+totals.deliveryCount.toLocaleString()+'건)', color:'#e65100', borderColor:'#ffcc80' },
          ].map(s => (
            <div key={s.label} style={{
              background:'#fff',
              border: s.big ? '2px solid var(--sidebar)'
                    : s.borderColor ? `2px solid ${s.borderColor}`
                    : '1px solid var(--border)',
              borderRadius:'var(--radius)', padding:'14px 18px'
            }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:s.big?22:14, fontWeight:700, color: s.color || 'var(--text)', fontFamily:'var(--mono)', lineHeight:1.3 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
```

택배 카드는 항상 표시 (delivery=0이면 "0원 (0건)"으로 표시되어 통일성 유지). 폰트 크기는 18→14로 한 단계 작게 — "X원 (N건)" 두 정보를 함께 담느라.

- [ ] **Step 3: 일자별 펼침 상세에서 상품명 옆 🚚 배지**

기존 상품명 td (약 197~202행):

```jsx
                                    <td style={{fontSize:12, ...strike}}>
                                      <strong>{it.product?.name || '-'}</strong>
                                      {it.product?.code && <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>코드: {it.product.code}</div>}
                                      {fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                                      {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {it.returned_qty}</span>}
                                    </td>
```

다음으로 변경 (택배 배지 추가):

```jsx
                                    <td style={{fontSize:12, ...strike}}>
                                      <strong>{it.product?.name || '-'}</strong>
                                      {it.product?.code && <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>코드: {it.product.code}</div>}
                                      {it.delivery_requested && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>🚚 택배</span>}
                                      {fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                                      {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {it.returned_qty}</span>}
                                    </td>
```

- [ ] **Step 4: 빌드 확인**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -6`
Expected: Compiled, no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/sales/MgrSalesViewPage.jsx
git commit -m "$(cat <<'EOF'
feat(sales): 매장 매출조회에 택배발송 카드 + 일자별 상세 배지

- totals에 deliveryCount/deliveryAmt 누적 (반품 차감 후)
- 요약 카드 3→4 column, 4번째에 🚚 택배발송 (주황 테두리)
- 일자별 펼침 상세의 상품명 옆 🚚 택배 배지

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 통합 빌드 + 푸시

- [ ] **Step 1: 최종 빌드**

Run: `cd "c:/Users/Jangkwon/Desktop/goodmd" && unset CI && npm run build 2>&1 | tail -10`
Expected: Compiled with warnings (기존만), 새 에러 없음.

- [ ] **Step 2: 푸시**

Run: `git push origin main`
Expected: 푸시 성공, Vercel 자동 배포 트리거.

- [ ] **Step 3: 수동 점검 항목 (사용자 확인)**

```
☐ Supabase SQL Editor에서 Prereq ALTER TABLE 실행 완료
☐ 매장 판매 입력 페이지 — 메모 아래에 🚚 택배 요청 체크박스 노출
☐ 체크 후 저장 — sales 테이블에 delivery_requested=true로 들어감 (DB 확인)
☐ 저장 후 폼이 리셋되어 체크박스도 풀림
☐ 매장 매니저 매출 조회 — 카드 4개 중 4번째에 🚚 택배발송 항목 표시
☐ 매니저 매출 조회 일자별 펼침 — 상품명 옆 🚚 택배 배지
☐ 본사 매출 조회 (SalesListPage) — 카드 상단에 주황 요약 라인 (택배 건수>0일 때)
☐ 본사 매출 리스트 — 상품명 옆 🚚 택배 배지
☐ 반품 처리 시 — 택배 통계에서 자동 제외 확인
```

---

## Self-Review

### Spec coverage

| Spec 섹션 | 대응 Task |
|---|---|
| §2.1 매장 직원 판매 입력 | Task 1 |
| §2.2 본사 매출 조회 | Task 2 |
| §2.3 매장 매니저 매출 조회 | Task 3 |
| §3.1 컬럼 추가 | Prerequisites |
| §3.2 매출 계산 패턴 | Task 2, 3 (effQty 활용) |
| §4.1 SalesInputPage 체크박스 | Task 1 |
| §4.2 SalesListPage 카드 + 배지 | Task 2 |
| §4.3 MgrSalesViewPage 동일 적용 | Task 3 |
| §5 회귀 영향 | DEFAULT false로 자동 처리 |
| §6 비목표 | 구현 안 함 |

### Placeholder scan

- "TBD", "implement later", "fill in details" 없음.
- Task 1 Step 4의 "폼 리셋 영역 식별" — 사용자가 grep으로 확인하라는 명확한 행동 지침 있음. OK.

### Type consistency

- `delivery_requested` 컬럼명 일관 사용 (boolean)
- `deliveryCount` / `deliveryAmt` 변수명 일관 (SalesListPage)
- `totals.deliveryCount` / `totals.deliveryAmt` (MgrSalesViewPage)
- 색상 팔레트 일관: 주황 `#e65100`, `#fff3e0`, `#ffcc80`, `#bf360c`
- 배지 텍스트 일관: `🚚 택배` (리스트), `🚚 택배발송` (요약 카드)
