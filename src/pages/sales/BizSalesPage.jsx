import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import SalesTabNav from './SalesTabNav';

export default function BizSalesPage({ profile, setPage }) {
  const today = new Date().toISOString().slice(0,10);
  const [tab, setTab] = useState('list'); // 'list' | 'input'

  // 입력 폼 (거래 단위)
  const [soldAt,         setSoldAt]         = useState(today);
  const [companyId,      setCompanyId]      = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState(''); // '용차' | '택배'
  const [memo,           setMemo]           = useState('');
  const [saving,         setSaving]         = useState(false);

  // 상품 라인
  const newLine = () => ({
    id: Date.now()+Math.random(),
    productId:'', productSearch:'', showSuggestions:false,
    brandId:'', quantity:1, supplyPrice:'',
  });
  const [lines, setLines] = useState([newLine()]);

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

  // 라인 헬퍼
  const updateLine = (id, field, value) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      if (field === 'productId') {
        const prod = allProds.find(p => String(p.id) === String(value));
        if (prod) {
          updated.brandId = String(prod.brand_id || '');
          if (!updated.supplyPrice) updated.supplyPrice = String(prod.price || '');
        }
        updated.showSuggestions = false;
      }
      return updated;
    }));
  };
  const addLine = () => setLines(prev => [...prev, newLine()]);
  const removeLine = (id) => setLines(prev => {
    if (prev.length <= 1) return [newLine()];
    return prev.filter(l => l.id !== id);
  });
  const selectProdForLine = (lineId, p) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        productId: String(p.id),
        productSearch: p.name,
        brandId: String(p.brand_id || ''),
        supplyPrice: l.supplyPrice || String(p.price || ''),
        showSuggestions: false,
      };
    }));
  };

  const handleAddCompany = async () => {
    const raw = window.prompt('새 업체 이름을 입력하세요:');
    if (!raw) return;
    const name = raw.trim();
    if (!name) return;
    if (companies.some(c => c.name === name)) {
      const exist = companies.find(c => c.name === name);
      toast(`'${name}' 업체는 이미 등록되어 있습니다`, 'err');
      if (exist) setCompanyId(String(exist.id));
      return;
    }
    const { data, error } = await supabase.from('biz_companies')
      .insert({ name })
      .select()
      .single();
    if (error) { toast(error.message, 'err'); return; }
    toast(`'${name}' 추가 완료`, 'ok');
    setCompanies(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setCompanyId(String(data.id));
  };

  const handleSubmit = async () => {
    if (!companyId) { toast('업체를 선택해주세요', 'err'); return; }
    if (!deliveryMethod) { toast('배송방법을 선택해주세요', 'err'); return; }
    const validLines = lines.filter(l =>
      l.productId && Number(l.supplyPrice) > 0 && Number(l.quantity) > 0
    );
    if (validLines.length === 0) { toast('상품을 1개 이상 입력해주세요', 'err'); return; }
    const company = companies.find(c => String(c.id) === String(companyId));
    setSaving(true);
    try {
      for (const l of validLines) {
        const prod  = allProds.find(p => String(p.id) === String(l.productId));
        const brand = brands.find(b => String(b.id) === String(l.brandId));
        const { error } = await supabase.from('biz_sales').insert({
          sold_at: soldAt,
          company_id: Number(companyId), company_name: company?.name,
          brand_id: Number(l.brandId)||null, brand_name: brand?.name,
          product_id: Number(l.productId), product_name: prod?.name,
          quantity: Number(l.quantity)||1,
          supply_price: Number(l.supplyPrice)||0,
          memo: memo.trim()||null,
          delivery_method: deliveryMethod,
          created_by: profile.id,
        });
        if (error) throw error;
      }
      toast(`특판 매출 ${validLines.length}건 등록 완료`, 'ok');
      setCompanyId(''); setDeliveryMethod(''); setMemo(''); setSoldAt(today);
      setLines([newLine()]);
      if (tab === 'list') fetchSales();
    } catch (err) {
      toast('저장 실패: ' + (err.message || err), 'err');
    }
    setSaving(false);
  };

  // 입력 합계
  const totalAmt = lines.reduce((s,l) => s + (Number(l.quantity)||0) * (Number(l.supplyPrice)||0), 0);
  const totalQty = lines.reduce((s,l) => s + (Number(l.quantity)||0), 0);

  // 조회 합계
  const listTotalAmt = sales.reduce((s,r) => s + (r.supply_price||0) * (r.quantity||0), 0);
  const listTotalQty = sales.reduce((s,r) => s + (r.quantity||0), 0);

  const inputStyle = {height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none', width:'100%'};
  const labelStyle = {display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4};
  const GRID_COLS = 'minmax(220px, 1fr) 80px 130px 130px 80px 36px';

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

          {/* 거래 단위 정보 */}
          <div style={{display:'grid', gridTemplateColumns:'150px 1fr 230px', gap:12, marginBottom:14}}>
            <div>
              <label style={labelStyle}>매출일 <span style={{color:'var(--danger)'}}>*</span></label>
              <input type="date" value={soldAt} onChange={e=>setSoldAt(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>업체 <span style={{color:'var(--danger)'}}>*</span></label>
              <div style={{display:'flex', gap:6}}>
                <select value={companyId} onChange={e=>setCompanyId(e.target.value)} style={{...inputStyle, flex:1}}>
                  <option value="">-- 업체 선택 --</option>
                  {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={handleAddCompany}
                  title="신규업체 추가"
                  style={{height:36, padding:'0 12px', border:'1px solid var(--accent)', background:'#fff3e0', color:'var(--accent)', borderRadius:'var(--radius)', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>
                  + 신규
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>배송방법 <span style={{color:'var(--danger)'}}>*</span></label>
              <div style={{display:'flex', gap:6}}>
                {[{key:'용차', label:'🚚 용차'}, {key:'택배', label:'📦 택배'}].map(m => {
                  const active = deliveryMethod === m.key;
                  return (
                    <button key={m.key} type="button" onClick={() => setDeliveryMethod(m.key)}
                      style={{flex:1, height:36, border:'1px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                        background:  active ? '#fff3e0' : '#fff',
                        color:       active ? 'var(--accent)' : 'var(--text2)'}}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 상품 라인 */}
          <div className="card-label" style={{marginTop:4}}>🛍️ 상품 목록</div>

          {/* 헤더 라벨 */}
          <div style={{ display:'grid', gridTemplateColumns:GRID_COLS, gap:6, padding:'0 4px 6px', fontSize:11, fontWeight:700, color:'var(--text3)' }}>
            <div>상품검색</div>
            <div style={{textAlign:'center'}}>수량</div>
            <div style={{textAlign:'center'}}>공급가</div>
            <div style={{textAlign:'right'}}>합계</div>
            <div></div>
            <div></div>
          </div>

          {lines.map((l, idx) => {
            const suggestions = l.productSearch && l.productSearch.length >= 1
              ? allProds
                  .filter(p => {
                    const q = l.productSearch.toLowerCase();
                    return (p.name || '').toLowerCase().includes(q)
                        || (p.code || '').toLowerCase().includes(q)
                        || (p.erp_code || '').toLowerCase().includes(q);
                  })
                  .sort((a,b) => (a.name.includes('[단종]')?1:0) - (b.name.includes('[단종]')?1:0))
                  .slice(0, 10)
              : [];
            const selProd = allProds.find(p => String(p.id) === String(l.productId));
            const lineSubtotal = (Number(l.quantity)||0) * (Number(l.supplyPrice)||0);
            const isLast = idx === lines.length - 1;

            return (
              <div key={l.id} style={{ background: idx%2===0?'#fafafa':'#f0f7ff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 8px', marginBottom:6 }}>
                <div style={{ display:'grid', gridTemplateColumns:GRID_COLS, gap:6, alignItems:'center' }}>
                  {/* 상품검색 */}
                  <div style={{ position:'relative' }}>
                    <input
                      value={l.productSearch !== undefined ? l.productSearch : (selProd?.name || '')}
                      onChange={e => {
                        updateLine(l.id,'productSearch',e.target.value);
                        updateLine(l.id,'productId','');
                        updateLine(l.id,'showSuggestions',true);
                      }}
                      onFocus={() => updateLine(l.id,'showSuggestions',true)}
                      onBlur={() => setTimeout(() => updateLine(l.id,'showSuggestions',false), 200)}
                      style={{...inputStyle, height:38, background:'#fff'}}
                      placeholder="상품명 / 상품코드 / ERP 검색"
                      autoComplete="off"
                    />
                    {l.showSuggestions && suggestions.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:220, overflowY:'auto', marginTop:2 }}>
                        {suggestions.map(p => {
                          const brand = brands.find(b => b.id === p.brand_id);
                          return (
                            <div key={p.id}
                              onMouseDown={e => { e.preventDefault(); selectProdForLine(l.id, p); }}
                              style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0' }}
                              onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                              onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                              <div style={{display:'flex', alignItems:'center'}}>
                                {brand && <span style={{fontSize:11, color:'var(--accent)', fontWeight:700, marginRight:6}}>[{brand.name}]</span>}
                                <span>{p.name}</span>
                                <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto', fontFamily:'var(--mono)' }}>{Number(p.price).toLocaleString()}원</span>
                              </div>
                              {(p.code || p.erp_code) && (
                                <div style={{display:'flex', gap:10, marginTop:3, fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)'}}>
                                  {p.code && <span>상품코드: <strong style={{color:'var(--text2)'}}>{p.code}</strong></span>}
                                  {p.erp_code && <span>ERP: <strong style={{color:'var(--text2)'}}>{p.erp_code}</strong></span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* 수량 */}
                  <input type="number" min={1} value={l.quantity}
                    onChange={e => updateLine(l.id,'quantity',e.target.value)}
                    style={{...inputStyle, height:38, textAlign:'center'}} required />
                  {/* 공급가 */}
                  <input type="number" min={0} value={l.supplyPrice}
                    onChange={e => updateLine(l.id,'supplyPrice',e.target.value)}
                    style={{...inputStyle, height:38, textAlign:'right', fontWeight:700, color:'var(--accent)'}}
                    placeholder="0" required />
                  {/* 합계 */}
                  <div style={{textAlign:'right', fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:'var(--accent)'}}>
                    {lineSubtotal > 0 ? lineSubtotal.toLocaleString()+'원' : '-'}
                  </div>
                  {/* 상품추가 (마지막 라인에만) */}
                  {isLast ? (
                    <button type="button" onClick={addLine}
                      title="상품 추가"
                      style={{ height:38, width:'100%', border:'1px solid var(--accent)', background:'#fff3e0', color:'var(--accent)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:12, fontWeight:700, lineHeight:1, padding:0, whiteSpace:'nowrap' }}>상품추가</button>
                  ) : <div/>}
                  {/* ✕ 삭제 / 초기화 */}
                  <button type="button" onClick={() => removeLine(l.id)}
                    title={lines.length > 1 ? '삭제' : '초기화'}
                    style={{ height:38, width:36, border:'1px solid var(--border)', background:'#fff', color:'var(--danger)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>✕</button>
                </div>
                {/* 상품코드 / ERP 표시 */}
                {selProd && (selProd.code || selProd.erp_code) && (
                  <div style={{marginTop:6, fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', display:'flex', gap:12}}>
                    {selProd.code && <span>상품코드: <strong style={{color:'var(--text2)'}}>{selProd.code}</strong></span>}
                    {selProd.erp_code && <span>ERP: <strong style={{color:'var(--text2)'}}>{selProd.erp_code}</strong></span>}
                  </div>
                )}
              </div>
            );
          })}

          {/* 합계 */}
          {totalAmt > 0 && (
            <div style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', textAlign:'right', fontSize:14, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:6 }}>
              총 합계: {totalAmt.toLocaleString()}원 ({lines.filter(l => l.productId).length}개 상품 / 총 {totalQty}개)
            </div>
          )}

          {/* 메모 */}
          <div style={{marginTop:14, marginBottom:12}}>
            <label style={labelStyle}>메모</label>
            <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모 (선택)" style={inputStyle}/>
          </div>

          <button className="btn btn-p" onClick={handleSubmit} disabled={saving}
            style={{width:'100%', height:40, fontSize:14, justifyContent:'center'}}>
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
              <div style={{fontSize:18, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{listTotalAmt.toLocaleString()}원</div>
            </div>
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : sales.length===0 ? (
            <div className="empty">데이터가 없습니다</div>
          ) : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>날짜</th><th>업체</th><th>브랜드</th><th>상품명</th><th className="r">수량</th><th className="r">공급가</th><th className="r">합계</th><th style={{width:80}}>배송</th><th>메모</th></tr>
                </thead>
                <tbody>
                  {sales.map(s=>(
                    <tr key={s.id}>
                      <td className="mono" style={{fontSize:12}}>{s.sold_at}</td>
                      <td style={{fontWeight:600}}>{s.company?.name||s.company_name}</td>
                      <td><span className="badge badge-dept">{s.brand?.name||s.brand_name||'-'}</span></td>
                      <td style={{fontSize:13}}>{s.product?.name||s.product_name}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{s.quantity}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{(s.supply_price||0).toLocaleString()}원</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{((s.supply_price||0)*(s.quantity||0)).toLocaleString()}원</td>
                      <td style={{fontSize:11}}>
                        {s.delivery_method === '용차' ? '🚚 용차'
                          : s.delivery_method === '택배' ? '📦 택배'
                          : '-'}
                      </td>
                      <td style={{fontSize:11, color:'var(--text2)'}}>{s.memo||'-'}</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)', borderTop:'2px solid var(--border2)'}}>
                    <td colSpan={4} style={{padding:'10px 11px', fontWeight:700}}>합계</td>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, padding:'10px 11px'}}>{listTotalQty}</td>
                    <td/>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--accent)', padding:'10px 11px'}}>{listTotalAmt.toLocaleString()}원</td>
                    <td/>
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
