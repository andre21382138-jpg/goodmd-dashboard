import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq, dlBlob } from '../../lib/utils';
import SalesTabNav from './SalesTabNav';

async function exportSalesRaw({ fStore, fBranch, fBrand, fFrom, fTo, fKeyword }) {
  // 1) 페이징 fetch (Supabase 1000건 limit 회피)
  const PAGE = 1000;
  let all = [], start = 0;
  while (true) {
    let q = supabase.from('sales')
      .select('id, sold_at, store_name, branch_name, payment, quantity, returned_qty, price, points_used, brand:brands(name), product:products(code, name, cost)')
      .order('sold_at', { ascending: true })
      .order('id',      { ascending: true });
    if (fStore)  q = q.eq('store_name',  fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    if (fBrand)  q = q.eq('brand_id', fBrand);
    if (fFrom)   q = q.gte('sold_at', fFrom);
    if (fTo)     q = q.lte('sold_at', fTo);
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

  // 4) ExcelJS 워크북 생성 (외부 매출raw 양식과 일치)
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('매출raw');
  ws.columns = [
    { width: 4 },      // A 선택
    { width: 10.85 },  // B 순번
    { width: 11.28 },  // C 매출일자
    { width: 14.85 },  // D 그룹
    { width: 20.14 },  // E 매장
    { width: 12.43 },  // F 전표유형
    { width: 17 },     // G 상품코드
    { width: 52.85 },  // H 상품명
    { width: 7.85 },   // I 매출수량
    { width: 12.85 },  // J 최종금액
    { width: 16.43 },  // K 원가
    { width: 16 },     // L 최종원가
    { width: 14.43 },  // M 원가율(헤더 없음)
  ];
  const headerRow = ws.addRow(['선택','순번','매출일자','그룹','매장','전표\n유형','상품코드','상품명','매출\n수량','최종금액','원가','최종원가','']);
  headerRow.height = 23.45;
  headerRow.eachCell((cell, ci) => {
    if (ci === 12) cell.font = { bold: true, name: '맑은 고딕', size: 10 };
    else if (ci === 13) cell.font = { name: 'Arial', size: 10 };
    else cell.font = { bold: true, name: 'Gulim', size: 9 };
    if (ci === 10) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    const center = (ci === 6 || ci === 7 || ci === 10 || ci === 11 || ci === 12);
    cell.alignment = center
      ? { horizontal: 'center', vertical: 'middle', wrapText: true }
      : { vertical: 'middle', wrapText: true };
  });

  // 5) 데이터 행 (행 높이/배경 미지정, Gulim 9 / Arial 10)
  rows.forEach((s, i) => {
    const effQty = Math.max(0, (s.quantity || 0) - (s.returned_qty || 0));
    const finalAmount = effQty * (Number(s.price) || 0);
    const cost = (s.product && s.product.cost != null) ? Number(s.product.cost) : null;
    const finalCost = cost != null ? cost * effQty : null;
    const ratio = (cost != null && finalAmount > 0) ? (finalCost / finalAmount) : null;
    // KST 정오를 기준으로 Date 객체 생성 → 어느 timezone에서 표시해도 같은 일자 유지
    const dateObj = s.sold_at ? new Date(`${String(s.sold_at).slice(0,10)}T12:00:00+09:00`) : null;
    const codeStr = s.product?.code || '';
    const codeValue = /^\d+$/.test(codeStr) ? Number(codeStr) : codeStr;

    // NOTE: 외부 양식 D=그룹(=DB store_name 백화점), E=매장(=DB branch_name 지점)
    const row = ws.addRow([
      '0',
      i + 1,
      dateObj,
      s.store_name || '',
      s.branch_name || '',
      mapType(s.payment),
      codeValue,
      s.product?.name || '',
      effQty,
      finalAmount,
      cost != null ? cost : '',
      finalCost != null ? finalCost : '',
      ratio != null ? ratio : '',
    ]);
    row.eachCell((cell, ci) => {
      cell.font = (ci >= 11) ? { name: 'Arial', size: 10 } : { name: 'Gulim', size: 9 };
      if (ci === 1)  cell.numFmt = '@';
      if (ci === 3 && dateObj) cell.numFmt = '[$-412]yyyy-mm-dd';
      if (ci === 7)  cell.numFmt = '0_);[Red](0)';
      if (ci === 9 || ci === 10) cell.numFmt = '#,##0';
      if (ci === 11) cell.numFmt = '#,##0_ ';
      if (ci === 12) cell.numFmt = '#,##0_ ;[Red]-#,##0 ';
      if (ci === 13 && ratio != null) cell.numFmt = '0%';
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
  const [fBranch, setFBranch] = useState('');
  const [fBrand,  setFBrand]  = useState('');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');
  const [fKeyword,setFKeyword]= useState('');
  const [sortBy,  setSortBy]  = useState('date'); // 'date' | 'qty_desc' | 'amt_desc'
  const [showReturned, setShowReturned] = useState(false); // 완전반품 포함
  const [viewMode, setViewMode] = useState('store'); // 'store' | 'list' | 'product'
  const [drillStore, setDrillStore] = useState(null); // { store_name, branch_name } 상세보기 대상
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
      .select('*, delivery_type, delivery_status, brand:brands(name), product:products(name), seller:profiles(name,department,branch), customer:customers(name)')
      .order('sold_at', { ascending: false });
    if (fStore)  q = q.eq('store_name',  fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    if (fBrand)  q = q.eq('brand_id', fBrand);
    if (fFrom)   q = q.gte('sold_at', fFrom);
    if (fTo)     q = q.lte('sold_at', fTo);
    const { data, error } = await q.limit(500);
    if (error) toast(error.message, 'err');
    else setSales(data || []);
    setLoading(false);
  }, [fStore, fBranch, fBrand, fFrom, fTo]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const [brands, setBrands] = useState([]);
  useEffect(() => { supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || [])); }, []);

  const stores = useMemo(() => uniq(sales.map(s => s.store_name)), [sales]);
  // 점포 선택 시 그 점포에 속한 지점만, 미선택이면 전체 지점
  const branches = useMemo(() => {
    const base = fStore ? sales.filter(s => s.store_name === fStore) : sales;
    return uniq(base.map(s => s.branch_name));
  }, [sales, fStore]);

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

  // 트랜잭션 그룹화 — 같은 sold_at + 매장 + 지점 + 고객 + created_at 60초 윈도 = 같은 결제 묶음
  const groupedList = useMemo(() => {
    const groups = [];
    // sold_at desc 정렬 유지, 그룹 내부는 created_at 오름차순
    const groupMap = new Map();
    for (const s of filtered) {
      const custKey = s.customer_id || `__no_${s.id}__guest__${(s.created_at||'').slice(0,16)}`;
      const baseKey = `${s.sold_at}|${s.store_name}|${s.branch_name}|${custKey}`;
      const ts = new Date(s.created_at || 0).getTime();
      let g = groupMap.get(baseKey);
      if (g && Math.abs(ts - g.lastTs) <= 60000) {
        g.rows.push(s); g.lastTs = ts;
      } else {
        g = { key: `${baseKey}|${s.id}`, rows: [s], firstTs: ts, lastTs: ts, sold_at: s.sold_at };
        groupMap.set(baseKey, g);
        groups.push(g);
      }
    }
    return groups;
  }, [filtered]);

  // 그룹 합계 헬퍼
  const groupQty = (g) => g.rows.reduce((s, r) => s + effQty(r), 0);
  const groupAmt = (g) => g.rows.reduce((s, r) => s + effAmt(r), 0);
  const groupPointsUsed = (g) => g.rows.reduce((s, r) => s + (Number(r.points_used)||0), 0);
  const groupPayments = (g) => {
    const set = new Set(g.rows.map(r => r.payment).filter(p => p && p !== '적립금사용'));
    return Array.from(set);
  };

  const [drillGroup, setDrillGroup] = useState(null); // 트랜잭션 상세보기 모달

  // 택배 발송 통계 (반품 차감 후)
  const deliveryCount = useMemo(
    () => filtered.filter(r => r.delivery_requested && effQty(r) > 0).length,
    [filtered]
  );
  const deliveryAmt = useMemo(
    () => filtered.filter(r => r.delivery_requested).reduce((s, r) => s + effAmt(r), 0),
    [filtered]
  );

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const n = await exportSalesRaw({ fStore, fBranch, fBrand, fFrom, fTo, fKeyword });
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

  // 매장별 집계 (점포·지점 단위)
  const storeAgg = useMemo(() => {
    const map = new Map();
    for (const s of filtered) {
      const key = `${s.store_name || '-'}|${s.branch_name || '-'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          store_name: s.store_name || '-',
          branch_name: s.branch_name || '-',
          count: 0,
          qty: 0,
          amt: 0,
        });
      }
      const g = map.get(key);
      g.count += 1;
      g.qty   += effQty(s);
      g.amt   += effAmt(s);
    }
    return [...map.values()].sort((a,b) => b.amt - a.amt);
  }, [filtered]);
  const storeTotalCount = useMemo(() => storeAgg.reduce((s,r) => s + r.count, 0), [storeAgg]);
  const storeTotalQty   = useMemo(() => storeAgg.reduce((s,r) => s + r.qty,   0), [storeAgg]);
  const storeTotalAmt   = useMemo(() => storeAgg.reduce((s,r) => s + r.amt,   0), [storeAgg]);
  // 매장별 상세보기 모달 — 선택한 매장의 거래만 필터
  const drillStoreRows = useMemo(() => {
    if (!drillStore) return [];
    return filtered.filter(s =>
      (s.store_name || '-') === drillStore.store_name &&
      (s.branch_name || '-') === drillStore.branch_name
    );
  }, [filtered, drillStore]);
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
      <div className="card">
        <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
          <button
            style={{
              height:36, padding:'0 16px', border:'2px solid',
              borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
              borderColor: viewMode==='store' ? 'var(--accent)' : 'var(--border)',
              background:  viewMode==='store' ? '#fff3e0' : '#fff',
              color:       viewMode==='store' ? 'var(--accent)' : 'var(--text2)',
            }}
            onClick={() => setViewMode('store')}
          >🏬 매장별 집계</button>
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
        <div className="card-label">
          {viewMode === 'list' ? '판매내역 조회' : viewMode === 'product' ? '상품별 집계' : '매장별 집계'}
        </div>
        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
            <option value="">전체 점포</option>
            {stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)}>
            <option value="">전체 지점</option>
            {branches.map(b => <option key={b}>{b}</option>)}
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
          {(fStore||fBranch||fBrand||fFrom||fTo||fKeyword) &&
            <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); setFBrand(''); setFFrom(''); setFTo(''); setFKeyword(''); setSortBy('date'); setAggSortBy('amt_desc'); }}>✕ 초기화</button>}
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
            ) : viewMode === 'product' ? (
              <span className="fresult">
                <b>{productAgg.length.toLocaleString()}</b>개 상품 · <b>{aggTotalCount.toLocaleString()}</b>건 · <b>{aggTotalQty.toLocaleString()}</b>개 · <b>{aggTotalAmt.toLocaleString()}</b>원
                {truncated && <span style={{marginLeft:8, fontSize:11, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'2px 8px', borderRadius:3}}>⚠️ 서버 조회 500건 한도 도달 - 기간/필터를 좁혀주세요</span>}
              </span>
            ) : (
              <span className="fresult">
                <b>{storeAgg.length.toLocaleString()}</b>개 매장 · <b>{storeTotalCount.toLocaleString()}</b>건 · <b>{storeTotalQty.toLocaleString()}</b>개 · <b>{storeTotalAmt.toLocaleString()}</b>원
                {truncated && <span style={{marginLeft:8, fontSize:11, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'2px 8px', borderRadius:3}}>⚠️ 서버 조회 500건 한도 도달 - 기간/필터를 좁혀주세요</span>}
              </span>
            )}
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : viewMode === 'store' ? (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>점포</th>
                  <th>지점</th>
                  <th className="r">판매건수</th>
                  <th className="r">총 수량</th>
                  <th className="r">총 매출액</th>
                  <th style={{width:120, textAlign:'center'}}>상세</th>
                </tr>
              </thead>
              <tbody>
                {storeAgg.length === 0
                  ? <tr><td colSpan={6} className="empty">조회된 매장이 없습니다</td></tr>
                  : storeAgg.map(g => (
                    <tr key={g.key}>
                      <td><span className="badge badge-dept">{g.store_name}</span></td>
                      <td><span className="badge badge-store">{g.branch_name}</span></td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{g.count.toLocaleString()}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{g.qty.toLocaleString()}</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{g.amt.toLocaleString()}원</td>
                      <td style={{textAlign:'center'}}>
                        <button className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}}
                          onClick={() => setDrillStore({ store_name: g.store_name, branch_name: g.branch_name })}>
                          상세보기
                        </button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        ) : viewMode === 'list' ? (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>판매일</th><th>점포</th><th>지점</th><th>매니저</th>
                  <th>고객</th>
                  <th>상품명</th>
                  <th className="r">총 수량</th><th className="r">총 합계</th>
                  <th>결제</th><th style={{whiteSpace:'nowrap', minWidth:88}}>출고방식</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {groupedList.length === 0
                  ? <tr><td colSpan={11} className="empty">조회된 판매 내역이 없습니다</td></tr>
                  : groupedList.map(g => {
                    const head = g.rows[0];
                    const totalQty = groupQty(g);
                    const totalAmt = groupAmt(g);
                    const ptsUsed = groupPointsUsed(g);
                    const payments = groupPayments(g);
                    const extraCount = g.rows.length - 1;
                    const allFully = g.rows.every(r => isFullyReturned(r));
                    const strikeStyle = allFully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                    return (
                    <tr key={g.key} style={allFully ? { background:'#fafafa' } : {}}>
                      <td className="mono" style={strikeStyle}>{head.sold_at}</td>
                      <td><span className="badge badge-dept" style={allFully?{opacity:0.5}:{}}>{head.store_name}</span></td>
                      <td><span className="badge badge-store" style={allFully?{opacity:0.5}:{}}>{head.branch_name}</span></td>
                      <td style={{fontSize:12, ...strikeStyle}}>{head.seller?.name || '-'}</td>
                      <td style={{fontSize:12, ...strikeStyle}}>{head.customer?.name || '-'}</td>
                      <td style={strikeStyle}>
                        {head.product?.name || '-'}
                        {extraCount > 0 && (
                          <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#1565C0', background:'#e3f2fd', border:'1px solid #90caf9', padding:'1px 6px', borderRadius:3}}>
                            외 {extraCount}개
                          </span>
                        )}
                      </td>
                      <td className="r" style={strikeStyle}>{totalQty}</td>
                      <td className="r" style={{fontWeight:600, ...strikeStyle}}>{totalAmt.toLocaleString()}</td>
                      <td>
                        {payments.length > 0 && payments.map(p => (
                          <span key={p} className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, marginRight:2, ...(allFully?{opacity:0.5}:{})}}>{p}</span>
                        ))}
                        {ptsUsed > 0 && (
                          <div style={{fontSize:10, color:'#6a1b9a', fontWeight:700, marginTop:2, whiteSpace:'nowrap'}}>
                            💳 적립금 -{ptsUsed.toLocaleString()}원
                          </div>
                        )}
                      </td>
                      <td style={{whiteSpace:'nowrap', padding:'4px 8px', ...strikeStyle}}>
                        {(!head.delivery_type || head.delivery_type === 'none') && <span style={{fontSize:10, fontWeight:700, color:'#455a64', background:'#eceff1', border:'1px solid #b0bec5', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>매장판매</span>}
                        {head.delivery_type === 'store' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>택배(매장)</span>}
                        {head.delivery_type === 'hq' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>택배(본사)</span>}
                      </td>
                      <td>
                        <button className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}}
                          onClick={() => setDrillGroup(g)}>
                          상세보기
                        </button>
                      </td>
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

      {/* 매장별 상세보기 모달 */}
      {drillStore && (
        <div style={{position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}} onClick={() => setDrillStore(null)}/>
          <div style={{position:'relative', background:'#fff', borderRadius:12, padding:'20px 24px', width:'90vw', maxWidth:1200, maxHeight:'85vh', overflow:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
              <span className="badge badge-dept">{drillStore.store_name}</span>
              <span className="badge badge-store">{drillStore.branch_name}</span>
              <span style={{fontSize:13, color:'var(--text2)', fontWeight:600}}>판매 상세 — {drillStoreRows.length}건</span>
              <button type="button" onClick={() => setDrillStore(null)}
                style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
            </div>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>판매일</th><th>매니저</th><th>브랜드</th><th>상품명</th>
                    <th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th>
                    <th>결제</th><th style={{whiteSpace:'nowrap', minWidth:88}}>출고방식</th><th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {drillStoreRows.length === 0
                    ? <tr><td colSpan={10} className="empty">판매 내역이 없습니다</td></tr>
                    : drillStoreRows.map(s => {
                      const fully = isFullyReturned(s);
                      const partial = isPartialReturn(s);
                      const strikeStyle = fully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                      return (
                      <tr key={s.id} style={fully ? { background:'#fafafa' } : {}}>
                        <td className="mono" style={strikeStyle}>{s.sold_at}</td>
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
                        <td>
                          {s.payment && s.payment !== '적립금사용' && (
                            <span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, ...(fully?{opacity:0.5}:{})}}>{s.payment}</span>
                          )}
                          {Number(s.points_used) > 0 && (
                            <div style={{fontSize:10, color:'#6a1b9a', fontWeight:700, marginTop:2, whiteSpace:'nowrap'}}>
                              💳 적립금 -{Number(s.points_used).toLocaleString()}원
                            </div>
                          )}
                        </td>
                        <td style={{whiteSpace:'nowrap', padding:'4px 8px', ...strikeStyle}}>
                          {(!s.delivery_type || s.delivery_type === 'none') && <span style={{fontSize:10, fontWeight:700, color:'#455a64', background:'#eceff1', border:'1px solid #b0bec5', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>매장판매</span>}
                          {s.delivery_type === 'store' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>택배(매장)</span>}
                          {s.delivery_type === 'hq' && s.delivery_status !== 'dispatched' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>택배(본사)</span>}
                          {s.delivery_type === 'hq' && s.delivery_status === 'dispatched' && <span style={{fontSize:10, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>택배(본사)</span>}
                        </td>
                        <td style={{fontSize:11,color:'var(--text2)', ...strikeStyle}}>{s.memo || '-'}</td>
                      </tr>
                    )})
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 트랜잭션(결제묶음) 상세보기 모달 */}
      {drillGroup && (() => {
        const head = drillGroup.rows[0];
        const totalQty = groupQty(drillGroup);
        const totalAmt = groupAmt(drillGroup);
        const ptsUsed  = groupPointsUsed(drillGroup);
        return (
        <div style={{position:'fixed', inset:0, zIndex:310, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}} onClick={() => setDrillGroup(null)}/>
          <div style={{position:'relative', background:'#fff', borderRadius:12, padding:'20px 24px', width:'90vw', maxWidth:1100, maxHeight:'85vh', overflow:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap'}}>
              <span style={{fontSize:14, fontWeight:700, color:'var(--text)'}}>📋 결제 상세</span>
              <span className="badge badge-dept">{head.store_name}</span>
              <span className="badge badge-store">{head.branch_name}</span>
              <span className="mono" style={{fontSize:12, color:'var(--text2)'}}>{head.sold_at}</span>
              <span style={{fontSize:13, color:'var(--text2)', fontWeight:600}}>· 고객 {head.customer?.name || '(비회원)'}</span>
              <span style={{fontSize:13, color:'var(--text2)', fontWeight:600}}>· {drillGroup.rows.length}개 상품</span>
              <button type="button" onClick={() => setDrillGroup(null)}
                style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
            </div>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>브랜드</th><th>상품명</th>
                    <th className="r">수량</th><th className="r">판매가</th><th className="r">합계</th>
                    <th>결제</th><th style={{whiteSpace:'nowrap', minWidth:88}}>출고방식</th><th>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {drillGroup.rows.map(s => {
                    const fully = isFullyReturned(s);
                    const partial = isPartialReturn(s);
                    const strikeStyle = fully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                    return (
                    <tr key={s.id} style={fully ? { background:'#fafafa' } : {}}>
                      <td style={strikeStyle}>{s.brand?.name || '-'}</td>
                      <td style={strikeStyle}>
                        {s.product?.name || '-'}
                        {fully   && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                        {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {s.returned_qty}개</span>}
                      </td>
                      <td className="r" style={strikeStyle}>{effQty(s)}</td>
                      <td className="r" style={strikeStyle}>{Number(s.price).toLocaleString()}</td>
                      <td className="r" style={{fontWeight:600, ...strikeStyle}}>{effAmt(s).toLocaleString()}</td>
                      <td>
                        {s.payment && s.payment !== '적립금사용' && (
                          <span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, ...(fully?{opacity:0.5}:{})}}>{s.payment}</span>
                        )}
                        {Number(s.points_used) > 0 && (
                          <div style={{fontSize:10, color:'#6a1b9a', fontWeight:700, marginTop:2, whiteSpace:'nowrap'}}>
                            💳 적립금 -{Number(s.points_used).toLocaleString()}원
                          </div>
                        )}
                      </td>
                      <td style={{whiteSpace:'nowrap', padding:'4px 8px', ...strikeStyle}}>
                        {(!s.delivery_type || s.delivery_type === 'none') && <span style={{fontSize:10, fontWeight:700, color:'#455a64', background:'#eceff1', border:'1px solid #b0bec5', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>매장판매</span>}
                        {s.delivery_type === 'store' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>택배(매장)</span>}
                        {s.delivery_type === 'hq' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap'}}>택배(본사)</span>}
                      </td>
                      <td style={{fontSize:11,color:'var(--text2)', ...strikeStyle}}>{s.memo || '-'}</td>
                    </tr>
                  )})}
                </tbody>
                <tfoot>
                  <tr style={{background:'#fafafa', fontWeight:700}}>
                    <td colSpan={2} style={{textAlign:'right'}}>합계</td>
                    <td className="r">{totalQty}</td>
                    <td></td>
                    <td className="r" style={{color:'var(--accent)'}}>{totalAmt.toLocaleString()}원</td>
                    <td colSpan={3} style={{fontSize:11, color:'#6a1b9a'}}>
                      {ptsUsed > 0 && <>💳 적립금 -{ptsUsed.toLocaleString()}원</>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )})()}
    </div>
  );
}
