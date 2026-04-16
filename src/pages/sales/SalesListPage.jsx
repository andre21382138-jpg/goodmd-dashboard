import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq } from '../../lib/utils';
import SalesTabNav from './SalesTabNav';

export default function SalesListPage({ setPage }) {
  const [sales,   setSales]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStore,  setFStore]  = useState('');
  const [fBrand,  setFBrand]  = useState('');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');
  const [fKeyword,setFKeyword]= useState('');
  const [sortBy,  setSortBy]  = useState('date'); // 'date' | 'qty_desc' | 'amt_desc'

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

  // 키워드 필터 + 정렬 (클라이언트 사이드)
  const filtered = useMemo(() => {
    let result = sales;
    if (fKeyword.trim()) {
      const kw = fKeyword.trim().toLowerCase();
      result = result.filter(s =>
        (s.product?.name || '').toLowerCase().includes(kw) ||
        (s.brand?.name   || '').toLowerCase().includes(kw) ||
        (s.memo          || '').toLowerCase().includes(kw)
      );
    }
    if (sortBy === 'qty_desc') result = [...result].sort((a,b) => b.quantity - a.quantity);
    if (sortBy === 'amt_desc') result = [...result].sort((a,b) => (b.price*b.quantity) - (a.price*a.quantity));
    return result;
  }, [sales, fKeyword, sortBy]);

  const totalQty = useMemo(() => filtered.reduce((s, r) => s + r.quantity, 0), [filtered]);
  const totalAmt = useMemo(() => filtered.reduce((s, r) => s + r.price * r.quantity, 0), [filtered]);

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
        <div className="card-label">판매내역 조회</div>
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
          <select className="fsel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">최신순</option>
            <option value="qty_desc">판매건수 높은순</option>
            <option value="amt_desc">매출액 높은순</option>
          </select>
          {(fStore||fBrand||fFrom||fTo||fKeyword) &&
            <button className="btn-ghost" onClick={() => { setFStore(''); setFBrand(''); setFFrom(''); setFTo(''); setFKeyword(''); setSortBy('date'); }}>✕ 초기화</button>}
          <div className="fbar-right">
            <span className="fresult"><b>{filtered.length.toLocaleString()}</b>건 · <b>{totalQty.toLocaleString()}</b>개 · <b>{totalAmt.toLocaleString()}</b>원</span>
          </div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
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
                  : filtered.map(s => (
                    <tr key={s.id}>
                      <td className="mono">{s.sold_at}</td>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td style={{fontSize:12}}>{s.seller?.name || '-'}</td>
                      <td>{s.brand?.name || '-'}</td>
                      <td>{s.product?.name || '-'}</td>
                      <td className="r">{s.quantity}</td>
                      <td className="r">{Number(s.price).toLocaleString()}</td>
                      <td className="r" style={{fontWeight:600}}>{(s.price * s.quantity).toLocaleString()}</td>
                      <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>{s.payment}</span></td>
                      <td style={{fontSize:11,color:'var(--text2)'}}>{s.memo || '-'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
