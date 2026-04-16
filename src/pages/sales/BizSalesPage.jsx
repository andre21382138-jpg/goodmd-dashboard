import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import SalesTabNav from './SalesTabNav';

export default function BizSalesPage({ profile, setPage }) {
  const today = new Date().toISOString().slice(0,10);
  const [tab, setTab] = useState('list'); // 'list' | 'input'

  // 입력 폼
  const [soldAt,     setSoldAt]    = useState(today);
  const [companyId,  setCompanyId] = useState('');
  const [brandId,    setBrandId]   = useState('');
  const [productId,  setProductId] = useState('');
  const [productSearch, setPSearch]= useState('');
  const [showSug,    setShowSug]   = useState(false);
  const [quantity,   setQuantity]  = useState(1);
  const [supplyPrice,setSupplyPrice]=useState('');
  const [memo,       setMemo]      = useState('');
  const [saving,     setSaving]    = useState(false);

  // 데이터
  const [companies, setCompanies] = useState([]);
  const [brands,    setBrands]    = useState([]);
  const [allProds,  setAllProds]  = useState([]);
  const [sales,     setSales]     = useState([]);
  const [loading,   setLoading]   = useState(false);

  // 조회 필터
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const curMonStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  const months = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  });
  const [fMonth,  setFMonth]  = useState(curMonStr);
  const [fCompany,setFCompany]= useState('');

  useEffect(() => {
    supabase.from('biz_companies').select('*').order('name').then(({data}) => setCompanies(data||[]));
    supabase.from('brands').select('*').order('name').then(({data}) => setBrands(data||[]));
    supabase.from('products').select('*').order('name').then(({data}) => setAllProds(data||[]));
  }, []);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const from = `${fMonth}-01`;
    const lastDay = new Date(fMonth.split('-')[0], fMonth.split('-')[1], 0).getDate();
    const to = `${fMonth}-${pad(lastDay)}`;
    let q = supabase.from('biz_sales')
      .select('*, company:biz_companies(name), brand:brands(name), product:products(name)')
      .gte('sold_at', from).lte('sold_at', to)
      .order('sold_at', {ascending:false});
    if (fCompany) q = q.eq('company_id', fCompany);
    const {data} = await q;
    setSales(data||[]);
    setLoading(false);
  }, [fMonth, fCompany]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab==='list') fetchSales(); }, [fetchSales, tab]);

  // 상품 자동완성
  const prodPool = brandId ? allProds.filter(p=>String(p.brand_id)===String(brandId)) : allProds;
  const suggestions = productSearch
    ? prodPool.filter(p=>p.name.toLowerCase().includes(productSearch.toLowerCase()))
        .sort((a,b)=>(a.name.includes('[단종]')?1:0)-(b.name.includes('[단종]')?1:0))
        .slice(0,10)
    : [];
  const selProd = allProds.find(p=>String(p.id)===String(productId));

  const selectProd = (p) => {
    setProductId(String(p.id));
    setPSearch(p.name);
    if (!brandId) setBrandId(String(p.brand_id));
    if (!supplyPrice) setSupplyPrice(String(p.price||''));
    setShowSug(false);
  };

  const handleSubmit = async () => {
    if (!companyId) { toast('업체를 선택해주세요', 'err'); return; }
    if (!productId) { toast('상품을 선택해주세요', 'err'); return; }
    if (!supplyPrice || Number(supplyPrice)<=0) { toast('공급가를 입력해주세요', 'err'); return; }
    const company = companies.find(c=>String(c.id)===String(companyId));
    const brand   = brands.find(b=>String(b.id)===String(brandId));
    setSaving(true);
    const {error} = await supabase.from('biz_sales').insert({
      sold_at: soldAt,
      company_id: Number(companyId), company_name: company?.name,
      brand_id: Number(brandId)||null, brand_name: brand?.name,
      product_id: Number(productId), product_name: selProd?.name,
      quantity: Number(quantity)||1,
      supply_price: Number(supplyPrice)||0,
      memo: memo.trim()||null,
      created_by: profile.id,
    });
    setSaving(false);
    if (error) { toast(error.message,'err'); return; }
    toast('특판 매출 등록 완료','ok');
    setCompanyId(''); setBrandId(''); setProductId(''); setPSearch('');
    setQuantity(1); setSupplyPrice(''); setMemo('');
    setSoldAt(today);
  };

  const totalAmt = sales.reduce((s,r)=>s+r.supply_price*r.quantity,0);
  const totalQty = sales.reduce((s,r)=>s+r.quantity,0);

  const inputStyle = {height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none', width:'100%'};
  const labelStyle = {display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4};

  return (
    <div>
      {setPage && <SalesTabNav current="biz_sales_view" setPage={setPage}/>}
      {/* 탭 */}
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[{key:'list',label:'📋 특판 매출 조회'},{key:'input',label:'➕ 매출 입력'}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{height:36, padding:'0 18px', border:'2px solid', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer',
              borderColor: tab===t.key?'var(--accent)':'var(--border)',
              background:  tab===t.key?'#fff3e0':'#fff',
              color:       tab===t.key?'var(--accent)':'var(--text2)'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 매출 입력 탭 */}
      {tab==='input' && (
        <div className="card">
          <div className="card-label">특판 매출 입력</div>
          <div style={{display:'grid', gridTemplateColumns:'150px 1fr 1fr', gap:12, marginBottom:12}}>
            <div>
              <label style={labelStyle}>매출일 <span style={{color:'var(--danger)'}}>*</span></label>
              <input type="date" value={soldAt} onChange={e=>setSoldAt(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>업체 <span style={{color:'var(--danger)'}}>*</span></label>
              <select value={companyId} onChange={e=>setCompanyId(e.target.value)} style={inputStyle}>
                <option value="">-- 업체 선택 --</option>
                {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>브랜드</label>
              <select value={brandId} onChange={e=>setBrandId(e.target.value)} style={inputStyle}>
                <option value="">전체 브랜드</option>
                {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 120px 150px', gap:12, marginBottom:12}}>
            <div style={{position:'relative'}}>
              <label style={labelStyle}>상품 <span style={{color:'var(--danger)'}}>*</span></label>
              <input value={productSearch} onChange={e=>{setPSearch(e.target.value);setProductId('');setShowSug(true);}}
                onFocus={()=>setShowSug(true)}
                placeholder="상품명 검색"
                style={{...inputStyle, background:'#fff'}} autoComplete="off"/>
              {selProd && <div style={{marginTop:4,fontSize:12,color:'var(--success)',fontWeight:600}}>✅ {selProd.name}</div>}
              {showSug && suggestions.length>0 && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:200,background:'#fff',border:'1px solid var(--border)',borderRadius:'var(--radius)',boxShadow:'0 4px 16px rgba(0,0,0,0.12)',maxHeight:220,overflowY:'auto'}}>
                  {suggestions.map(p=>{
                    const br = brands.find(b=>b.id===p.brand_id);
                    return (
                      <div key={p.id} onMouseDown={e=>{e.preventDefault();selectProd(p);}}
                        style={{padding:'9px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid #f0f0f0'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#fffde7'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                        {!brandId && br && <span style={{fontSize:11,color:'var(--accent)',fontWeight:700,marginRight:6}}>[{br.name}]</span>}
                        {p.name}
                        <span style={{fontSize:11,color:'var(--text3)',marginLeft:8,fontFamily:'var(--mono)'}}>{Number(p.price).toLocaleString()}원</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>수량 <span style={{color:'var(--danger)'}}>*</span></label>
              <input type="number" min={1} value={quantity} onChange={e=>setQuantity(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>공급가 (원) <span style={{color:'var(--danger)'}}>*</span></label>
              <input type="number" min={0} value={supplyPrice} onChange={e=>setSupplyPrice(e.target.value)}
                placeholder="0" style={{...inputStyle, fontWeight:700, color:'var(--accent)'}}/>
            </div>
          </div>
          {quantity && supplyPrice && (
            <div style={{textAlign:'right', fontSize:13, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', marginBottom:12}}>
              합계: {(Number(quantity)*Number(supplyPrice)).toLocaleString()}원
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>메모</label>
            <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모 (선택)" style={inputStyle}/>
          </div>
          <button className="btn btn-p" onClick={handleSubmit} disabled={saving} style={{width:'100%', height:40, fontSize:14, justifyContent:'center'}}>
            {saving ? <span className="spinner"/> : '✅ 특판 매출 등록'}
          </button>
        </div>
      )}

      {/* 매출 조회 탭 */}
      {tab==='list' && (
        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, padding:'14px 20px', borderBottom:'1px solid var(--border)', flexWrap:'wrap'}}>
            <select value={fMonth} onChange={e=>setFMonth(e.target.value)}
              style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
              {months.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <select value={fCompany} onChange={e=>setFCompany(e.target.value)}
              style={{height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}>
              <option value="">전체 업체</option>
              {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {fCompany && <button className="btn-ghost" onClick={()=>setFCompany('')}>✕</button>}
            <div style={{marginLeft:'auto', textAlign:'right'}}>
              <div style={{fontSize:11, color:'var(--text3)'}}>총 매출</div>
              <div style={{fontSize:18, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{totalAmt.toLocaleString()}원</div>
            </div>
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : sales.length===0 ? (
            <div className="empty">데이터가 없습니다</div>
          ) : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>날짜</th><th>업체</th><th>브랜드</th><th>상품명</th><th className="r">수량</th><th className="r">공급가</th><th className="r">합계</th><th>메모</th></tr>
                </thead>
                <tbody>
                  {sales.map(s=>(
                    <tr key={s.id}>
                      <td className="mono" style={{fontSize:12}}>{s.sold_at}</td>
                      <td style={{fontWeight:600}}>{s.company?.name||s.company_name}</td>
                      <td><span className="badge badge-dept">{s.brand?.name||s.brand_name||'-'}</span></td>
                      <td style={{fontSize:13}}>{s.product?.name||s.product_name}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{s.quantity}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{s.supply_price.toLocaleString()}원</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{(s.supply_price*s.quantity).toLocaleString()}원</td>
                      <td style={{fontSize:11, color:'var(--text2)'}}>{s.memo||'-'}</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)', borderTop:'2px solid var(--border2)'}}>
                    <td colSpan={4} style={{padding:'10px 11px', fontWeight:700}}>합계</td>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, padding:'10px 11px'}}>{totalQty}</td>
                    <td/>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)', padding:'10px 11px'}}>{totalAmt.toLocaleString()}원</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
