import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function StockRequestPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [brands,      setBrands]     = useState([]);
  const [allProducts, setAllProducts]= useState([]);
  const [requests,    setRequests]   = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [saving,      setSaving]     = useState(false);

  const [reqDate,   setReqDate]   = useState(today);
  const [brandId,   setBrandId]   = useState('');
  const [prodSearch,setProdSearch]= useState('');
  const [prodId,    setProdId]    = useState('');
  const [prodName,  setProdName]  = useState('');
  const [quantity,  setQty]       = useState(1);
  const [memo,      setMemo]      = useState('');
  const [showSugg,  setShowSugg]  = useState(false);

  const filteredProds = prodSearch.trim()
    ? allProducts.filter(p =>
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) &&
        (!brandId || String(p.brand_id) === String(brandId))
      ).sort((a,b) => (a.name.includes('[단종]')?1:0)-(b.name.includes('[단종]')?1:0)).slice(0, 10)
    : [];

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
    supabase.from('products').select('*').order('name').then(({ data }) => setAllProducts(data || []));
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('order_requests')
      .select('*, brand:brands(name), product:products(name)')
      .eq('store_name', profile.department)
      .eq('branch_name', profile.branch)
      .order('created_at', { ascending: false })
      .limit(30);
    setRequests(data || []);
    setLoading(false);
  }, [profile.department, profile.branch]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleBrandChange = (bid) => {
    setBrandId(bid); setProdSearch(''); setProdId(''); setProdName(''); setShowSugg(false);
  };

  const handleSelectProd = (p) => {
    setProdId(p.id); setProdName(p.name); setProdSearch(p.name);
    if (!brandId) setBrandId(String(p.brand_id));
    setShowSugg(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prodId) { toast('상품을 선택해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('order_requests').insert({
      store_name:  profile.department,
      branch_name: profile.branch,
      brand_id:    Number(brandId),
      product_id:  Number(prodId),
      quantity:    Number(quantity),
      memo:        memo.trim() || null,
      status:      'pending',
      created_by:  profile.id,
      request_date: reqDate,
    });
    if (error) toast(error.message, 'err');
    else {
      toast('재고 요청 완료', 'ok');
      setProdSearch(''); setProdId(''); setProdName(''); setQty(1); setMemo('');
      fetchRequests();
    }
    setSaving(false);
  };

  const inputStyle = { width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="card">
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:12, marginBottom:12 }}>
            <div>
              <label style={labelStyle}>요청일</label>
              <input type="date" value={reqDate} onChange={e => setReqDate(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>브랜드</label>
              <select value={brandId} onChange={e => handleBrandChange(e.target.value)} style={inputStyle}>
                <option value="">전체 브랜드</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:12, marginBottom:12 }}>
            <div style={{ position:'relative' }}>
              <label style={labelStyle}>상품 검색</label>
              <input
                value={prodSearch}
                onChange={e => { setProdSearch(e.target.value); setProdId(''); setProdName(''); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)}
                style={{ ...inputStyle }}
                placeholder="상품명 키워드 입력"
                autoComplete="off"
              />
              {prodId && (
                <div style={{ marginTop:4, fontSize:12, color:'var(--success)', fontWeight:600 }}>✅ {prodName}</div>
              )}
              {showSugg && filteredProds.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto' }}>
                  {filteredProds.map(p => {
                    const br = brands.find(b => b.id === p.brand_id);
                    return (
                      <div key={p.id}
                        onMouseDown={e => { e.preventDefault(); handleSelectProd(p); }}
                        style={{ padding:'9px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0' }}
                        onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                        onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                        {!brandId && br && <span style={{fontSize:11, color:'var(--accent)', fontWeight:700, marginRight:6}}>[{br.name}]</span>}
                        {p.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>수량</label>
              <input type="number" min={1} value={quantity} onChange={e => setQty(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>메모 (선택)</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} style={inputStyle} placeholder="요청 사유 또는 특이사항" />
          </div>

          <button className="btn btn-p" type="submit" disabled={saving || !prodId}
            style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> : '📦 재고 요청'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-label">요청 이력</div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>요청일</th><th>브랜드</th><th>상품명</th><th className="r">수량</th><th>메모</th><th>상태</th><th>등록일시</th></tr>
              </thead>
              <tbody>
                {requests.length === 0
                  ? <tr><td colSpan={7} className="empty">요청 내역이 없습니다</td></tr>
                  : requests.map(r => (
                    <tr key={r.id}>
                      <td className="mono">{r.request_date || '-'}</td>
                      <td><span className="badge badge-dept">{r.brand?.name || '-'}</span></td>
                      <td style={{fontSize:12}}>{r.product?.name || '-'}</td>
                      <td className="r" style={{fontWeight:700, color:'var(--accent)'}}>{r.quantity}</td>
                      <td style={{fontSize:11, color:'var(--text3)'}}>{r.memo || '-'}</td>
                      <td>
                        <span style={{
                          padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                          background: r.status==='approved'?'#e8f5e9':r.status==='rejected'?'#ffebee':'#fff3e0',
                          color: r.status==='approved'?'var(--success)':r.status==='rejected'?'var(--danger)':'#E65100',
                        }}>
                          {r.status==='approved'?'승인':r.status==='rejected'?'반려':'대기'}
                        </span>
                      </td>
                      <td className="mono" style={{fontSize:11}}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
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
