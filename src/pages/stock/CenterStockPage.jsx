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

  // 센터재고 일괄 업로드 — 헤더 기반 컬럼 인식 + 상품코드/ERP코드 매칭 + upsert(product_id 기준)
  const [unmatchedCenter, setUnmatchedCenter] = useState([]);
  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls, xlsx 파일만 지원합니다', 'err'); return; }
    // 파일에 없는 상품 재고를 0으로 처리할지 (전체 스냅샷)
    const zeroMissing = window.confirm(
      '파일에 없는 상품의 센터재고를 0으로 처리할까요?\n\n' +
      '[확인] = 이 파일을 "전체 센터재고 스냅샷"으로 적용 (파일에 없는 상품은 0)\n' +
      '[취소] = 파일에 있는 상품만 갱신 (나머지는 그대로 유지)'
    );
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary', codepage: 949 });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // 헤더 탐지
        const norm = v => String(v ?? '').replace(/\s/g, '');
        let headerIdx = -1;
        for (let i = 0; i < Math.min(data.length, 10); i++) {
          if ((data[i] || []).some(c => norm(c) === '상품코드')) { headerIdx = i; break; }
        }
        if (headerIdx === -1) { toast('헤더(상품코드 컬럼)를 찾지 못했습니다', 'err'); return; }
        const header = data[headerIdx].map(norm);
        const col = (...names) => { for (const n of names) { const i = header.findIndex(h => h === norm(n)); if (i !== -1) return i; } return -1; };
        const cCode = col('상품코드'), cErp = col('ERP코드','ERP'), cQty = col('수량','재고','재고수량');
        if (cCode === -1 || cQty === -1) { toast('상품코드 또는 수량 컬럼을 찾지 못했습니다', 'err'); return; }

        // 상품 매핑(code/erp_code → product)
        const { data: products } = await supabase.from('products').select('id, brand_id, name, code, erp_code');
        const codeMap = new Map();
        for (const p of (products || [])) {
          if (p.code)     codeMap.set(String(p.code).trim(), p);
          if (p.erp_code) codeMap.set(String(p.erp_code).trim(), p);
        }

        // 파일 → product_id별 수량 합산(같은 코드 중복행 합산)
        const byProduct = new Map(); // product_id → { product, qty }
        const unmatched = [];
        for (let i = headerIdx + 1; i < data.length; i++) {
          const r = data[i] || [];
          const code = String(r[cCode] ?? '').trim();
          const erp  = cErp !== -1 ? String(r[cErp] ?? '').trim() : '';
          const qty  = Number(r[cQty]);
          if (!code && !erp) continue;
          if (!Number.isFinite(qty)) continue;
          const product = codeMap.get(code) || codeMap.get(erp);
          if (!product) { unmatched.push({ code: code || erp }); continue; }
          const cur = byProduct.get(product.id) || { product, qty: 0 };
          cur.qty += qty;
          byProduct.set(product.id, cur);
        }
        if (byProduct.size === 0) { toast('매칭된 데이터가 없습니다', 'err'); return; }
        toast(`${byProduct.size}개 상품 인식 — 저장 중...`, 'inf');

        // 기존 center_stock (product_id별)
        const { data: existing } = await supabase.from('center_stock').select('id, product_id, quantity');
        const exMap = new Map();
        for (const ex of (existing || [])) if (ex.product_id != null) exMap.set(ex.product_id, ex);

        let ok = 0, fail = 0;
        const nowIso = new Date().toISOString();
        for (const [pid, { product, qty }] of byProduct) {
          const ex = exMap.get(pid);
          let error;
          if (ex) {
            ({ error } = await supabase.from('center_stock').update({
              quantity: qty, product_code: product.code || null, updated_at: nowIso,
            }).eq('id', ex.id));
          } else {
            ({ error } = await supabase.from('center_stock').insert({
              brand_id: product.brand_id, product_id: pid, product_code: product.code || null,
              quantity: qty, updated_at: nowIso,
            }));
          }
          if (error) fail++; else ok++;
        }

        // 미포함 0처리
        let zeroed = 0;
        if (zeroMissing) {
          for (const ex of (existing || [])) {
            if (ex.product_id != null && !byProduct.has(ex.product_id) && (ex.quantity || 0) !== 0) {
              const { error } = await supabase.from('center_stock').update({ quantity: 0, updated_at: nowIso }).eq('id', ex.id);
              if (!error) zeroed++;
            }
          }
        }

        const parts = [`${ok}건 반영`];
        if (zeroMissing)        parts.push(`미포함 ${zeroed}건 0처리`);
        if (fail > 0)           parts.push(`실패 ${fail}건`);
        if (unmatched.length>0) parts.push(`상품 매칭 실패 ${unmatched.length}건`);
        toast(parts.join(' / '), (fail>0||unmatched.length>0) ? 'err' : 'ok');
        setUnmatchedCenter(unmatched);
        fetchStocks(); setTab('list');
      } catch(err) { toast('파싱 실패: ' + (err.message||err), 'err'); }
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
          {unmatchedCenter.length > 0 && (
            <div style={{marginBottom:12, padding:'10px 14px', background:'#ffebee', border:'1px solid #ef9a9a', borderRadius:'var(--radius)', fontSize:12, color:'var(--danger)'}}>
              ⚠ 직전 업로드 상품 매칭 실패 <b>{unmatchedCenter.length}</b>건 (미등록 상품)
              <span style={{color:'var(--text3)', marginLeft:8, fontFamily:'var(--mono)'}}>
                {unmatchedCenter.slice(0,5).map(u=>u.code).join(', ')}{unmatchedCenter.length>5?' 외':''}
              </span>
              <button className="btn-ghost" style={{marginLeft:8, fontSize:11}} onClick={() => setUnmatchedCenter([])}>✕</button>
            </div>
          )}
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
