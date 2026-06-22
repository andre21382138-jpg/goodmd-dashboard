import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import StoreStockPage from './StoreStockPage';

// 매장 발주요청 — 역할별 단일 메뉴
//  탭1 발주요청: 매장재고 상품별 (기간판매량 / 현재고 / 발주수량 자동) 작성 → [발주요청]
//    · 발주수량 = max(0, 직전 발주~오늘 판매량 − 현재고)  (수정/삭제/상품추가 가능)
//    · 0 수량은 전체선택해도 본사로 전송되지 않음
//  탭2 발송현황: 요청 이력 + 도착분 입고확인(재고 +반영)
export default function StockRequestPage({ profile }) {
  const store  = profile.department;
  const branch = profile.branch;
  const today  = new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState('request'); // 'stock' | 'request' | 'status'

  // ── 발주요청 작성 ──
  const [sheetLoading, setSheetLoading] = useState(true);
  const [fromDate, setFromDate] = useState(null);   // 기간 시작(직전 발주일)
  const [rows, setRows] = useState([]);             // {productId, brandId, name, code, stock, soldQty, qty, checked}
  const [submitting, setSubmitting] = useState(false);

  // 상품추가 검색
  const [allProducts, setAllProducts] = useState([]);
  const [stockMap, setStockMap] = useState(new Map());  // code → stock_qty
  const [salesMap, setSalesMap] = useState(new Map());  // productId → soldQty
  const [addSearch, setAddSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadSheet = useCallback(async () => {
    setSheetLoading(true);
    try {
      // 1) 매장재고
      const { data: stockRows } = await supabase.from('store_stock')
        .select('product_code, product_name, stock_qty')
        .eq('store_name', store).eq('branch_name', branch);
      const sMap = new Map();
      for (const s of (stockRows || [])) sMap.set(String(s.product_code || '').trim(), Number(s.stock_qty) || 0);

      // 2) 상품 마스터 (code/erp_code → product)
      const { data: prods } = await supabase.from('products')
        .select('id, code, erp_code, brand_id, name, is_sales_stopped, brand:brands(name)');
      const codeMap = new Map();
      for (const p of (prods || [])) {
        if (p.code)     codeMap.set(String(p.code).trim(), p);
        if (p.erp_code) codeMap.set(String(p.erp_code).trim(), p);
      }

      // 3) 직전 발주요청일 → 기간 시작
      const { data: lastReq } = await supabase.from('order_requests')
        .select('created_at, request_date')
        .eq('store_name', store).eq('branch_name', branch)
        .order('created_at', { ascending: false }).limit(1);
      let from;
      if (lastReq && lastReq.length > 0) {
        from = (lastReq[0].request_date || lastReq[0].created_at || '').slice(0, 10);
      }
      if (!from) { const d = new Date(); d.setDate(d.getDate() - 30); from = d.toISOString().slice(0, 10); }

      // 4) 기간 판매량 (product_id 합)
      const { data: salesRows } = await supabase.from('sales')
        .select('product_id, quantity, sold_at')
        .eq('store_name', store).eq('branch_name', branch)
        .gte('sold_at', from);
      const saMap = new Map();
      for (const r of (salesRows || [])) {
        const pid = String(r.product_id);
        saMap.set(pid, (saMap.get(pid) || 0) + (Number(r.quantity) || 0));
      }

      // 5) 발주 시트 — 매장재고 등록 상품 기준 (판매중지 제외)
      const list = [];
      const seen = new Set();
      for (const s of (stockRows || [])) {
        const code = String(s.product_code || '').trim();
        const p = codeMap.get(code);
        if (!p || p.is_sales_stopped) continue;        // 미등록/판매중지 제외
        if (seen.has(p.id)) continue; seen.add(p.id);
        const stock = sMap.get(code) || 0;
        const soldQty = saMap.get(String(p.id)) || 0;
        const qty = Math.max(0, soldQty - stock);
        list.push({ productId: p.id, brandId: p.brand_id, name: p.name, code,
          brandName: p.brand?.name || '', stock, soldQty, qty, checked: qty > 0 });
      }
      list.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));

      setStockMap(sMap); setSalesMap(saMap); setAllProducts(prods || []);
      setFromDate(from); setRows(list);
    } catch (err) {
      toast('발주 시트 로드 실패: ' + (err.message || err), 'err');
    }
    setSheetLoading(false);
  }, [store, branch]);

  useEffect(() => { if (tab === 'request') loadSheet(); }, [tab, loadSheet]);

  const setRowQty = (productId, val) => setRows(prev => prev.map(r =>
    r.productId === productId ? { ...r, qty: val } : r));
  const setRowChecked = (productId, val) => setRows(prev => prev.map(r =>
    r.productId === productId ? { ...r, checked: val } : r));
  const removeRow = (productId) => setRows(prev => prev.filter(r => r.productId !== productId));

  const allChecked = rows.length > 0 && rows.every(r => r.checked);
  const toggleAll = () => { const v = !allChecked; setRows(prev => prev.map(r => ({ ...r, checked: v }))); };

  const addSuggestions = addSearch.trim()
    ? allProducts
        .filter(p => !p.is_sales_stopped)
        .filter(p => !rows.some(r => r.productId === p.id))
        .filter(p => {
          const q = addSearch.toLowerCase();
          return (p.name || '').toLowerCase().includes(q)
              || (p.code || '').toLowerCase().includes(q)
              || (p.erp_code || '').toLowerCase().includes(q);
        }).slice(0, 8)
    : [];

  const addProduct = (p) => {
    const code = String(p.code || '').trim();
    const stock = stockMap.get(code) || 0;
    const soldQty = salesMap.get(String(p.id)) || 0;
    setRows(prev => [{ productId: p.id, brandId: p.brand_id, name: p.name, code,
      brandName: p.brand?.name || '', stock, soldQty, qty: Math.max(0, soldQty - stock), checked: true }, ...prev]);
    setAddSearch(''); setShowAdd(false);
  };

  const submit = async () => {
    const targets = rows.filter(r => r.checked && (Number(r.qty) || 0) > 0);
    if (targets.length === 0) { toast('발주수량이 1개 이상인 상품을 선택해주세요', 'err'); return; }
    if (!window.confirm(`${targets.length}개 상품을 본사에 발주요청하시겠습니까?\n(수량 0인 상품은 제외됩니다)`)) return;
    setSubmitting(true);
    try {
      const batchId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      const payload = targets.map(r => ({
        store_name: store, branch_name: branch,
        brand_id: r.brandId ? Number(r.brandId) : null,
        product_id: Number(r.productId),
        quantity: Number(r.qty),
        status: 'pending',
        batch_id: batchId,
        request_date: today,
        safety_qty: r.soldQty,
        current_qty: r.stock,
        created_by: profile.id,
        requested_by: profile.id,
      }));
      const { error } = await supabase.from('order_requests').insert(payload);
      if (error) throw error;
      toast(`발주요청 완료 — ${targets.length}건`, 'ok');
      setTab('status');
    } catch (err) {
      toast('발주요청 실패: ' + (err.message || err), 'err');
    }
    setSubmitting(false);
  };

  // ── 발송현황 (요청 이력 + 입고확인) ──
  const [requests, setRequests] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [receiving, setReceiving] = useState({});
  const [scanTarget, setScanTarget] = useState(null); // 입고확인 바코드 스캔 대상 row
  const [scanCode, setScanCode] = useState('');

  const fetchRequests = useCallback(async () => {
    setHistLoading(true);
    const { data } = await supabase.from('order_requests')
      .select('*, brand:brands(name), product:products(name, code, erp_code)')
      .eq('store_name', store).eq('branch_name', branch)
      .order('created_at', { ascending: false })
      .limit(200);
    setRequests(data || []);
    setHistLoading(false);
  }, [store, branch]);

  useEffect(() => { if (tab === 'status') fetchRequests(); }, [tab, fetchRequests]);

  // 입고확인: 바코드 스캔 모달 → 코드 일치 시 입고
  const openScan = (r) => { setScanTarget(r); setScanCode(''); };
  const confirmScan = async () => {
    if (!scanTarget) return;
    const expected = [scanTarget.product?.code, scanTarget.product?.erp_code]
      .filter(Boolean).map(c => String(c).trim().toLowerCase());
    const scanned = scanCode.trim().toLowerCase();
    if (!scanned) { toast('바코드를 스캔해주세요', 'err'); return; }
    if (expected.length && !expected.includes(scanned)) {
      toast(`바코드 불일치 — 다른 상품입니다 (예상: ${scanTarget.product?.code || '-'})`, 'err');
      setScanCode('');
      return;
    }
    const r = scanTarget;
    setScanTarget(null);
    await doReceive(r);
  };

  const doReceive = async (r) => {
    setReceiving(prev => ({ ...prev, [r.id]: true }));
    try {
      const code = r.product?.code;
      if (!code) throw new Error('상품 코드 누락 — 본사에 문의해주세요');
      const { data: stockRow } = await supabase.from('store_stock')
        .select('id, stock_qty').eq('store_name', store).eq('branch_name', branch)
        .eq('product_code', code).maybeSingle();
      if (stockRow) {
        const { error } = await supabase.from('store_stock').update({
          stock_qty: (stockRow.stock_qty || 0) + Number(r.quantity), updated_at: new Date().toISOString(),
        }).eq('id', stockRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_stock').insert({
          store_name: store, branch_name: branch, product_code: code,
          product_name: r.product.name, stock_qty: Number(r.quantity), updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      const { error: updErr } = await supabase.from('order_requests').update({
        status: 'received', received_at: new Date().toISOString(), received_by: profile.id,
      }).eq('id', r.id);
      if (updErr) throw updErr;
      toast(`입고 처리 완료 — 매장 재고에 +${r.quantity}개 반영`, 'ok');
      fetchRequests();
    } catch (err) {
      toast('입고 실패: ' + (err.message || err), 'err');
    }
    setReceiving(prev => { const n = { ...prev }; delete n[r.id]; return n; });
  };

  const statusBadge = (s) => {
    const map = {
      pending:       { t:'⏳ 요청대기',   bg:'#fff3e0', c:'#E65100' },
      scm_requested: { t:'🚚 발송준비',   bg:'#e3f2fd', c:'#1565C0' },
      shipped:       { t:'📦 발송완료',   bg:'#f3e5f5', c:'#6a1b9a' },
      received:      { t:'✅ 입고완료',   bg:'#e8f5e9', c:'#2e7d32' },
      ordered:       { t:'📦 발주진행중', bg:'#f3e5f5', c:'#6a1b9a' },
      fulfilled:     { t:'✅ 자체완료',   bg:'#e8f5e9', c:'#2e7d32' },
      rejected:      { t:'반려',          bg:'#ffebee', c:'#c62828' },
    };
    const m = map[s] || { t:s, bg:'#f5f5f5', c:'#666' };
    return <span style={{ padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600, background:m.bg, color:m.c }}>{m.t}</span>;
  };

  const totalReqQty = rows.filter(r => r.checked && (Number(r.qty)||0) > 0).reduce((s, r) => s + (Number(r.qty)||0), 0);

  const inputStyle = { width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, outline:'none' };

  return (
    <div>
      <div className="tabbar" style={{ display:'flex', gap:4, marginBottom:14 }}>
        <button className={`tab ${tab==='stock'?'on':''}`} onClick={() => setTab('stock')}>📊 재고현황</button>
        <button className={`tab ${tab==='request'?'on':''}`} onClick={() => setTab('request')}>📝 발주요청</button>
        <button className={`tab ${tab==='status'?'on':''}`} onClick={() => setTab('status')}>📥 입고확인</button>
      </div>

      {/* ── 재고현황 ── */}
      {tab === 'stock' && <StoreStockPage profile={profile}/>}

      {/* ── 발주요청 ── */}
      {tab === 'request' && (
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
            <div>
              <div className="card-label" style={{ margin:0 }}>📝 발주요청 작성</div>
              <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>
                📍 {store} · {branch}
                {fromDate && <span style={{ marginLeft:10, color:'var(--text3)' }}>판매기간: <b>{fromDate} ~ {today}</b> (직전 발주 이후)</span>}
              </div>
            </div>
            <div style={{ position:'relative' }}>
              <input value={addSearch} onChange={e => { setAddSearch(e.target.value); setShowAdd(true); }}
                onFocus={() => setShowAdd(true)} onBlur={() => setTimeout(() => setShowAdd(false), 200)}
                placeholder="➕ 상품 추가 검색" style={{ ...inputStyle, width:240 }} autoComplete="off" />
              {showAdd && addSuggestions.length > 0 && (
                <div style={{ position:'absolute', top:'100%', right:0, zIndex:100, width:300, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:240, overflowY:'auto' }}>
                  {addSuggestions.map(p => (
                    <div key={p.id} onMouseDown={e => { e.preventDefault(); addProduct(p); }}
                      style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0' }}
                      onMouseEnter={e => e.currentTarget.style.background='#fffde7'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                      {p.brand?.name && <span style={{ fontSize:11, color:'var(--accent)', fontWeight:700, marginRight:6 }}>[{p.brand.name}]</span>}
                      {p.name}
                      {p.code && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:6, fontFamily:'var(--mono)' }}>{p.code}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {sheetLoading ? <div className="empty"><span className="spinner"/></div>
          : rows.length === 0 ? <div className="empty">매장재고에 등록된 상품이 없습니다 (상품 추가로 직접 담을 수 있습니다)</div>
          : (
            <>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width:36, textAlign:'center' }}>
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ cursor:'pointer' }}/>
                    </th>
                    <th>상품명</th>
                    <th className="r" style={{ width:110 }}>기간 판매량</th>
                    <th className="r" style={{ width:90 }}>현재고</th>
                    <th className="r" style={{ width:120 }}>발주수량</th>
                    <th style={{ width:50, textAlign:'center' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.productId} style={{ background: r.checked ? '' : '#fafafa' }}>
                      <td style={{ textAlign:'center' }}>
                        <input type="checkbox" checked={r.checked} onChange={e => setRowChecked(r.productId, e.target.checked)} style={{ cursor:'pointer' }}/>
                      </td>
                      <td style={{ fontSize:13 }}>
                        {r.brandName && <span style={{ fontSize:11, color:'var(--accent)', fontWeight:700, marginRight:6 }}>[{r.brandName}]</span>}
                        {r.name}
                        {r.code && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:6, fontFamily:'var(--mono)' }}>{r.code}</span>}
                      </td>
                      <td className="r" style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{r.soldQty.toLocaleString()}</td>
                      <td className="r" style={{ fontFamily:'var(--mono)', color: r.stock === 0 ? 'var(--danger)' : 'var(--text)' }}>{r.stock.toLocaleString()}</td>
                      <td className="r">
                        <input type="number" min={0} value={r.qty}
                          onChange={e => setRowQty(r.productId, e.target.value)}
                          style={{ width:90, height:30, padding:'0 8px', border:`1px solid ${(Number(r.qty)||0) > 0 ? 'var(--accent)' : 'var(--border)'}`, borderRadius:4, fontFamily:'var(--mono)', fontWeight:700, textAlign:'right', fontSize:13, background:(Number(r.qty)||0) > 0 ? '#fff3e0' : '#fff' }}/>
                      </td>
                      <td style={{ textAlign:'center' }}>
                        <button type="button" onClick={() => removeRow(r.productId)} title="행 삭제"
                          style={{ padding:'2px 8px', fontSize:12, border:'1px solid var(--border)', borderRadius:4, background:'#fff', color:'var(--danger)', cursor:'pointer' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, flexWrap:'wrap', gap:10 }}>
              <span style={{ fontSize:13, color:'var(--text2)' }}>
                선택 <b>{rows.filter(r => r.checked && (Number(r.qty)||0) > 0).length}</b>개 상품 · 총 <b style={{ color:'var(--accent)' }}>{totalReqQty.toLocaleString()}</b>개
              </span>
              <button className="btn btn-p" onClick={submit} disabled={submitting}
                style={{ height:42, padding:'0 28px', fontSize:14, fontWeight:700 }}>
                {submitting ? <span className="spinner"/> : '📦 발주요청'}
              </button>
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>
              · 발주수량 = 기간 판매량 − 현재고 (자동, 수정 가능) · 수량 0인 상품은 전체선택해도 본사로 전송되지 않습니다
            </div>
            </>
          )}
        </div>
      )}

      {/* ── 발송현황 ── */}
      {tab === 'status' && (
        <div className="card">
          <div className="card-label">📥 입고확인 / 발송현황</div>
          {histLoading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>요청일</th><th>브랜드</th><th>상품명</th><th className="r">수량</th><th>상태</th><th>송장</th><th style={{ width:110, textAlign:'center' }}>입고</th></tr>
                </thead>
                <tbody>
                  {requests.length === 0
                    ? <tr><td colSpan={7} className="empty">요청 내역이 없습니다</td></tr>
                    : requests.map(r => (
                      <tr key={r.id}>
                        <td className="mono" style={{ fontSize:11 }}>{r.request_date || (r.created_at||'').slice(0,10)}</td>
                        <td><span className="badge badge-dept">{r.brand?.name || '-'}</span></td>
                        <td style={{ fontSize:12 }}>{r.product?.name || '-'}</td>
                        <td className="r" style={{ fontWeight:700, color:'var(--accent)' }}>{r.quantity}</td>
                        <td>{statusBadge(r.status)}</td>
                        <td style={{ fontSize:11 }}>
                          {r.tracking_number
                            ? <button type="button" onClick={() => window.open(`https://tracker.delivery/#/kr.cjlogistics/${r.tracking_number}`, '_blank', 'noopener,noreferrer')}
                                style={{ border:'none', background:'none', color:'#1565C0', fontWeight:700, cursor:'pointer', fontFamily:'var(--mono)' }}>📦 {r.tracking_number}</button>
                            : <span style={{ color:'var(--text3)' }}>-</span>}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          {(r.status === 'shipped' || r.status === 'ordered') && (
                            <button type="button" onClick={() => openScan(r)} disabled={receiving[r.id]}
                              style={{ height:28, padding:'0 12px', border:'1px solid var(--success)', borderRadius:4, background:'#e8f5e9', color:'var(--success)', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                              {receiving[r.id] ? <span className="spinner"/> : '📥 입고확인'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 입고확인 바코드 스캔 모달 */}
      {scanTarget && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setScanTarget(null)}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }}/>
          <div style={{ position:'relative', background:'#fff', borderRadius:12, width:'min(420px, 92vw)', padding:'22px 24px', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>📥 입고확인 — 바코드 스캔</div>
            <div style={{ fontSize:13, color:'var(--text2)', marginBottom:4 }}>
              <strong>{scanTarget.product?.name}</strong> · {scanTarget.quantity}개
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14, fontFamily:'var(--mono)' }}>
              상품코드: {scanTarget.product?.code || '-'}
            </div>
            <input autoFocus value={scanCode}
              onChange={e => setScanCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmScan(); }}
              placeholder="바코드 스캔 또는 코드 입력 후 Enter"
              style={{ width:'100%', height:42, padding:'0 12px', border:'2px solid var(--accent)', borderRadius:'var(--radius)', fontSize:14, fontFamily:'var(--mono)', outline:'none' }}/>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>
              스캔한 코드가 상품과 일치하면 매장 재고에 +{scanTarget.quantity}개 반영됩니다.
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={() => setScanTarget(null)}
                style={{ height:38, padding:'0 18px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>취소</button>
              <button type="button" onClick={confirmScan}
                style={{ height:38, padding:'0 18px', border:'none', borderRadius:'var(--radius)', background:'var(--success)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>입고확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
