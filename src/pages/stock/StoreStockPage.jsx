import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const [transferModal, setTransferModal] = useState(null); // 선택된 stock 행
  const [transferTo, setTransferTo] = useState('');         // "store_name|branch_name"
  const [transferQty, setTransferQty] = useState(1);
  const [transferMemo, setTransferMemo] = useState('');
  const [transferProcessing, setTransferProcessing] = useState(false);
  const [allBranches, setAllBranches] = useState([]); // [{store_name, branch_name}]
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);

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

  // 매장재고 일괄 업로드 (본사 전용)
  // 엑셀 컬럼: [그룹(매장), 매장(지점), 상품코드, 상품명, 재고]
  // 매칭은 product.code 또는 erp_code 둘 다 fallback
  const handleUploadClick = () => uploadRef.current?.click();
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('업로드 시 매장재고가 엑셀의 재고 값으로 일괄 갱신됩니다.\n계속하시겠습니까?')) return;
    setUploading(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type:'array', codepage: 949 });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // 상품 매핑 (code/erp_code 둘 다 키로)
      const { data: products } = await supabase.from('products').select('id, name, code, erp_code');
      const codeMap = new Map();
      for (const p of (products || [])) {
        if (p.code)     codeMap.set(String(p.code).trim(),     p);
        if (p.erp_code) codeMap.set(String(p.erp_code).trim(), p);
      }

      // 유효 데이터 row 추출 (헤더/소계/총합 제외)
      const validRows = [];
      for (const r of data) {
        const a = String(r[0]||'').trim();
        const b = String(r[1]||'').trim();
        const c = String(r[2]||'').trim();
        const e5 = r[4];
        if (!a || !b || !c) continue;
        // 헤더 row 제외
        if (c === '상품코드') continue;
        const stock = Number(e5);
        if (!Number.isFinite(stock)) continue;
        validRows.push({ store: a, branch: b, code: c, stock });
      }

      if (validRows.length === 0) {
        toast('업로드 가능한 데이터 행이 없습니다 (컬럼 순서: 매장/지점/코드/상품명/재고)', 'err');
        setUploading(false);
        return;
      }
      toast(`${validRows.length}건 인식 — 저장 중...`, 'inf');

      // 기존 store_stock 일괄 조회 → 키 매핑 (UPDATE vs INSERT 분류)
      const { data: existing } = await supabase.from('store_stock')
        .select('id, store_name, branch_name, product_code');
      const existingMap = new Map();
      for (const ex of (existing || [])) {
        existingMap.set(`${ex.store_name}|${ex.branch_name}|${ex.product_code}`, ex.id);
      }

      const updates = [];
      const inserts = [];
      let notFound = 0;
      for (const row of validRows) {
        const product = codeMap.get(row.code);
        if (!product) { notFound++; continue; }
        const normalizedCode = product.code || row.code;
        const key = `${row.store}|${row.branch}|${normalizedCode}`;
        const existingId = existingMap.get(key);
        if (existingId) {
          updates.push({ id: existingId, stock_qty: row.stock, product_name: product.name });
        } else {
          inserts.push({
            store_name: row.store,
            branch_name: row.branch,
            product_code: normalizedCode,
            product_name: product.name,
            stock_qty: row.stock,
            updated_at: new Date().toISOString(),
          });
        }
      }

      // UPDATE — 100건씩 병렬 처리
      let ok = 0, fail = 0;
      const BATCH = 100;
      for (let i = 0; i < updates.length; i += BATCH) {
        const slice = updates.slice(i, i+BATCH);
        const results = await Promise.all(slice.map(u =>
          supabase.from('store_stock').update({
            stock_qty: u.stock_qty,
            product_name: u.product_name,
            updated_at: new Date().toISOString(),
          }).eq('id', u.id)
        ));
        for (const { error } of results) {
          if (error) fail++; else ok++;
        }
      }
      // INSERT — 500건씩 배치
      const INS_BATCH = 500;
      for (let i = 0; i < inserts.length; i += INS_BATCH) {
        const slice = inserts.slice(i, i+INS_BATCH);
        const { error } = await supabase.from('store_stock').insert(slice);
        if (error) fail += slice.length;
        else ok += slice.length;
      }

      const parts = [`${ok}건 반영`];
      if (fail     > 0) parts.push(`실패 ${fail}건`);
      if (notFound > 0) parts.push(`상품 매칭 실패 ${notFound}건`);
      toast(parts.join(' / '), (fail > 0 || notFound > 0) ? 'err' : 'ok');
      fetchStocks();
    } catch (err) {
      toast('업로드 실패: ' + (err.message || err), 'err');
    }
    setUploading(false);
  };

  // 점간이동 대상 매장 목록 fetch
  useEffect(() => {
    if (isManager) return; // 매니저는 점간이동 안 함
    supabase.from('store_stock').select('store_name, branch_name').then(({data}) => {
      const seen = new Set();
      const list = [];
      for (const r of (data||[])) {
        const k = `${r.store_name}|${r.branch_name}`;
        if (!seen.has(k) && r.store_name && r.branch_name) {
          seen.add(k);
          list.push({ store_name: r.store_name, branch_name: r.branch_name });
        }
      }
      list.sort((a,b) => a.store_name.localeCompare(b.store_name) || a.branch_name.localeCompare(b.branch_name));
      setAllBranches(list);
    });
  }, [isManager]);

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

  const openTransfer = (s) => {
    setTransferModal(s);
    setTransferTo('');
    setTransferQty(1);
    setTransferMemo('');
  };
  const closeTransfer = () => {
    setTransferModal(null);
    setTransferTo('');
    setTransferQty(1);
    setTransferMemo('');
  };
  const confirmTransfer = async () => {
    if (!transferModal) return;
    if (!transferTo) { toast('대상 매장을 선택해주세요', 'err'); return; }
    const qty = Number(transferQty) || 0;
    if (qty <= 0) { toast('수량을 입력해주세요', 'err'); return; }
    if (qty > (transferModal.stock_qty||0)) { toast('현재 재고를 초과합니다', 'err'); return; }
    const [toStore, toBranch] = transferTo.split('|');
    if (toStore === transferModal.store_name && toBranch === transferModal.branch_name) {
      toast('동일 매장으로 이동할 수 없습니다', 'err'); return;
    }
    setTransferProcessing(true);
    try {
      // 1) 출처 재고 차감
      const newQty = (transferModal.stock_qty||0) - qty;
      const { error: stockErr } = await supabase.from('store_stock')
        .update({ stock_qty: newQty, updated_at: new Date().toISOString() })
        .eq('id', transferModal.id);
      if (stockErr) throw stockErr;

      // 2) store_transfers insert
      const { error: txErr } = await supabase.from('store_transfers').insert({
        from_store_name: transferModal.store_name,
        from_branch_name: transferModal.branch_name,
        to_store_name: toStore,
        to_branch_name: toBranch,
        product_id: transferModal.product_id,
        quantity: qty,
        status: 'dispatched',
        dispatched_by: profile.id,
        memo: transferMemo.trim() || null,
      });
      if (txErr) throw txErr;

      // 3) 매칭되는 pending order_requests fulfilled
      await supabase.from('order_requests')
        .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
        .eq('store_name', toStore)
        .eq('branch_name', toBranch)
        .eq('product_id', transferModal.product_id)
        .eq('status', 'pending');

      toast(`${toStore} ${toBranch}으로 ${qty}개 이동 완료`, 'ok');
      closeTransfer();
      fetchStocks();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setTransferProcessing(false);
    }
  };

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
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:10}}>
            <span className="fresult">
              <b>{filtered.length.toLocaleString()}</b>개 상품 · 총 재고 <b>{totalQty.toLocaleString()}</b>개
            </span>
            {!isManager && (
              <>
                <input ref={uploadRef} type="file" accept=".xls,.xlsx"
                  onChange={handleUploadFile} style={{display:'none'}}/>
                <button type="button" onClick={handleUploadClick} disabled={uploading}
                  title="점별 매장재고현황 엑셀 일괄 업로드 (코드 매칭)"
                  style={{height:32, padding:'0 12px', border:'1px solid #2e7d32', borderRadius:'var(--radius)', background:'#e8f5e9', color:'#2e7d32', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  {uploading ? <span className="spinner"/> : '📤 재고 일괄 업로드'}
                </button>
              </>
            )}
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
                  {!isManager && <th style={{width:180, textAlign:'center'}}>수정/이동</th>}
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
                            <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                              <button className="btn btn-s" style={{height:26,padding:'0 10px',fontSize:11}}
                                onClick={()=>startEdit(s.id, s.stock_qty||0)}>수정</button>
                              <button type="button"
                                onClick={() => openTransfer(s)}
                                disabled={(s.stock_qty||0) <= 0}
                                style={{height:26, padding:'0 10px', fontSize:11, fontWeight:700,
                                  border:'1px solid #1565C0', borderRadius:'var(--radius)',
                                  background:(s.stock_qty||0) <= 0 ? '#fafafa' : '#e3f2fd',
                                  color:(s.stock_qty||0) <= 0 ? 'var(--text3)' : '#1565C0',
                                  cursor:(s.stock_qty||0) <= 0 ? 'not-allowed' : 'pointer'}}>
                                🔁 재고이동
                              </button>
                            </div>
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
      {/* 재고이동 모달 */}
      {transferModal && (
        <div style={{position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={closeTransfer}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}}/>
          <div style={{position:'relative', background:'#fff', borderRadius:12, width:'min(480px, 92vw)', padding:'22px 24px', boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>
              🔁 재고이동
            </div>
            <div style={{fontSize:12, color:'var(--text2)', marginBottom:16, paddingBottom:12, borderBottom:'1px solid var(--border)'}}>
              <span className="badge badge-dept">{transferModal.store_name}</span>{' '}
              <span className="badge badge-store">{transferModal.branch_name}</span>
              <div style={{marginTop:6, fontSize:13, color:'var(--text)'}}>
                <strong>{transferModal.product_name}</strong>
                <span style={{marginLeft:8, color:'var(--text3)'}}>(현재 재고: {transferModal.stock_qty||0}개)</span>
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:4}}>대상 매장 *</label>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value)}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'#fff'}}>
                <option value="">매장 선택</option>
                {allBranches
                  .filter(b => !(b.store_name === transferModal.store_name && b.branch_name === transferModal.branch_name))
                  .map(b => (
                    <option key={`${b.store_name}|${b.branch_name}`} value={`${b.store_name}|${b.branch_name}`}>
                      {b.store_name} {b.branch_name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:4}}>이동 수량 *</label>
              <input type="number" min={1} max={transferModal.stock_qty||0} value={transferQty}
                onChange={e => setTransferQty(e.target.value)}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13}}/>
            </div>

            <div style={{marginBottom:12}}>
              <label style={{fontSize:12, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:4}}>메모</label>
              <input value={transferMemo} onChange={e => setTransferMemo(e.target.value)}
                placeholder="선택"
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13}}/>
            </div>

            <div style={{padding:'10px 12px', background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:6, fontSize:12, color:'#e65100', marginBottom:14}}>
              ⚠️ 확인 즉시 <strong>{transferModal.store_name} {transferModal.branch_name}</strong> 재고가 차감됩니다. C매장 매니저에게 별도 연락하여 출고 안내가 필요합니다.
            </div>

            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button type="button" onClick={closeTransfer}
                style={{height:38, padding:'0 18px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'}}>
                취소
              </button>
              <button type="button" onClick={confirmTransfer} disabled={transferProcessing}
                style={{height:38, padding:'0 18px', border:'none', borderRadius:'var(--radius)', background:'#1565C0', color:'#fff', fontSize:13, fontWeight:700, cursor:transferProcessing?'not-allowed':'pointer', opacity:transferProcessing?0.6:1}}>
                {transferProcessing ? '처리 중...' : '재고이동 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
