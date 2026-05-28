import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function ProductMgmtPage({ subPage }) {
  const [products, setProducts] = useState([]);
  const [brands,   setBrands]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selBrand,  setSelBrand]  = useState(null);
  const [newBrand,  setNewBrand]  = useState('');
  const [newProd,   setNewProd]   = useState('');
  const [newOption, setNewOption] = useState(''); // eslint-disable-line no-unused-vars
  const [newPrice,  setNewPrice]  = useState('');
  const [newCode,   setNewCode]   = useState('');
  const [newCost,   setNewCost]   = useState('');
  const [newErpCode,setNewErpCode]= useState('');
  const [dragging,  setDrag]      = useState(false);
  const fileRef = useRef();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: br }, { data: pr }] = await Promise.all([
      supabase.from('brands').select('*').order('name'),
      supabase.from('products').select('*, brand:brands(name)').order('name'),
    ]);
    setBrands(br || []);
    setProducts(pr || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addBrand = async () => {
    if (!newBrand.trim()) return;
    const { error } = await supabase.from('brands').insert({ name: newBrand.trim() });
    if (error) toast(error.message, 'err');
    else { toast('브랜드 추가 완료', 'ok'); setNewBrand(''); fetchAll(); }
  };

  const addProduct = async () => {
    if (!selBrand || !newProd.trim()) { toast('브랜드와 상품명을 입력해주세요', 'err'); return; }
    if (!newCode.trim()) { toast('상품코드를 입력해주세요', 'err'); return; }
    const { error } = await supabase.from('products').insert({
      brand_id: selBrand.id, name: newProd.trim(),
      code: newCode.trim(),
      erp_code: newErpCode.trim() || null,
      cost: Number(newCost) || 0,
      price: Number(newPrice) || 0,
    });
    if (error) toast(error.message, 'err');
    else { toast('상품 추가 완료', 'ok'); setNewProd(''); setNewOption(''); setNewPrice(''); setNewCode(''); setNewCost(''); setNewErpCode(''); fetchAll(); }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('상품을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchAll(); }
  };

  const toggleSalesStop = async (p) => {
    const next = !p.is_sales_stopped;
    const msg = next
      ? `'${p.name}'을(를) 판매중지 하시겠습니까?\n매장에서 더 이상 판매할 수 없게 됩니다.`
      : `'${p.name}'을(를) 판매재개 하시겠습니까?`;
    if (!window.confirm(msg)) return;
    const { error } = await supabase.from('products').update({ is_sales_stopped: next }).eq('id', p.id);
    if (error) toast(error.message, 'err');
    else { toast(next ? '판매중지 처리' : '판매재개 처리', 'ok'); fetchAll(); }
  };

  const deleteBrand = async (id) => {
    if (!window.confirm('브랜드와 해당 상품이 모두 삭제됩니다. 계속하시겠습니까?')) return;
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); if (selBrand?.id===id) setSelBrand(null); fetchAll(); }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls, xlsx 파일만 지원합니다', 'err'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        toast(`${rows.length}행 감지됨 — 순차 저장 중...`, 'inf');
        let cnt = 0;
        for (const row of rows) {
          const brandName = String(row['브랜드명'] || row['브랜드'] || '').trim();
          const prodName  = String(row['상품명'] || '').trim();
          const code      = String(row['상품코드'] || row['code'] || '').trim() || null;
          const cost      = Number(row['원가'] || row['cost'] || 0);
          const price     = Number(row['판매가'] || row['price'] || 0);
          if (!brandName || !prodName) continue;
          let { data: br } = await supabase.from('brands').select('id').eq('name', brandName).single();
          if (!br) {
            const { data: newBr } = await supabase.from('brands').insert({ name: brandName }).select().single();
            br = newBr;
          }
          if (br) { await supabase.from('products').insert({ brand_id: br.id, name: prodName, code, cost, price }); cnt++; }
        }
        toast(`${cnt}개 상품 업로드 완료`, 'ok'); fetchAll();
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
    };
    reader.readAsBinaryString(file);
  };

  const inputStyle = { height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const [pSearch,  setPSearch]  = useState('');
  const [editing,  setEditing]  = useState({});
  const [saving,   setSavingP]  = useState({});

  const filteredProducts = (() => {
    let list = selBrand ? products.filter(p => p.brand_id === selBrand.id) : products;
    if (pSearch.trim()) {
      const kw = pSearch.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        (p.code||'').toLowerCase().includes(kw) ||
        (p.erp_code||'').toLowerCase().includes(kw)
      );
    }
    return list;
  })();

  const startEdit = (p) => setEditing(prev => ({...prev, [p.id]: { cost: p.cost||0, price: p.price||0 }}));
  const cancelEdit = (id) => setEditing(prev => { const n={...prev}; delete n[id]; return n; });
  const saveEdit = async (p) => {
    setSavingP(prev => ({...prev, [p.id]: true}));
    const { cost, price } = editing[p.id];
    const { error } = await supabase.from('products').update({ cost: Number(cost)||0, price: Number(price)||0 }).eq('id', p.id);
    if (error) toast(error.message, 'err');
    else { toast('저장 완료', 'ok'); cancelEdit(p.id); fetchAll(); }
    setSavingP(prev => ({...prev, [p.id]: false}));
  };

  if (subPage === 'product_add') {
    return (
      <div>
        <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:16}}>
          <div className="card" style={{height:'fit-content'}}>
            <div className="card-label">브랜드</div>
            <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:12}}>
              <input value={newBrand} onChange={e => setNewBrand(e.target.value)}
                style={{...inputStyle, width:'100%'}} placeholder="새 브랜드명"
                onKeyDown={e => e.key==='Enter' && addBrand()} />
              <button className="btn btn-p" onClick={addBrand} style={{width:'100%', justifyContent:'center'}}>+ 브랜드 추가</button>
            </div>
            {brands.map(b => (
              <div key={b.id} onClick={() => setSelBrand(b)}
                style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 10px', borderRadius:'var(--radius)', cursor:'pointer', background: selBrand?.id===b.id ? '#fff3e0' : 'transparent', marginBottom:2}}>
                <span style={{fontWeight: selBrand?.id===b.id ? 700 : 400, color: selBrand?.id===b.id ? 'var(--accent)' : 'var(--text)'}}>{b.name}</span>
                <button className="btn-danger" style={{padding:'2px 8px', fontSize:11}} onClick={e => { e.stopPropagation(); deleteBrand(b.id); }}>삭제</button>
              </div>
            ))}
            {brands.length === 0 && <div className="empty" style={{padding:16}}>브랜드 없음</div>}
          </div>

          <div>
            <div className="card">
              <div className="card-label">상품 직접 추가</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>브랜드 선택 <span style={{color:'var(--danger)'}}>*</span></label>
                  <select value={selBrand?.id||''} onChange={e => setSelBrand(brands.find(b=>b.id===Number(e.target.value))||null)}
                    style={{...inputStyle, width:'100%'}}>
                    <option value="">-- 선택 --</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>상품코드 <span style={{color:'var(--danger)'}}>*</span></label>
                  <input value={newCode} onChange={e => setNewCode(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="상품코드 입력"/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>ERP코드</label>
                  <input value={newErpCode} onChange={e => setNewErpCode(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="ERP코드 입력"/>
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, alignItems:'end'}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>상품명 <span style={{color:'var(--danger)'}}>*</span></label>
                  <input value={newProd} onChange={e => setNewProd(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="상품명 입력"/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>원가</label>
                  <input type="number" value={newCost} onChange={e => setNewCost(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="0"/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>판매가</label>
                  <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={{...inputStyle, width:'100%'}} placeholder="0"/>
                </div>
                <button className="btn btn-p" onClick={addProduct} style={{height:34}}>추가</button>
              </div>
            </div>

            <div className="card">
              <div className="card-label">파일 업로드로 일괄 추가</div>
              <div className={`drop ${dragging?'over':''}`}
                onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
                onClick={()=>fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleFile(e.target.files[0]);e.target.value='';}}/>
                <div className="drop-icon">📂</div>
                <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
                <div className="drop-sub">컬럼: 브랜드명 / 상품명 / 판매가</div>
              </div>
              <div style={{marginTop:12, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12}}>
                <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:6}}>📋 필수 컬럼 안내</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {['브랜드명','상품명','판매가'].map(h => (
                    <span key={h} style={{background:'#fff', border:'1px solid var(--border)', borderRadius:4, padding:'3px 10px', fontSize:12, fontWeight:600, color:'var(--text)'}}>{h}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:'240px 1fr', gap:16}}>
        <div className="card" style={{height:'fit-content'}}>
          <div className="card-label">브랜드</div>
          <div onClick={() => setSelBrand(null)}
            style={{padding:'8px 10px', borderRadius:'var(--radius)', cursor:'pointer', background:!selBrand?'#fff3e0':'transparent', fontWeight:!selBrand?700:400, marginBottom:4, fontSize:12}}>
            전체 ({products.length}개)
          </div>
          {brands.map(b => {
            const cnt = products.filter(p => p.brand_id===b.id).length;
            return (
              <div key={b.id} onClick={() => setSelBrand(b)}
                style={{display:'flex', justifyContent:'space-between', padding:'8px 10px', borderRadius:'var(--radius)', cursor:'pointer', background:selBrand?.id===b.id?'#fff3e0':'transparent', marginBottom:2, fontSize:12}}>
                <span style={{fontWeight:selBrand?.id===b.id?700:400, color:selBrand?.id===b.id?'var(--accent)':'var(--text)'}}>{b.name}</span>
                <span style={{fontSize:11, color:'var(--text3)'}}>{cnt}개</span>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
            <div className="card-label" style={{marginBottom:0}}>{selBrand ? selBrand.name : '전체'} 상품 현황 ({filteredProducts.length}개)</div>
            <input className="finput" value={pSearch} onChange={e => setPSearch(e.target.value)}
              placeholder="🔍 상품명·코드·ERP코드 검색" style={{height:32, fontSize:12, marginLeft:'auto', width:220}}/>
            {pSearch && <button className="btn-ghost" style={{fontSize:11}} onClick={() => setPSearch('')}>✕</button>}
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>상품코드</th><th>ERP코드</th><th>브랜드</th><th>상품명</th><th className="r">원가</th><th className="r">판매가</th><th style={{width:100, textAlign:'center'}}>수정</th><th style={{width:90, textAlign:'center'}}>판매상태</th><th></th></tr></thead>
                <tbody>
                  {filteredProducts.length === 0
                    ? <tr><td colSpan={9} className="empty">등록된 상품이 없습니다</td></tr>
                    : filteredProducts.map(p => {
                      const isEditing = !!editing[p.id];
                      const ed = editing[p.id] || {};
                      return (
                        <tr key={p.id} style={{background: isEditing ? '#fffde7' : (p.is_sales_stopped ? '#fafafa' : '')}}>
                          <td className="mono" style={{fontSize:12, color:'var(--text3)'}}>{p.code || '-'}</td>
                          <td className="mono" style={{fontSize:12, color:'var(--text3)'}}>{p.erp_code || '-'}</td>
                          <td><span className="badge badge-dept">{p.brand?.name}</span></td>
                          <td style={{fontWeight:600, color: p.is_sales_stopped ? 'var(--text3)' : undefined, textDecoration: p.is_sales_stopped ? 'line-through' : undefined}}>{p.name}</td>
                          <td className="r">
                            {isEditing
                              ? <input type="number" value={ed.cost} onChange={e => setEditing(prev=>({...prev,[p.id]:{...prev[p.id],cost:e.target.value}}))}
                                  style={{width:90, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:12, textAlign:'right', outline:'none'}}/>
                              : <span style={{fontFamily:'var(--mono)', color:'var(--text2)'}}>{p.cost ? Number(p.cost).toLocaleString()+'원' : '-'}</span>
                            }
                          </td>
                          <td className="r">
                            {isEditing
                              ? <input type="number" value={ed.price} onChange={e => setEditing(prev=>({...prev,[p.id]:{...prev[p.id],price:e.target.value}}))}
                                  style={{width:90, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:12, textAlign:'right', outline:'none'}}/>
                              : <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{Number(p.price).toLocaleString()}원</span>
                            }
                          </td>
                          <td style={{textAlign:'center'}}>
                            {isEditing ? (
                              <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                                <button className="btn btn-p" style={{height:26, padding:'0 10px', fontSize:11}} disabled={saving[p.id]} onClick={() => saveEdit(p)}>
                                  {saving[p.id] ? <span className="spinner"/> : '저장'}
                                </button>
                                <button className="btn btn-s" style={{height:26, padding:'0 8px', fontSize:11}} onClick={() => cancelEdit(p.id)}>취소</button>
                              </div>
                            ) : (
                              <button className="btn btn-s" style={{height:26, padding:'0 10px', fontSize:11}} onClick={() => startEdit(p)}>수정</button>
                            )}
                          </td>
                          <td style={{textAlign:'center'}}>
                            <button type="button" onClick={() => toggleSalesStop(p)}
                              title={p.is_sales_stopped ? '판매재개' : '판매중지'}
                              style={{height:26, padding:'0 10px', fontSize:11, fontWeight:700, border:'1px solid', borderRadius:'var(--radius)', cursor:'pointer',
                                borderColor: p.is_sales_stopped ? 'var(--success)' : 'var(--danger)',
                                background:  p.is_sales_stopped ? '#e8f5e9' : '#ffebee',
                                color:       p.is_sales_stopped ? 'var(--success)' : 'var(--danger)'}}>
                              {p.is_sales_stopped ? '판매재개' : '판매중지'}
                            </button>
                          </td>
                          <td><button className="btn-danger" onClick={() => deleteProduct(p.id)}>삭제</button></td>
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
    </div>
  );
}
