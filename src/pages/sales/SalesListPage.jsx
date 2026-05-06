import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq, dlBlob } from '../../lib/utils';
import SalesTabNav from './SalesTabNav';

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
      // i가 홀수 인덱스(2/4/6번째 행) 옅은 배경
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

export default function SalesListPage({ setPage }) {
  const [sales,   setSales]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStore,  setFStore]  = useState('');
  const [fBrand,  setFBrand]  = useState('');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');
  const [fKeyword,setFKeyword]= useState('');
  const [sortBy,  setSortBy]  = useState('date'); // 'date' | 'qty_desc' | 'amt_desc'
  const [showReturned, setShowReturned] = useState(false); // 완전반품 포함
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'product'
  const [exporting, setExporting] = useState(false);
  const [aggSortBy, setAggSortBy] = useState('amt_desc'); // 'amt_desc' | 'qty_desc' | 'count_desc' | 'name'
  const [drillProduct, setDrillProduct] = useState(null); // {key, product_id, product_name, brand_name, count, qty, amt} | null
  const [drillTab,     setDrillTab]     = useState('store'); // 'store' | 'date'

  // 날짜 빠른 선택
  const setDateRange = (type) => {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    if (type === 'yesterday') {
      const y = new Date(now); y.setDate(now.getDate()-1);
      setFFrom(fmt(y)); setFTo(fmt(y));
    } else if (type === 'thismonth') {
      setFFrom(`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`);
      setFTo(fmt(now));
    } else if (type === 'lastmonth') {
      const first = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      setFFrom(fmt(first)); setFTo(fmt(last));
    }
  };

  const fetchSales = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('sales')
      .select('*, brand:brands(name), product:products(name), seller:profiles(name,department,branch)')
      .order('sold_at', { ascending: false });
    if (fStore) q = q.eq('store_name', fStore);
    if (fBrand) q = q.eq('brand_id', fBrand);
    if (fFrom)  q = q.gte('sold_at', fFrom);
    if (fTo)    q = q.lte('sold_at', fTo);
    const { data, error } = await q.limit(500);
    if (error) toast(error.message, 'err');
    else setSales(data || []);
    setLoading(false);
  }, [fStore, fBrand, fFrom, fTo]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const [brands, setBrands] = useState([]);
  useEffect(() => { supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || [])); }, []);

  const stores = useMemo(() => uniq(sales.map(s => s.store_name)), [sales]);

  // 실효 수량/금액 (반품 차감)
  const effQty = (s) => Math.max(0, (s.quantity||0) - (s.returned_qty||0));
  const effAmt = (s) => effQty(s) * (s.price||0);
  const isFullyReturned = (s) => (s.returned_qty||0) >= (s.quantity||0);
  const isPartialReturn = (s) => (s.returned_qty||0) > 0 && !isFullyReturned(s);

  // 키워드 필터 + 반품 필터 + 정렬 (클라이언트 사이드)
  const filtered = useMemo(() => {
    let result = sales;
    if (!showReturned) result = result.filter(s => !isFullyReturned(s));
    if (fKeyword.trim()) {
      const kw = fKeyword.trim().toLowerCase();
      result = result.filter(s =>
        (s.product?.name || '').toLowerCase().includes(kw) ||
        (s.brand?.name   || '').toLowerCase().includes(kw) ||
        (s.memo          || '').toLowerCase().includes(kw)
      );
    }
    if (sortBy === 'qty_desc') result = [...result].sort((a,b) => effQty(b) - effQty(a));
    if (sortBy === 'amt_desc') result = [...result].sort((a,b) => effAmt(b) - effAmt(a));
    return result;
  }, [sales, fKeyword, sortBy, showReturned]);

  const totalQty = useMemo(() => filtered.reduce((s, r) => s + effQty(r), 0), [filtered]);
  const totalAmt = useMemo(() => filtered.reduce((s, r) => s + effAmt(r), 0), [filtered]);
  const returnedCount = useMemo(() => sales.filter(isFullyReturned).length, [sales]);

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

  // 상품별 집계 (filtered 기준)
  const productAgg = useMemo(() => {
    const map = new Map();
    for (const s of filtered) {
      const key = s.product_id ?? `name:${s.product?.name || '-'}`;
      const eq = effQty(s);
      const ea = effAmt(s);
      const cur = map.get(key);
      if (cur) {
        cur.count += 1;
        cur.qty   += eq;
        cur.amt   += ea;
      } else {
        map.set(key, {
          key,
          product_id: s.product_id,
          product_name: s.product?.name || '-',
          brand_name:   s.brand?.name   || '-',
          count: 1,
          qty:   eq,
          amt:   ea,
        });
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  const productAggSorted = useMemo(() => {
    const arr = [...productAgg];
    if (aggSortBy === 'amt_desc')   arr.sort((a,b) => b.amt - a.amt);
    if (aggSortBy === 'qty_desc')   arr.sort((a,b) => b.qty - a.qty);
    if (aggSortBy === 'count_desc') arr.sort((a,b) => b.count - a.count);
    if (aggSortBy === 'name')       arr.sort((a,b) => a.product_name.localeCompare(b.product_name, 'ko'));
    return arr;
  }, [productAgg, aggSortBy]);

  const aggTotalCount = useMemo(() => productAgg.reduce((s,r) => s + r.count, 0), [productAgg]);
  const aggTotalQty   = useMemo(() => productAgg.reduce((s,r) => s + r.qty,   0), [productAgg]);
  const aggTotalAmt   = useMemo(() => productAgg.reduce((s,r) => s + r.amt,   0), [productAgg]);
  const truncated     = sales.length === 500;

  const drillRows = useMemo(() => {
    if (!drillProduct) return [];
    return filtered.filter(s => {
      if (drillProduct.product_id != null) return s.product_id === drillProduct.product_id;
      return (s.product?.name || '-') === drillProduct.product_name;
    });
  }, [filtered, drillProduct]);

  const drillByStore = useMemo(() => {
    const map = new Map();
    for (const s of drillRows) {
      const k = `${s.store_name || '-'}|${s.branch_name || '-'}`;
      const eq = effQty(s);
      const ea = effAmt(s);
      const cur = map.get(k);
      if (cur) { cur.count += 1; cur.qty += eq; cur.amt += ea; }
      else map.set(k, { store_name: s.store_name || '-', branch_name: s.branch_name || '-', count:1, qty:eq, amt:ea });
    }
    return Array.from(map.values()).sort((a,b) => b.amt - a.amt);
  }, [drillRows]);

  const drillByDate = useMemo(() => {
    const map = new Map();
    for (const s of drillRows) {
      const k = s.sold_at;
      const eq = effQty(s);
      const ea = effAmt(s);
      const cur = map.get(k);
      if (cur) { cur.count += 1; cur.qty += eq; cur.amt += ea; }
      else map.set(k, { sold_at: k, count:1, qty:eq, amt:ea });
    }
    return Array.from(map.values()).sort((a,b) => String(a.sold_at).localeCompare(String(b.sold_at)));
  }, [drillRows]);

  useEffect(() => {
    if (!drillProduct) return;
    const onKey = (e) => { if (e.key === 'Escape') setDrillProduct(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drillProduct]);

  useEffect(() => {
    if (viewMode !== 'product') setDrillProduct(null);
  }, [viewMode]);

  const quickBtnStyle = (active) => ({
    height:34, padding:'0 12px', border:'2px solid', borderRadius:'var(--radius)',
    fontSize:12, fontWeight:700, cursor:'pointer',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    background:  active ? '#fff3e0' : '#fff',
    color:       active ? 'var(--accent)' : 'var(--text2)',
  });

  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const yest = new Date(today); yest.setDate(today.getDate()-1);
  const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth()+1)}-${pad(yest.getDate())}`;
  const thisMonthFrom = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;
  const lastMonthFirst = new Date(today.getFullYear(), today.getMonth()-1, 1);
  const lastMonthLast  = new Date(today.getFullYear(), today.getMonth(), 0);
  const lmFrom = `${lastMonthFirst.getFullYear()}-${pad(lastMonthFirst.getMonth()+1)}-01`;
  const lmTo   = `${lastMonthLast.getFullYear()}-${pad(lastMonthLast.getMonth()+1)}-${pad(lastMonthLast.getDate())}`;

  const isYesterday  = fFrom === yestStr  && fTo === yestStr;
  const isThisMonth  = fFrom === thisMonthFrom && fTo === todayStr;
  const isLastMonth  = fFrom === lmFrom   && fTo === lmTo;

  return (
    <div>
      {setPage && <SalesTabNav current="sales_list" setPage={setPage}/>}
      <div className="card">
        <div style={{display:'flex', gap:8, marginBottom:12}}>
          <button
            style={{
              height:36, padding:'0 16px', border:'2px solid',
              borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
              borderColor: viewMode==='list' ? 'var(--accent)' : 'var(--border)',
              background:  viewMode==='list' ? '#fff3e0' : '#fff',
              color:       viewMode==='list' ? 'var(--accent)' : 'var(--text2)',
            }}
            onClick={() => { setViewMode('list'); setSortBy('date'); }}
          >📋 판매내역</button>
          <button
            style={{
              height:36, padding:'0 16px', border:'2px solid',
              borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
              borderColor: viewMode==='product' ? 'var(--accent)' : 'var(--border)',
              background:  viewMode==='product' ? '#fff3e0' : '#fff',
              color:       viewMode==='product' ? 'var(--accent)' : 'var(--text2)',
            }}
            onClick={() => { setViewMode('product'); setAggSortBy('amt_desc'); }}
          >📊 상품별 집계</button>
        </div>
        <div className="card-label">{viewMode === 'list' ? '판매내역 조회' : '상품별 집계'}</div>
        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 점포</option>
            {stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBrand} onChange={e => setFBrand(e.target.value)}>
            <option value="">전체 브랜드</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="시작일" />
          <span style={{fontSize:12,color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="종료일" />
          <button style={quickBtnStyle(isYesterday)}  onClick={() => setDateRange('yesterday')}>어제</button>
          <button style={quickBtnStyle(isThisMonth)}  onClick={() => setDateRange('thismonth')}>당월</button>
          <button style={quickBtnStyle(isLastMonth)}  onClick={() => setDateRange('lastmonth')}>전월</button>
          <input className="finput" value={fKeyword} onChange={e => setFKeyword(e.target.value)}
            placeholder="🔍 상품명·브랜드·메모 검색" style={{height:34, minWidth:180}} />
          {viewMode === 'list' ? (
            <select className="fsel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date">최신순</option>
              <option value="qty_desc">판매건수 높은순</option>
              <option value="amt_desc">매출액 높은순</option>
            </select>
          ) : (
            <select className="fsel" value={aggSortBy} onChange={e => setAggSortBy(e.target.value)}>
              <option value="amt_desc">매출액 높은순</option>
              <option value="qty_desc">수량 높은순</option>
              <option value="count_desc">판매건수 높은순</option>
              <option value="name">상품명순</option>
            </select>
          )}
          <label style={{display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'var(--text2)', cursor:'pointer', padding:'0 8px'}}>
            <input type="checkbox" checked={showReturned} onChange={e => setShowReturned(e.target.checked)}
              style={{width:15, height:15, cursor:'pointer'}}/>
            완전반품 포함 {returnedCount > 0 && <span style={{color:'var(--danger)', fontWeight:700}}>({returnedCount})</span>}
          </label>
          {(fStore||fBrand||fFrom||fTo||fKeyword) &&
            <button className="btn-ghost" onClick={() => { setFStore(''); setFBrand(''); setFFrom(''); setFTo(''); setFKeyword(''); setSortBy('date'); setAggSortBy('amt_desc'); }}>✕ 초기화</button>}
          <div className="fbar-right">
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
              <span className="fresult">
                <b>{productAgg.length.toLocaleString()}</b>개 상품 · <b>{aggTotalCount.toLocaleString()}</b>건 · <b>{aggTotalQty.toLocaleString()}</b>개 · <b>{aggTotalAmt.toLocaleString()}</b>원
                {truncated && <span style={{marginLeft:8, fontSize:11, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'2px 8px', borderRadius:3}}>⚠️ 서버 조회 500건 한도 도달 - 기간/필터를 좁혀주세요</span>}
              </span>
            )}
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : viewMode === 'list' ? (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>판매일</th><th>점포</th><th>지점</th><th>매니저</th>
                  <th>브랜드</th><th>상품명</th>
                  <th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th>
                  <th>결제</th><th>메모</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={11} className="empty">조회된 판매 내역이 없습니다</td></tr>
                  : filtered.map(s => {
                    const fully = isFullyReturned(s);
                    const partial = isPartialReturn(s);
                    const strikeStyle = fully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                    return (
                    <tr key={s.id} style={fully ? { background:'#fafafa' } : {}}>
                      <td className="mono" style={strikeStyle}>{s.sold_at}</td>
                      <td><span className="badge badge-dept" style={fully?{opacity:0.5}:{}}>{s.store_name}</span></td>
                      <td><span className="badge badge-store" style={fully?{opacity:0.5}:{}}>{s.branch_name}</span></td>
                      <td style={{fontSize:12, ...strikeStyle}}>{s.seller?.name || '-'}</td>
                      <td style={strikeStyle}>{s.brand?.name || '-'}</td>
                      <td style={strikeStyle}>
                        {s.product?.name || '-'}
                        {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                        {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {s.returned_qty}개</span>}
                      </td>
                      <td className="r" style={strikeStyle}>{effQty(s)}</td>
                      <td className="r" style={strikeStyle}>{Number(s.price).toLocaleString()}</td>
                      <td className="r" style={{fontWeight:600, ...strikeStyle}}>{effAmt(s).toLocaleString()}</td>
                      <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, ...(fully?{opacity:0.5}:{})}}>{s.payment}</span></td>
                      <td style={{fontSize:11,color:'var(--text2)', ...strikeStyle}}>{s.memo || '-'}</td>
                    </tr>
                  )})
                }
              </tbody>
            </table>
          </div>
        ) : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>브랜드</th>
                  <th>상품명</th>
                  <th className="r">판매건수</th>
                  <th className="r">총 수량</th>
                  <th className="r">총 매출액</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {productAggSorted.length === 0
                  ? <tr><td colSpan={6} className="empty">조회된 상품이 없습니다</td></tr>
                  : productAggSorted.map(p => (
                    <tr key={p.key}>
                      <td>{p.brand_name}</td>
                      <td style={{fontWeight:600}}>{p.product_name}</td>
                      <td className="r">{p.count.toLocaleString()}</td>
                      <td className="r">{p.qty.toLocaleString()}</td>
                      <td className="r" style={{fontWeight:600}}>{p.amt.toLocaleString()}</td>
                      <td>
                        <button
                          style={{height:26, padding:'0 8px', fontSize:11, fontWeight:600, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor:'pointer', marginRight:4}}
                          onClick={() => { setDrillProduct(p); setDrillTab('store'); }}
                        >🏬 점포별</button>
                        <button
                          style={{height:26, padding:'0 8px', fontSize:11, fontWeight:600, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor:'pointer'}}
                          onClick={() => { setDrillProduct(p); setDrillTab('date'); }}
                        >📅 날짜별</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
      {drillProduct && (
        <div
          style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => setDrillProduct(null)}
        >
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div
            style={{position:'relative', background:'#fff', borderRadius:16, width:'min(880px,95vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{padding:'20px 24px 16px', borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
                <div>
                  <div style={{fontSize:18, fontWeight:700}}>{drillProduct.product_name}</div>
                  <div style={{fontSize:12, color:'var(--text2)', marginTop:4}}>
                    {drillProduct.brand_name}
                    {(fFrom || fTo) && <span style={{marginLeft:10}}>· {fFrom || '~'} ~ {fTo || '~'}</span>}
                    <span style={{marginLeft:10}}>· {drillProduct.count.toLocaleString()}건 · {drillProduct.qty.toLocaleString()}개 · {drillProduct.amt.toLocaleString()}원</span>
                  </div>
                </div>
                <button
                  onClick={() => setDrillProduct(null)}
                  style={{height:32, padding:'0 12px', border:'1px solid var(--border)', borderRadius:6, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer'}}
                >✕ 닫기</button>
              </div>
              <div style={{display:'flex', gap:8, marginTop:14}}>
                <button
                  style={{
                    height:32, padding:'0 14px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
                    borderColor: drillTab==='store' ? 'var(--accent)' : 'var(--border)',
                    background:  drillTab==='store' ? '#fff3e0' : '#fff',
                    color:       drillTab==='store' ? 'var(--accent)' : 'var(--text2)',
                  }}
                  onClick={() => setDrillTab('store')}
                >🏬 점포별</button>
                <button
                  style={{
                    height:32, padding:'0 14px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
                    borderColor: drillTab==='date' ? 'var(--accent)' : 'var(--border)',
                    background:  drillTab==='date' ? '#fff3e0' : '#fff',
                    color:       drillTab==='date' ? 'var(--accent)' : 'var(--text2)',
                  }}
                  onClick={() => setDrillTab('date')}
                >📅 날짜별</button>
              </div>
            </div>
            {/* 본문 */}
            <div style={{padding:'16px 24px 24px'}}>
              {drillTab === 'store' ? (
                <div className="twrap">
                  <table>
                    <thead>
                      <tr>
                        <th>점포</th><th>지점</th>
                        <th className="r">판매건수</th><th className="r">수량</th><th className="r">매출액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillByStore.length === 0
                        ? <tr><td colSpan={5} className="empty">데이터 없음</td></tr>
                        : drillByStore.map(r => (
                          <tr key={`${r.store_name}|${r.branch_name}`}>
                            <td><span className="badge badge-dept">{r.store_name}</span></td>
                            <td><span className="badge badge-store">{r.branch_name}</span></td>
                            <td className="r">{r.count.toLocaleString()}</td>
                            <td className="r">{r.qty.toLocaleString()}</td>
                            <td className="r" style={{fontWeight:600}}>{r.amt.toLocaleString()}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="twrap">
                  <table>
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th className="r">판매건수</th><th className="r">수량</th><th className="r">매출액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillByDate.length === 0
                        ? <tr><td colSpan={4} className="empty">데이터 없음</td></tr>
                        : drillByDate.map(r => (
                          <tr key={r.sold_at}>
                            <td className="mono">{r.sold_at}</td>
                            <td className="r">{r.count.toLocaleString()}</td>
                            <td className="r">{r.qty.toLocaleString()}</td>
                            <td className="r" style={{fontWeight:600}}>{r.amt.toLocaleString()}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
