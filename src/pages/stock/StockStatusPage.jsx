import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function StockStatusPage() {
  const [tab, setTab] = useState('list'); // 'list' | 'input' | 'upload'
  const [stocks, setStocks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands]   = useState([]);
  const [products, setProducts] = useState([]);
  // 직접 입력 폼
  const [fBrand,   setFBrand]   = useState('');
  const [fProduct, setFProduct] = useState('');
  const [fStore,   setFStore]   = useState('');
  const [fBranch,  setFBranch]  = useState('');
  const [fQty,     setFQty]     = useState('');
  const [saving,   setSaving]   = useState(false);
  // 파일 업로드
  const [dragging, setDrag]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

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
    supabase.from('products').select('*').eq('brand_id', fBrand).order('name')
      .then(({ data }) => setProducts(data || []));
    setFProduct('');
  }, [fBrand]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fBrand || !fProduct || !fStore || !fBranch || fQty === '') { toast('모든 항목을 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('stock_status').upsert({
      brand_id: Number(fBrand), product_id: Number(fProduct),
      store_name: fStore, branch_name: fBranch, quantity: Number(fQty),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,product_id,store_name,branch_name' });
    if (error) toast(error.message, 'err');
    else { toast('재고 저장 완료', 'ok'); setFQty(''); fetchStocks(); setTab('list'); }
    setSaving(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xls|xlsx)$/i)) { toast('xls, xlsx 파일만 지원합니다', 'err'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        toast(`${rows.length}행 감지 — 브랜드/상품 매핑 후 저장해주세요`, 'inf');
      } catch(err) { toast('파싱 실패: ' + err.message, 'err'); }
      setUploading(false);
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
          <div className="card-label">재고 현황</div>
          {loading ? <div className="empty"><span className="spinner"/></div> : stocks.length === 0 ? (
            <div className="empty">등록된 재고 데이터가 없습니다<br/><span style={{fontSize:11}}>직접 입력 또는 파일 업로드로 등록하세요</span></div>
          ) : (
            <div className="twrap">
              <table>
                <thead><tr><th>브랜드</th><th>상품명</th><th>점포</th><th>지점</th><th className="r">재고수량</th><th className="td-m" style={{fontSize:10}}>최종수정</th></tr></thead>
                <tbody>
                  {stocks.map((s,i) => (
                    <tr key={i}>
                      <td>{s.brand?.name || '-'}</td>
                      <td style={{fontSize:12}}>{s.product?.name || '-'}</td>
                      <td><span className="badge badge-dept">{s.store_name}</span></td>
                      <td><span className="badge badge-store">{s.branch_name}</span></td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)'}}>{s.quantity?.toLocaleString()}</td>
                      <td className="mono">{s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '-'}</td>
                    </tr>
                  ))}
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
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14, marginBottom:14}}>
              <div><label style={labelStyle}>브랜드</label>
                <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={inputStyle} required>
                  <option value="">-- 선택 --</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>상품</label>
                <select value={fProduct} onChange={e => setFProduct(e.target.value)} style={{...inputStyle, background:!fBrand?'#f0f0f0':'#fff'}} required disabled={!fBrand}>
                  <option value="">-- 선택 --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>점포명</label>
                <input value={fStore} onChange={e => setFStore(e.target.value)} style={inputStyle} placeholder="롯데백화점" required/>
              </div>
              <div><label style={labelStyle}>지점명</label>
                <input value={fBranch} onChange={e => setFBranch(e.target.value)} style={inputStyle} placeholder="건대스타시티점" required/>
              </div>
              <div><label style={labelStyle}>재고수량</label>
                <input type="number" min={0} value={fQty} onChange={e => setFQty(e.target.value)} style={inputStyle} placeholder="0" required/>
              </div>
            </div>
            <button className="btn btn-p" type="submit" disabled={saving} style={{width:'100%',justifyContent:'center',height:40}}>
              {saving ? <span className="spinner"/> : '✓ 재고 저장'}
            </button>
          </form>
        </div>
      )}

      {tab === 'upload' && (
        <div className="card">
          <div className="card-label">파일 업로드</div>
          <div className={`drop ${dragging?'over':''}`}
            onDragOver={e=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            onClick={()=>fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".xls,.xlsx" onClick={e=>e.stopPropagation()} onChange={e=>{handleFile(e.target.files[0]);e.target.value='';}}/>
            {uploading
              ? <><div className="drop-icon"><span className="spinner"/></div><div className="drop-main">처리 중...</div></>
              : <><div className="drop-icon">📂</div><div className="drop-main"><strong>클릭</strong> 또는 <strong>드래그&드롭</strong></div><div className="drop-sub">브랜드 / 상품 / 점포 / 지점 / 재고수량 컬럼 포함 엑셀 (.xls / .xlsx)</div></>
            }
          </div>
          <div style={{marginTop:14, background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:14}}>
            <div style={{fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:8}}>📋 업로드 파일 양식 안내</div>
            <div className="twrap">
              <table style={{fontSize:11}}>
                <thead><tr><th>브랜드명</th><th>상품명</th><th>점포명</th><th>지점명</th><th>재고수량</th></tr></thead>
                <tbody>
                  <tr><td>팔레오</td><td>팔레오_닥터스노트...</td><td>롯데백화점</td><td>건대스타시티점</td><td>100</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
