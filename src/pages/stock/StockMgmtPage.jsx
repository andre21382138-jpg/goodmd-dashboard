import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { toast, uniq } from '../../lib/utils';

export default function StockMgmtPage() {
  const [stocks,   setStocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState({}); // {id: qty}
  const [fStore,   setFStore]   = useState('');
  const [fBranch,  setFBranch]  = useState('');
  const [tab,      setTab]      = useState('list');
  // 직접 입력
  const [brands,   setBrands]   = useState([]);
  const [products, setProducts] = useState([]);
  const [fBrand,   setFBrand]   = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fSt,      setFSt]      = useState('');
  const [fBr,      setFBr]      = useState('');
  const [fQty,     setFQty]     = useState('');
  const [saving,   setSaving]   = useState(false);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('stock_status')
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
    supabase.from('products').select('*').eq('brand_id', fBrand).order('name').then(({ data }) => setProducts(data || []));
    setFProduct('');
  }, [fBrand]);

  const stores  = useMemo(() => uniq(stocks.map(s => s.store_name)), [stocks]);
  const branches = useMemo(() => {
    const src = fStore ? stocks.filter(s => s.store_name===fStore) : stocks;
    return uniq(src.map(s => s.branch_name));
  }, [stocks, fStore]);

  const filtered = useMemo(() => {
    let r = stocks;
    if (fStore)  r = r.filter(s => s.store_name===fStore);
    if (fBranch) r = r.filter(s => s.branch_name===fBranch);
    return r;
  }, [stocks, fStore, fBranch]);

  const saveQty = async (id, qty) => {
    const { error } = await supabase.from('stock_status').update({ quantity: Number(qty), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('수량 저장 완료', 'ok'); setEditing(p => { const n={...p}; delete n[id]; return n; }); fetchStocks(); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fBrand || !fProduct || !fSt || !fBr || fQty==='') { toast('모든 항목을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('stock_status').upsert({
      brand_id: Number(fBrand), product_id: Number(fProduct),
      store_name: fSt, branch_name: fBr, quantity: Number(fQty),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,product_id,store_name,branch_name' });
    if (error) toast(error.message, 'err');
    else { toast('재고 저장 완료', 'ok'); setFQty(''); fetchStocks(); setTab('list'); }
    setSaving(false);
  };

  const [dragging2, setDrag2] = useState(false);
  const fileRef2 = useRef();

  const handleStockFile = (file) => {
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
          const store     = String(row['점포명']||row['점포']||'').trim();
          const branch    = String(row['지점명']||row['지점']||'').trim();
          const qty       = Number(row['재고수량']||row['수량']||0);
          if (!brandName || !prodName || !store || !branch) continue;
          let { data: br } = await supabase.from('brands').select('id').eq('name', brandName).maybeSingle();
          if (!br) continue;
          let { data: pr } = await supabase.from('products').select('id').eq('brand_id', br.id).eq('name', prodName).maybeSingle();
          if (!pr) continue;
          await supabase.from('stock_status').upsert({
            brand_id: br.id, product_id: pr.id, store_name: store, branch_name: branch,
            quantity: qty, updated_at: new Date().toISOString(),
          }, { onConflict: 'brand_id,product_id,store_name,branch_name' });
          cnt++;
        }
        toast(`${cnt}개 재고 업로드 완료`, 'ok'); fetchStocks();
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
    };
    reader.readAsBinaryString(file);
  };

  const inputStyle = { width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='list'?'on':''}`} onClick={() => setTab('list')}>재고 현황</button>
        <button className={`tab ${tab==='input'?'on':''}`} onClick={() => setTab('input')}>직접 입력</button>
        <button className={`tab ${tab==='upload'?'on':''}`} onClick={() => setTab('upload')}>파일 업로드</button>
      </div>

      {tab === 'list' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar">
            <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
              <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
              <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
            </select>
            {(fStore||fBranch) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); }}>✕ 초기화</button>}
            <div className="fbar-right"><span className="fresult"><b>{filtered.length}</b>개 항목</span></div>
          </div>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>브랜드</th><th>상품명</th><th>점포</th><th>지점</th><th className="r">재고수량</th><th>수정</th><th>최종수정일</th><th></th></tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={7} className="empty">재고 데이터가 없습니다</td></tr>
                    : filtered.map(s => (
                      <tr key={s.id}>
                        <td>{s.brand?.name||'-'}</td>
                        <td style={{fontSize:12}}>{s.product?.name||'-'}</td>
                        <td><span className="badge badge-dept">{s.store_name}</span></td>
                        <td><span className="badge badge-store">{s.branch_name}</span></td>
                        <td className="r">
                          {editing[s.id] !== undefined ? (
                            <input type="number" value={editing[s.id]}
                              onChange={e => setEditing(p => ({...p, [s.id]: e.target.value}))}
                              style={{width:80, height:28, padding:'0 6px', border:'1px solid var(--accent)', borderRadius:4, fontSize:13, textAlign:'right'}}
                              autoFocus/>
                          ) : (
                            <span style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{s.quantity?.toLocaleString()}</span>
                          )}
                        </td>
                        <td>
                          {editing[s.id] !== undefined ? (
                            <div style={{display:'flex', gap:4}}>
                              <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}} onClick={() => saveQty(s.id, editing[s.id])}>저장</button>
                              <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => { const n={...p}; delete n[s.id]; return n; })}>취소</button>
                            </div>
                          ) : (
                            <button className="btn btn-s" style={{padding:'3px 8px', fontSize:11}} onClick={() => setEditing(p => ({...p, [s.id]: s.quantity}))}>수정</button>
                          )}
                        </td>
                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '-'}</td>
                        <td><button className="btn-danger" onClick={async () => {
                          if (!window.confirm('이 재고 항목을 삭제하시겠습니까?')) return;
                          const { error } = await supabase.from('stock_status').delete().eq('id', s.id);
                          if (error) toast(error.message, 'err');
                          else { toast('삭제 완료', 'ok'); fetchStocks(); }
                        }}>삭제</button></td>
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
          <div className="card-label">재고 직접 입력</div>
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
              <div><label style={labelStyle}>점포명</label><input value={fSt} onChange={e => setFSt(e.target.value)} style={inputStyle} placeholder="롯데백화점" required/></div>
              <div><label style={labelStyle}>지점명</label><input value={fBr} onChange={e => setFBr(e.target.value)} style={inputStyle} placeholder="건대스타시티점" required/></div>
              <div><label style={labelStyle}>재고수량</label><input type="number" min={0} value={fQty} onChange={e => setFQty(e.target.value)} style={inputStyle} placeholder="0" required/></div>
            </div>
            <button className="btn btn-p" type="submit" disabled={saving} style={{width:'100%', justifyContent:'center', height:40}}>
              {saving ? <span className="spinner"/> : '✓ 재고 저장'}
            </button>
          </form>
        </div>
      )}

      {tab === 'upload' && (
        <div className="card">
          <div className="card-label">파일 업로드로 재고 일괄 등록</div>
          <div className={`drop ${dragging2?'over':''}`}
            onDragOver={e=>{e.preventDefault();setDrag2(true);}} onDragLeave={()=>setDrag2(false)}
            onDrop={e=>{e.preventDefault();setDrag2(false);handleStockFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef2.current?.click()}>
            <input ref={fileRef2} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleStockFile(e.target.files[0]);e.target.value='';}}/>
            <div className="drop-icon">📂</div>
            <div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div>
            <div className="drop-sub">컬럼: 브랜드명 / 상품명 / 점포명 / 지점명 / 재고수량</div>
          </div>
          <div style={{marginTop:12, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:6}}>📋 필수 컬럼 안내</div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {['브랜드명','상품명','점포명','지점명','재고수량'].map(h => (
                <span key={h} style={{background:'#fff', border:'1px solid var(--border)', borderRadius:4, padding:'3px 10px', fontSize:12, fontWeight:600, color:'var(--text)'}}>{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
