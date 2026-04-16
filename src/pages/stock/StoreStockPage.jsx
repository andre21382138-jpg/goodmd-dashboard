import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function StoreStockPage({ profile }) {
  const isManager  = profile?.job_title === '매니저';
  const [stocks,   setStocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [fStore,   setFStore]   = useState(isManager ? (profile?.department||'') : '');
  const [fBranch,  setFBranch]  = useState(isManager ? (profile?.branch||'') : '');
  const [fSearch,  setFSearch]  = useState('');
  const [stores,   setStores]   = useState([]);
  const [branches, setBranches] = useState([]);
  const [editing,  setEditing]  = useState({});
  const [saving,   setSaving]   = useState({});

  useEffect(() => {
    supabase.from('store_stock').select('store_name').then(({data}) => {
      const s = [...new Set((data||[]).map(r=>r.store_name).filter(Boolean))].sort();
      setStores(s);
    });
  }, []);

  useEffect(() => {
    if (!fStore) { setBranches([]); return; }
    supabase.from('store_stock').select('branch_name').eq('store_name', fStore).then(({data}) => {
      const b = [...new Set((data||[]).map(r=>r.branch_name).filter(Boolean))].sort();
      setBranches(b);
    });
  }, [fStore]);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('store_stock').select('*').order('store_name').order('branch_name').order('product_name');
    if (fStore)  q = q.eq('store_name',  fStore);
    if (fBranch) q = q.eq('branch_name', fBranch);
    const { data } = await q;
    setStocks(data || []);
    setLoading(false);
  }, [fStore, fBranch]);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  const filtered = useMemo(() => {
    if (!fSearch.trim()) return stocks;
    const kw = fSearch.trim().toLowerCase();
    return stocks.filter(s =>
      (s.product_name||'').toLowerCase().includes(kw) ||
      (s.product_code||'').toLowerCase().includes(kw)
    );
  }, [stocks, fSearch]);

  const totalQty = useMemo(() => filtered.reduce((s,r) => s+(r.stock_qty||0), 0), [filtered]);

  const startEdit  = (id, qty) => setEditing(p => ({...p, [id]: qty}));
  const cancelEdit = (id) => setEditing(p => { const n={...p}; delete n[id]; return n; });
  const saveEdit   = async (id) => {
    setSaving(p => ({...p, [id]: true}));
    const qty = Number(editing[id]) || 0;
    const { error } = await supabase.from('store_stock')
      .update({ stock_qty: qty, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('재고 수정 완료', 'ok'); cancelEdit(id); fetchStocks(); }
    setSaving(p => ({...p, [id]: false}));
  };

  const handleStoreChange = (val) => { setFStore(val); setFBranch(''); };

  return (
    <div>
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'14px 20px', borderBottom:'1px solid var(--border)', flexWrap:'wrap'}}>
          {!isManager && (
            <>
              <select className="fsel" value={fStore} onChange={e=>handleStoreChange(e.target.value)}>
                <option value="">전체 점포</option>
                {stores.map(s=><option key={s}>{s}</option>)}
              </select>
              <select className="fsel" value={fBranch} onChange={e=>setFBranch(e.target.value)}
                disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
                <option value="">전체 지점</option>
                {branches.map(b=><option key={b}>{b}</option>)}
              </select>
            </>
          )}
          <input className="finput" value={fSearch} onChange={e=>setFSearch(e.target.value)}
            placeholder="🔍 상품명·상품코드 검색" style={{height:34, minWidth:200}}/>
          {(fStore||fBranch||fSearch) && !isManager &&
            <button className="btn-ghost" onClick={()=>{setFStore('');setFBranch('');setFSearch('');}}>✕ 초기화</button>}
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:16}}>
            <span className="fresult">
              <b>{filtered.length.toLocaleString()}</b>개 상품 · 총 재고 <b>{totalQty.toLocaleString()}</b>개
            </span>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : filtered.length === 0 ? (
          <div className="empty">재고 데이터가 없습니다</div>
        ) : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>점포</th><th>지점</th><th>상품코드</th><th>상품명</th>
                  <th className="r">재고수량</th>
                  {!isManager && <th style={{width:120, textAlign:'center'}}>수정</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isEditing = editing[s.id] !== undefined;
                  const isLow = (s.stock_qty||0) <= 5;
                  return (
                    <tr key={s.id} style={{background: isEditing ? '#fffde7' : ''}}>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{s.product_code||'-'}</td>
                      <td style={{fontSize:13}}>{s.product_name}</td>
                      <td className="r">
                        {isEditing ? (
                          <input type="number" min={0} value={editing[s.id]}
                            onChange={e=>setEditing(p=>({...p,[s.id]:e.target.value}))}
                            style={{width:70, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:13, textAlign:'right', outline:'none'}}/>
                        ) : (
                          <span style={{fontFamily:'var(--mono)', fontWeight:700,
                            color: (s.stock_qty||0) === 0 ? 'var(--danger)' : isLow ? 'var(--accent)' : 'var(--text)'}}>
                            {(s.stock_qty||0).toLocaleString()}
                            {(s.stock_qty||0) === 0 && <span style={{fontSize:10, marginLeft:4}}>품절</span>}
                            {isLow && (s.stock_qty||0) > 0 && <span style={{fontSize:10, marginLeft:4}}>⚠️</span>}
                          </span>
                        )}
                      </td>
                      {!isManager && (
                        <td style={{textAlign:'center'}}>
                          {isEditing ? (
                            <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                              <button className="btn btn-p" style={{height:26,padding:'0 10px',fontSize:11}}
                                disabled={saving[s.id]} onClick={()=>saveEdit(s.id)}>
                                {saving[s.id]?<span className="spinner"/>:'저장'}
                              </button>
                              <button className="btn btn-s" style={{height:26,padding:'0 8px',fontSize:11}}
                                onClick={()=>cancelEdit(s.id)}>취소</button>
                            </div>
                          ) : (
                            <button className="btn btn-s" style={{height:26,padding:'0 10px',fontSize:11}}
                              onClick={()=>startEdit(s.id, s.stock_qty||0)}>수정</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
