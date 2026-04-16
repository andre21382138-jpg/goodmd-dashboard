import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq } from '../../lib/utils';

export default function SafetyCheckPage({ profile }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStore,  setFStore]  = useState('');
  const [fBranch, setFBranch] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [showShort, setShowShort] = useState(false);
  const [requesting, setRequesting] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const fromDate = oneMonthAgo.toISOString().slice(0,10);

    const { data: salesData } = await supabase.from('sales')
      .select('store_name, branch_name, brand_id, product_id, quantity, brand:brands(name), product:products(name)')
      .gte('sold_at', fromDate);

    const { data: stockData } = await supabase.from('stock_status')
      .select('store_name, branch_name, brand_id, product_id, quantity');

    const { data: orderData } = await supabase.from('order_requests')
      .select('store_name, branch_name, product_id, status')
      .eq('status', 'pending');

    const salesMap = new Map();
    for (const s of (salesData||[])) {
      const key = `${s.store_name}|||${s.branch_name}|||${s.brand_id}|||${s.product_id}`;
      if (!salesMap.has(key)) salesMap.set(key, { ...s, sales: 0 });
      salesMap.get(key).sales += s.quantity;
    }

    const orderSet = new Set();
    for (const o of (orderData||[])) {
      orderSet.add(`${o.store_name}|||${o.branch_name}|||${o.product_id}`);
    }

    const combined = [...salesMap.values()].map(s => {
      const key  = `${s.store_name}|||${s.branch_name}|||${s.brand_id}|||${s.product_id}`;
      const stockRec = (stockData||[]).find(x =>
        `${x.store_name}|||${x.branch_name}|||${x.brand_id}|||${x.product_id}` === key
      );
      const stock = stockRec?.quantity ?? 0;
      const shortage = s.sales - stock;
      const orderKey = `${s.store_name}|||${s.branch_name}|||${s.product_id}`;
      return {
        store: s.store_name, branch: s.branch_name,
        brandName: s.brand?.name || '-', productName: s.product?.name || '-',
        brandId: s.brand_id, productId: s.product_id,
        stockId: stockRec?.id || null,
        safety: s.sales, stock, shortage,
        isPending: orderSet.has(orderKey),
      };
    }).sort((a,b) => b.shortage - a.shortage);

    setRows(combined);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stores   = useMemo(() => uniq(rows.map(r => r.store)),  [rows]);
  const branches = useMemo(() => uniq((fStore ? rows.filter(r => r.store===fStore) : rows).map(r => r.branch)), [rows, fStore]);

  const filtered = useMemo(() => {
    let r = rows;
    if (fStore)  r = r.filter(x => x.store===fStore);
    if (fBranch) r = r.filter(x => x.branch===fBranch);
    if (fSearch) { const q = fSearch.toLowerCase(); r = r.filter(x => x.productName.toLowerCase().includes(q)); }
    if (showShort) r = r.filter(x => x.shortage > 0);
    return r;
  }, [rows, fStore, fBranch, fSearch, showShort]);

  const shortCount = useMemo(() => rows.filter(r => r.shortage > 0).length, [rows]);

  const requestOrder = async (row) => {
    const key = `${row.store}|||${row.branch}|||${row.productId}`;
    setRequesting(p => ({...p, [key]: true}));
    const { error } = await supabase.from('order_requests').insert({
      store_name: row.store, branch_name: row.branch,
      brand_id: row.brandId, product_id: row.productId,
      safety_qty: row.safety, current_qty: row.stock,
      shortage_qty: row.shortage, status: 'pending',
      requested_by: profile?.id,
    });
    if (error) toast(error.message, 'err');
    else { toast(`${row.branch} - ${row.productName} 발주요청 완료`, 'ok'); fetchData(); }
    setRequesting(p => ({...p, [key]: false}));
  };

  return (
    <div>
      {!loading && shortCount > 0 && (
        <div style={{background:'#fff3cd', border:'1px solid #ffc107', borderRadius:'var(--radius)', padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10, fontSize:13, color:'#856404'}}>
          <span>⚠️</span>
          <span>재고 부족 항목 <strong>{shortCount}개</strong> — 안전재고 미달 (최근 1달 판매수량 기준)</span>
          <button className="btn btn-s" style={{marginLeft:'auto', fontSize:11}} onClick={() => setShowShort(v=>!v)}>
            {showShort ? '전체 보기' : '부족 항목만 보기'}
          </button>
        </div>
      )}

      <div className="card" style={{padding:'16px 20px'}}>
        <div className="fbar">
          <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
            <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
          </select>
          <input className="finput" placeholder="상품명 검색" value={fSearch} onChange={e => setFSearch(e.target.value)}/>
          {(fStore||fBranch||fSearch) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); setFSearch(''); }}>✕ 초기화</button>}
          <div className="fbar-right">
            <span className="fresult"><b>{filtered.length}</b>개 항목</span>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>점포</th><th>지점</th><th>브랜드</th><th>상품명</th>
                  <th className="r">안전재고<br/><span style={{fontWeight:400,fontSize:9}}>(1달 판매수량)</span></th>
                  <th className="r">현재재고</th>
                  <th className="r">부족수량</th>
                  <th>발주요청</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={9} className="empty">데이터가 없습니다<br/><span style={{fontSize:11}}>판매 입력 및 재고 등록 후 확인하세요</span></td></tr>
                  : filtered.map((r,i) => {
                    const isShort = r.shortage > 0;
                    const orderKey = `${r.store}|||${r.branch}|||${r.productId}`;
                    return (
                      <tr key={i} style={isShort ? {background:'#fff9f9'} : {}}>
                        <td><span className="badge badge-dept">{r.store}</span></td>
                        <td><span className="badge badge-store">{r.branch}</span></td>
                        <td style={{fontSize:12}}>{r.brandName}</td>
                        <td style={{fontSize:12}}>{r.productName}</td>
                        <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{r.safety.toLocaleString()}</td>
                        <td className="r" style={{fontFamily:'var(--mono)'}}>{r.stock.toLocaleString()}</td>
                        <td className="r">
                          {isShort
                            ? <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--danger)'}}>▼ {r.shortage.toLocaleString()}</span>
                            : <span style={{fontFamily:'var(--mono)', color:'var(--success)'}}>+{Math.abs(r.shortage).toLocaleString()}</span>
                          }
                        </td>
                        <td>
                          {isShort && (
                            r.isPending
                              ? <span style={{fontSize:11, color:'var(--text3)', fontWeight:600}}>요청중</span>
                              : <button className="btn btn-p" style={{padding:'4px 10px', fontSize:11}}
                                  disabled={requesting[orderKey]}
                                  onClick={() => requestOrder(r)}>
                                  {requesting[orderKey] ? <span className="spinner"/> : '발주요청'}
                                </button>
                          )}
                        </td>
                        <td>
                          {r.stockId && (
                            <button className="btn-danger" onClick={async () => {
                              if (!window.confirm(`[${r.store} ${r.branch}] ${r.productName} 재고를 삭제하시겠습니까?`)) return;
                              const { error } = await supabase.from('stock_status').delete().eq('id', r.stockId);
                              if (error) toast(error.message, 'err');
                              else { toast('삭제 완료', 'ok'); fetchData(); }
                            }}>삭제</button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
