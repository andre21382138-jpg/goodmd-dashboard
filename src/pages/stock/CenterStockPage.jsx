import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function CenterStockPage() {
  const [stocks,   setStocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('list');
  const [brands,   setBrands]   = useState([]);
  const [products, setProducts] = useState([]);
  const [editing,  setEditing]  = useState({});
  // 등록 폼
  const [fBrand,   setFBrand]   = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fCode,    setFCode]    = useState('');
  const [fQty,     setFQty]     = useState('');
  const [fNote,    setFNote]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [dragging, setDrag]     = useState(false);
  const [fSearch,  setFSearch]  = useState('');
  const fileRef = useRef();

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('center_stock')
      .select('*, brand:brands(name), product:products(name)')
      .order('updated_at', { ascending: false });
    setStocks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);
  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []));
  }, []);
  useEffect(() => {
    if (!fBrand) { setProducts([]); setFProduct(''); return; }
    supabase.from('products').select('*').eq('brand_id', fBrand).order('name')
      .then(({ data }) => setProducts(data || []));
    setFProduct('');
  }, [fBrand]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fBrand || !fProduct || fQty === '') { toast('브랜드·상품·수량을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('center_stock').insert({
      brand_id: Number(fBrand), product_id: Number(fProduct),
      product_code: fCode.trim() || null,
      quantity: Number(fQty), note: fNote.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (error) toast(error.message, 'err');
    else { toast('센터재고 등록 완료', 'ok'); setFBrand(''); setFProduct(''); setFCode(''); setFQty(''); setFNote(''); fetchStocks(); setTab('list'); }
    setSaving(false);
  };

  const saveQty = async (id, qty) => {
    const { error } = await supabase.from('center_stock').update({ quantity: Number(qty), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('수량 수정 완료', 'ok'); setEditing(p => { const n={...p}; delete n[id]; return n; }); fetchStocks(); }
  };

  const deleteRow = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const { error } = await supabase.from('center_stock').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchStocks(); }
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
        toast(`${rows.length}행 처리 중...`, 'inf');
        let cnt = 0;
        for (const row of rows) {
          const brandName = String(row['브랜드명']||row['브랜드']||'').trim();
          const prodName  = String(row['상품명']||'').trim();
          const code      = String(row['상품코드']||'').trim();
          const qty       = Number(row['수량']||0);
          const note      = String(row['비고']||'').trim();
          if (!brandName || !prodName) continue;
          let { data: br } = await supabase.from('brands').select('id').eq('name', brandName).maybeSingle();
          if (!br) { const { data } = await supabase.from('brands').insert({ name: brandName }).select().single(); br = data; }
          if (!br) continue;
          let { data: pr } = await supabase.from('products').select('id').eq('brand_id', br.id).eq('name', prodName).maybeSingle();
          if (!pr) continue;
          await supabase.from('center_stock').insert({ brand_id: br.id, product_id: pr.id, product_code: code||null, quantity: qty, note: note||null, updated_at: new Date().toISOString() });
          cnt++;
        }
        toast(`${cnt}개 등록 완료`, 'ok'); fetchStocks(); setTab('list');
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
    };
    reader.readAsBinaryString(file);
  };

  const filtered = useMemo(() => {
    if (!fSearch) return stocks;
    const q = fSearch.toLowerCase();
    return stocks.filter(s => s.product?.name?.toLowerCase().includes(q) || s.product_code?.toLowerCase().includes(q));
  }, [stocks, fSearch]);

  const totalQty = useMemo(() => filtered.reduce((s,r) => s + (r.quantity||0), 0), [filtered]);

  const inputStyle = { width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='list'?'on':''}`} onClick={() => setTab('list')}>재고 현황</button>
        <button className={`tab ${tab==='input'?'on':''}`} onClick={() => setTab('input')}>직접 등록</button>
        <button className={`tab ${tab==='upload'?'on':''}`} onClick={() => setTab('upload')}>파일 업로드</button>
      </div>

      {tab === 'list' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar">
            <input className="finput" placeholder="상품명 / 상품코드 검색" value={fSearch} onChange={e => setFSearch(e.target.value)}/>
            {fSearch && <button className="btn-ghost" onClick={() => setFSearch('')}>✕</button>}
            <div className="fbar-right">
              <span className="fresult"><b>{filtered.length}</b>개 품목 · 총 <b>{totalQty.toLocaleString()}</b>개</span>
            </div>
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>브랜드</th><th>상품코드</th><th>상품명</th><th className="r">수량</th><th>비고</th><th>수정</th><th>최종수정</th><th></th></tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={8} className="empty">등록된 센터재고가 없습니다</td></tr>
                    : filtered.map(s => (
                      <tr key={s.id}>
                        <td><span className="badge badge-dept">{s.brand?.name||'-'}</span></td>
                        <td className="mono" style={{fontSize:11}}>{s.product_code||'-'}</td>
                        <td style={{fontSize:12}}>{s.product?.name||'-'}</td>
                        <td className="r">
                          {editing[s.id] !== undefined
                            ? <input type="number" value={editing[s.id]} autoFocus
                                onChange={e => setEditing(p => ({...p, [s.id]: e.target.value}))}
                                style={{width:80, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:4, fontSize:13, textAlign:'right'}}/>
                            : <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{s.quantity?.toLocaleString()}</span>
                          }
                        </td>
                        <td style={{fontSize:11, color:'var(--text2)'}}>{s.note||'-'}</td>
                        <td>
                          {editing[s.id] !== undefined
                            ? <div style={{display:'flex', gap:4}}>
                                <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}} onClick={() => saveQty(s.id, editing[s.id])}>저장</button>
                                <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => { const n={...p}; delete n[s.id]; return n; })}>취소</button>
                              </div>
                            : <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => ({...p, [s.id]: s.quantity}))}>수정</button>
                          }
                        </td>
                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '-'}</td>
                        <td><button className="btn-danger" onClick={() => deleteRow(s.id)}>삭제</button></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'input' && (
        <div className="card">
          <div className="card-label">센터재고 직접 등록</div>
          <form onSubmit={handleSave}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:14, marginBottom:14}}>
              <div><label style={labelStyle}>브랜드</label>
                <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={inputStyle} required>
                  <option value="">-- 선택 --</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>상품</label>
                <select value={fProduct} onChange={e => setFProduct(e.target.value)} style={{...inputStyle, background:!fBrand?'#f0f0f0':'#fff'}} required disabled={!fBrand}>
                  <option value="">-- 선택 --</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>상품코드 (선택)</label>
                <input value={fCode} onChange={e => setFCode(e.target.value)} style={inputStyle} placeholder="바코드 등"/>
              </div>
              <div><label style={labelStyle}>수량</label>
                <input type="number" min={0} value={fQty} onChange={e => setFQty(e.target.value)} style={inputStyle} placeholder="0" required/>
              </div>
              <div><label style={labelStyle}>비고 (선택)</label>
                <input value={fNote} onChange={e => setFNote(e.target.value)} style={inputStyle} placeholder="입고일, 로트번호 등"/>
              </div>
            </div>
            <button className="btn btn-p" type="submit" disabled={saving} style={{width:'100%', justifyContent:'center', height:40}}>
              {saving ? <span className="spinner"/> : '✓ 센터재고 등록'}
            </button>
          </form>
        </div>
      )}

      {tab === 'upload' && (
        <div className="card">
          <div className="card-label">파일 업로드로 일괄 등록</div>
          <div className={`drop ${dragging?'over':''}`}
            onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleFile(e.target.files[0]);e.target.value='';}}/>
            <div className="drop-icon">📂</div>
            <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
            <div className="drop-sub">컬럼: 브랜드명 / 상품명 / 상품코드 / 수량 / 비고</div>
          </div>
          <div style={{marginTop:12, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:6}}>📋 필수 컬럼 안내</div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {['브랜드명','상품명','상품코드 (선택)','수량','비고 (선택)'].map(h => (
                <span key={h} style={{background:'#fff', border:'1px solid var(--border)', borderRadius:4, padding:'3px 10px', fontSize:12, fontWeight:600, color:'var(--text)'}}>{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
