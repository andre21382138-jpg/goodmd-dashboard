import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob } from '../../lib/utils';
import { ORDER_CONSTANTS } from '../../lib/constants';

const STATUS_LABEL = {
  sent:        { label:'발송',        color:'#1565C0', bg:'#e3f2fd', border:'#90caf9' },
  requested:   { label:'발주요청',    color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  rerequested: { label:'재요청',      color:'#bf360c', bg:'#fbe9e7', border:'#ffab91' },
  received:    { label:'입고완료',    color:'#6a1b9a', bg:'#f3e5f5', border:'#ce93d8' },
};

async function exportPurchaseOrders() {
  // 1) 다운로드 대상 발주 fetch
  const { data: orders, error: oErr } = await supabase.from('purchase_orders')
    .select('id, store_name, branch_name, items:purchase_order_items(id, product_id, hq_qty, store_qty, product:products(name, erp_code, code))')
    .in('status', ['requested', 'rerequested'])
    .is('exported_at', null)
    .order('store_name', { ascending: true })
    .order('branch_name', { ascending: true });
  if (oErr) throw oErr;
  if (!orders || orders.length === 0) {
    return { count: 0, missingMaster: [] };
  }

  // 2) store_addresses fetch
  const { data: addrs, error: aErr } = await supabase.from('store_addresses').select('*');
  if (aErr) throw aErr;
  const addrMap = new Map();
  for (const a of (addrs || [])) {
    addrMap.set(`${a.store_name}|${a.branch_name}`, a);
  }

  // 3) 마스터 정보 미설정 매장 식별
  const missingMaster = [];
  for (const o of orders) {
    const key = `${o.store_name}|${o.branch_name}`;
    const a = addrMap.get(key);
    const ok = !!(a && a.shopping_mall_id && a.postal_code && a.address && a.recipient_phone);
    if (!ok) missingMaster.push(`${o.store_name} / ${o.branch_name}`);
  }

  // 4) 라인 펼치기 (매장 정렬 후 각 발주의 items도 product name 정렬)
  const lines = [];
  for (const o of orders) {
    const items = [...(o.items || [])].sort((a, b) =>
      (a.product?.name || '').localeCompare(b.product?.name || ''));
    for (const it of items) {
      lines.push({ order: o, item: it });
    }
  }

  // 5) 발송일 + 주문번호 생성
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyymmdd = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const yyyy_mm_dd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // 6) ExcelJS 워크북 생성
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('매장발주');
  const HEADERS = ['발송일','송장번호','주문번호','채널','매장명','수취인명','결제금액','주문수량','상품명','옵션','품명','수취인명','우편번호','주소','수취인 천화번호1','수취인 전화번호2','배송메세지','상품번호','주문자명','주문자 연락처1','주문자 연락처2','수수료','수수료액','공란','사방넷 주문번호','주문일','주문자 ID','물류바코드(88코드)','송장전송일','ERP코드','수량'];
  const headerRow = ws.addRow(HEADERS);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // 7) 라인 별 행 추가
  lines.forEach((ln, idx) => {
    const o = ln.order;
    const it = ln.item;
    const a = addrMap.get(`${o.store_name}|${o.branch_name}`) || {};
    const qty = (it.store_qty != null) ? Number(it.store_qty) : Number(it.hq_qty || 0);
    const orderNo = `${yyyymmdd}-${String(idx + 1).padStart(4, '0')}`;
    const erp = it.product?.erp_code || '';
    const productName = it.product?.name || '';
    const mallId = a.shopping_mall_id || '';
    ws.addRow([
      today,                              // A 발송일
      ORDER_CONSTANTS.TRACKING_LABEL,     // B 송장번호
      orderNo,                            // C 주문번호
      ORDER_CONSTANTS.CHANNEL,            // D 채널
      mallId,                             // E 매장명
      mallId,                             // F 수취인명
      0,                                  // G 결제금액
      1,                                  // H 주문수량
      '',                                 // I 상품명
      '',                                 // J 옵션
      productName,                        // K 품명
      mallId,                             // L 수취인명
      a.postal_code || '',                // M 우편번호
      a.address || '',                    // N 주소
      a.recipient_phone || '',            // O 수취인 천화번호1
      '',                                 // P 수취인 전화번호2
      '',                                 // Q 배송메세지
      '',                                 // R 상품번호
      ORDER_CONSTANTS.ORDERER_NAME,       // S 주문자명
      ORDER_CONSTANTS.ORDERER_PHONE,      // T 주문자 연락처1
      ORDER_CONSTANTS.ORDERER_PHONE,      // U 주문자 연락처2
      '', '', '', '', '', '', '', '',     // V~AC
      erp,                                // AD ERP코드
      qty,                                // AE 수량
    ]);
  });

  // 8) 발송일 셀 서식
  ws.getColumn(1).numFmt = 'yyyy-mm-dd';

  // 9) 저장 + 다운로드
  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `매장발주_${yyyy_mm_dd}.xlsx`);

  // 10) 다운로드된 발주들의 exported_at 일괄 update
  const orderIds = orders.map(o => o.id);
  const { error: uErr } = await supabase.from('purchase_orders')
    .update({ exported_at: new Date().toISOString() })
    .in('id', orderIds);
  if (uErr) throw uErr;

  return { count: orderIds.length, missingMaster };
}

const fmt = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};

const lastWeekRange = () => {
  const today = new Date();
  const day = today.getDay();
  const daysToThisMon = day === 0 ? 6 : day - 1;
  const thisMon = new Date(today); thisMon.setDate(today.getDate() - daysToThisMon);
  const lastSun = new Date(thisMon); lastSun.setDate(thisMon.getDate() - 1);
  const lastMon = new Date(lastSun); lastMon.setDate(lastSun.getDate() - 6);
  return { start: fmt(lastMon), end: fmt(lastSun) };
};

export default function PurchaseOrderHQPage({ profile }) {
  const [tab, setTab] = useState('create'); // 'create' | 'status'
  const initRange = lastWeekRange();
  const [fFrom, setFFrom] = useState(initRange.start);
  const [fTo,   setFTo]   = useState(initRange.end);

  // 집계 데이터
  const [aggLoading, setAggLoading] = useState(false);
  const [aggRows,    setAggRows]    = useState([]); // [{store, branch, items:[{product_id, name, code, sold_qty, hq_qty, checked}]}]
  const [confirmStep,setConfirmStep]= useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 발주 현황
  const [orders,        setOrders]        = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // 상품 추가 (전체 상품)
  const [allProducts, setAllProducts] = useState([]);
  const [addSearch,   setAddSearch]   = useState({}); // { storeKey: searchText }
  const [addSugOpen,  setAddSugOpen]  = useState({}); // { storeKey: bool }

  useEffect(() => {
    if (tab === 'create' && allProducts.length === 0) {
      supabase.from('products').select('id, name, code, brand_id').order('name')
        .then(({ data }) => setAllProducts(data || []));
    }
  }, [tab, allProducts.length]);

  // ── 1. 지난주 판매 집계 ──
  const fetchAggregation = useCallback(async () => {
    setAggLoading(true);
    setConfirmStep(false);
    const { data, error } = await supabase.from('sales')
      .select('store_name, branch_name, product_id, quantity, returned_qty, product:products(name,code)')
      .gte('sold_at', fFrom).lte('sold_at', fTo);
    if (error) { toast(error.message, 'err'); setAggLoading(false); return; }
    // 집계: store+branch+product_id 별로 effQty 합산
    const map = new Map();
    for (const r of (data || [])) {
      if (!r.product_id) continue;
      const eff = Math.max(0, (r.quantity||0) - (r.returned_qty||0));
      if (eff <= 0) continue;
      const key = `${r.store_name}|${r.branch_name}`;
      if (!map.has(key)) map.set(key, { store: r.store_name, branch: r.branch_name, items: new Map() });
      const grp = map.get(key);
      const pid = r.product_id;
      if (!grp.items.has(pid)) grp.items.set(pid, { product_id: pid, name: r.product?.name, code: r.product?.code, sold_qty: 0 });
      grp.items.get(pid).sold_qty += eff;
    }
    const result = [];
    for (const grp of map.values()) {
      const items = [...grp.items.values()]
        .sort((a,b) => (a.name||'').localeCompare(b.name||''))
        .map(it => ({ ...it, hq_qty: it.sold_qty, checked: true }));
      result.push({ store: grp.store, branch: grp.branch, items });
    }
    result.sort((a,b) => `${a.store}${a.branch}`.localeCompare(`${b.store}${b.branch}`));
    setAggRows(result);
    setAggLoading(false);
  }, [fFrom, fTo]);

  useEffect(() => { if (tab === 'create') fetchAggregation(); }, [tab, fetchAggregation]);

  const totalChecked = useMemo(() => aggRows.reduce((s,g) => s + g.items.filter(i => i.checked).length, 0), [aggRows]);

  const toggleItem = (storeKey, pid) => {
    setAggRows(prev => prev.map(g => {
      if (`${g.store}|${g.branch}` !== storeKey) return g;
      return { ...g, items: g.items.map(it => it.product_id === pid ? { ...it, checked: !it.checked } : it) };
    }));
  };
  const toggleStore = (storeKey, on) => {
    setAggRows(prev => prev.map(g => {
      if (`${g.store}|${g.branch}` !== storeKey) return g;
      return { ...g, items: g.items.map(it => ({ ...it, checked: on })) };
    }));
  };
  const toggleAll = (on) => {
    setAggRows(prev => prev.map(g => ({ ...g, items: g.items.map(it => ({ ...it, checked: on })) })));
  };

  // 상품 수동 추가
  const addProductToStore = (storeKey, product) => {
    setAggRows(prev => prev.map(g => {
      if (`${g.store}|${g.branch}` !== storeKey) return g;
      // 이미 있는지 확인
      const existing = g.items.find(i => i.product_id === product.id);
      if (existing) {
        return { ...g, items: g.items.map(i => i.product_id === product.id ? { ...i, checked: true } : i) };
      }
      const newItem = {
        product_id: product.id,
        name: product.name,
        code: product.code,
        sold_qty: 0,
        hq_qty: 1,
        checked: true,
        manual: true,
      };
      return { ...g, items: [...g.items, newItem] };
    }));
    setAddSearch(prev => ({ ...prev, [storeKey]: '' }));
    setAddSugOpen(prev => ({ ...prev, [storeKey]: false }));
  };

  const removeManualItem = (storeKey, pid) => {
    setAggRows(prev => prev.map(g => {
      if (`${g.store}|${g.branch}` !== storeKey) return g;
      return { ...g, items: g.items.filter(i => !(i.product_id === pid && i.manual)) };
    }));
  };

  const getSuggestions = (storeKey) => {
    const q = (addSearch[storeKey] || '').toLowerCase().trim();
    if (!q) return [];
    return allProducts
      .filter(p => (p.name||'').toLowerCase().includes(q) || (p.code||'').toLowerCase().includes(q))
      .slice(0, 10);
  };

  const updateQty = (storeKey, pid, qty) => {
    setAggRows(prev => prev.map(g => {
      if (`${g.store}|${g.branch}` !== storeKey) return g;
      return { ...g, items: g.items.map(it => it.product_id === pid ? { ...it, hq_qty: Math.max(0, Number(qty)||0) } : it) };
    }));
  };

  // ── 2. 발주 진행 (DB insert) ──
  const handleSubmitOrders = async () => {
    const checkedGroups = aggRows
      .map(g => ({ ...g, items: g.items.filter(i => i.checked && i.hq_qty > 0) }))
      .filter(g => g.items.length > 0);
    if (checkedGroups.length === 0) { toast('발주할 상품이 없습니다', 'err'); return; }
    if (!window.confirm(`${checkedGroups.length}개 매장에 발주를 진행하시겠습니까?\n총 상품 종류: ${checkedGroups.reduce((s,g)=>s+g.items.length,0)}개`)) return;

    setSubmitting(true);
    try {
      for (const g of checkedGroups) {
        const { data: order, error: oErr } = await supabase.from('purchase_orders').insert({
          store_name: g.store,
          branch_name: g.branch,
          week_start: fFrom,
          week_end: fTo,
          status: 'sent',
          created_by: profile.id,
        }).select().single();
        if (oErr) throw oErr;
        const itemRows = g.items.map(it => ({
          order_id: order.id,
          product_id: it.product_id,
          sold_qty: it.sold_qty,
          hq_qty: it.hq_qty,
        }));
        const { error: iErr } = await supabase.from('purchase_order_items').insert(itemRows);
        if (iErr) throw iErr;
      }
      toast('발주 발송 완료', 'ok');
      setConfirmStep(false);
      setTab('status');
    } catch (err) {
      toast('발주 실패: ' + err.message, 'err');
    }
    setSubmitting(false);
  };

  // ── 3. 발주 현황 조회 ──
  const fetchOrders = useCallback(async () => {
    setStatusLoading(true);
    const { data, error } = await supabase.from('purchase_orders')
      .select('*, items:purchase_order_items(*, product:products(name, code, erp_code))')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) toast(error.message, 'err');
    else setOrders(data || []);
    setStatusLoading(false);
  }, []);

  useEffect(() => { if (tab === 'status') fetchOrders(); }, [tab, fetchOrders]);

  const inputStyle = { height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'#fff', outline:'none' };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='create'?'on':''}`} onClick={() => setTab('create')}>발주 진행</button>
        <button className={`tab ${tab==='status'?'on':''}`} onClick={() => setTab('status')}>발주 현황</button>
      </div>

      {/* ── 발주 진행 ── */}
      {tab === 'create' && (
        <>
          <div className="card">
            <div className="card-label">📅 지난주 판매 집계</div>
            <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
              <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)}/>
              <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
              <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)}/>
              <button className="btn btn-s" onClick={() => { const r = lastWeekRange(); setFFrom(r.start); setFTo(r.end); }}>지난주</button>
              <div className="fbar-right">
                <button className="btn btn-p" onClick={fetchAggregation} disabled={aggLoading}>
                  {aggLoading ? <span className="spinner"/> : '🔍 조회'}
                </button>
              </div>
            </div>
            <div style={{fontSize:11, color:'var(--text3)', marginTop:6, fontFamily:'var(--mono)'}}>
              💡 {fFrom} ~ {fTo} 기간에 1개라도 판매된 상품을 매장별로 집계합니다.
            </div>
          </div>

          {!confirmStep && aggRows.length === 0 && !aggLoading && (
            <div className="empty">선택한 기간에 판매 데이터가 없습니다</div>
          )}

          {!confirmStep && aggRows.length > 0 && (
            <div className="card" style={{padding:'16px 20px'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8}}>
                <span className="fresult"><b>{aggRows.length}</b>개 매장 · 선택된 상품 <b>{totalChecked}</b>개</span>
                <div style={{display:'flex', gap:6}}>
                  <button className="btn btn-s" onClick={() => toggleAll(true)}>전체선택</button>
                  <button className="btn btn-s" onClick={() => toggleAll(false)}>전체해제</button>
                  <button className="btn btn-p" disabled={totalChecked === 0} onClick={() => setConfirmStep(true)}>
                    📋 발주진행 ({totalChecked})
                  </button>
                </div>
              </div>

              {aggRows.map(g => {
                const sk = `${g.store}|${g.branch}`;
                const allOn = g.items.length > 0 && g.items.every(i => i.checked);
                const sug = getSuggestions(sk);
                return (
                <div key={sk} style={{marginBottom:14, border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'visible'}}>
                  <div style={{background:'#f5f7fa', padding:'8px 14px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--border)'}}>
                    <input type="checkbox" checked={allOn} onChange={() => toggleStore(sk, !allOn)} style={{cursor:'pointer'}}/>
                    <strong>{g.store} · {g.branch}</strong>
                    <span style={{fontSize:11, color:'var(--text3)'}}>{g.items.length}개 상품</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{width:36}}></th>
                        <th>상품명</th>
                        <th>코드</th>
                        <th className="r">판매수량</th>
                        <th style={{width:40}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map(it => (
                        <tr key={it.product_id}>
                          <td style={{textAlign:'center'}}>
                            <input type="checkbox" checked={it.checked}
                              onChange={() => toggleItem(sk, it.product_id)}
                              style={{cursor:'pointer'}}/>
                          </td>
                          <td>
                            {it.name || '-'}
                            {it.manual && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#1565C0', background:'#e3f2fd', border:'1px solid #90caf9', padding:'1px 6px', borderRadius:3}}>추가</span>}
                          </td>
                          <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.code || '-'}</td>
                          <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color: it.manual ? 'var(--text3)' : 'var(--text)'}}>
                            {it.manual ? '-' : it.sold_qty}
                          </td>
                          <td style={{textAlign:'center'}}>
                            {it.manual && (
                              <button type="button" onClick={() => removeManualItem(sk, it.product_id)}
                                title="추가 상품 삭제"
                                style={{background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:14}}>✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* 상품 추가 영역 */}
                  <div style={{padding:'10px 14px', borderTop:'1px solid var(--border)', background:'#fafafa', position:'relative'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:11, fontWeight:700, color:'var(--text2)'}}>+ 상품 추가</span>
                      <div style={{position:'relative', flex:1, maxWidth:360}}>
                        <input
                          value={addSearch[sk] || ''}
                          onChange={e => { setAddSearch(prev => ({...prev, [sk]: e.target.value})); setAddSugOpen(prev => ({...prev, [sk]: true})); }}
                          onFocus={() => setAddSugOpen(prev => ({...prev, [sk]: true}))}
                          onBlur={() => setTimeout(() => setAddSugOpen(prev => ({...prev, [sk]: false})), 200)}
                          placeholder="상품명 또는 상품코드 검색"
                          style={{width:'100%', height:32, padding:'0 10px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, outline:'none', boxSizing:'border-box', background:'#fff'}}/>
                        {addSugOpen[sk] && sug.length > 0 && (
                          <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', border:'1px solid var(--border)', borderRadius:4, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:200, overflowY:'auto', marginTop:2}}>
                            {sug.map(p => (
                              <div key={p.id}
                                onMouseDown={e => { e.preventDefault(); addProductToStore(sk, p); }}
                                style={{padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid #f0f0f0'}}
                                onMouseEnter={e => e.currentTarget.style.background='#f5f7fa'}
                                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                                <div>{p.name}</div>
                                {p.code && <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>코드: {p.code}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span style={{fontSize:10, color:'var(--text3)'}}>※ 지난주 미판매 상품 추가 가능</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}

          {/* 확인 단계 (수량 수정) */}
          {confirmStep && (
            <div className="card" style={{padding:'16px 20px'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                <div style={{fontSize:14, fontWeight:700}}>📋 발주 수량 확인 (수정 가능)</div>
                <div style={{display:'flex', gap:6}}>
                  <button className="btn btn-s" onClick={() => setConfirmStep(false)}>← 뒤로</button>
                  <button className="btn btn-p" onClick={handleSubmitOrders} disabled={submitting}>
                    {submitting ? <span className="spinner"/> : '✓ 확인 (발주 발송)'}
                  </button>
                </div>
              </div>

              {aggRows.filter(g => g.items.some(i => i.checked)).map(g => {
                const sk = `${g.store}|${g.branch}`;
                const checkedItems = g.items.filter(i => i.checked);
                return (
                <div key={sk} style={{marginBottom:14, border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden'}}>
                  <div style={{background:'#f5f7fa', padding:'8px 14px', borderBottom:'1px solid var(--border)'}}>
                    <strong>{g.store} · {g.branch}</strong>
                    <span style={{fontSize:11, color:'var(--text3)', marginLeft:8}}>{checkedItems.length}개 상품</span>
                  </div>
                  <table>
                    <thead>
                      <tr><th>상품명</th><th>코드</th><th className="r">판매수량</th><th className="r" style={{width:130}}>발주수량</th></tr>
                    </thead>
                    <tbody>
                      {checkedItems.map(it => (
                        <tr key={it.product_id}>
                          <td>{it.name}</td>
                          <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.code || '-'}</td>
                          <td className="r" style={{color:'var(--text3)'}}>{it.sold_qty}</td>
                          <td className="r">
                            <input type="number" min={0} value={it.hq_qty}
                              onChange={e => updateQty(sk, it.product_id, e.target.value)}
                              style={{...inputStyle, width:90, height:30, textAlign:'right', fontWeight:700}}/>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )})}
            </div>
          )}
        </>
      )}

      {/* ── 발주 현황 ── */}
      {tab === 'status' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
            <div className="card-label" style={{margin:0}}>📊 발주 현황</div>
            <button className="btn btn-s" onClick={fetchOrders} disabled={statusLoading}>
              {statusLoading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>
          {statusLoading ? <div className="empty"><span className="spinner"/></div>
            : orders.length === 0 ? <div className="empty">발주 내역이 없습니다</div>
            : <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th style={{width:30}}></th>
                    <th>발주일</th>
                    <th>매장</th>
                    <th>지점</th>
                    <th>대상기간</th>
                    <th className="r">상품수</th>
                    <th style={{textAlign:'center'}}>상태</th>
                    <th>최근 업데이트</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const open = expandedOrder === o.id;
                    const st = STATUS_LABEL[o.status] || { label:o.status, color:'#666', bg:'#f5f5f5', border:'#ddd' };
                    return (
                    <React.Fragment key={o.id}>
                      <tr style={{cursor:'pointer', background: open ? '#f8f9fa' : 'transparent'}}
                        onClick={() => setExpandedOrder(open ? null : o.id)}>
                        <td style={{textAlign:'center', color:'var(--text2)'}}>{open ? '▼' : '▶'}</td>
                        <td className="mono" style={{fontSize:11}}>{new Date(o.created_at).toLocaleDateString('ko-KR')}</td>
                        <td><span className="badge badge-dept">{o.store_name}</span></td>
                        <td><span className="badge badge-store">{o.branch_name}</span></td>
                        <td className="mono" style={{fontSize:11}}>{o.week_start} ~ {o.week_end}</td>
                        <td className="r">{o.items?.length || 0}</td>
                        <td style={{textAlign:'center'}}>
                          <span style={{display:'inline-block', padding:'2px 10px', borderRadius:4, fontSize:11, fontWeight:700,
                            background:st.bg, color:st.color, border:`1px solid ${st.border}`}}>{st.label}</span>
                        </td>
                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{new Date(o.updated_at||o.created_at).toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={8} style={{background:'#fff', padding:'12px 18px', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)'}}>
                            {o.store_note && (
                              <div style={{padding:'8px 12px', background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:4, fontSize:12, marginBottom:10}}>
                                💬 매장 메모: {o.store_note}
                              </div>
                            )}
                            <div className="twrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>상품명</th><th>코드</th>
                                    <th className="r">판매수량</th>
                                    <th className="r">본사 발주</th>
                                    <th className="r">매장 요청</th>
                                    <th className="r">변동</th>
                                    <th className="r">입고확인</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(o.items||[]).map(it => {
                                    const finalQty = it.store_qty != null ? it.store_qty : it.hq_qty;
                                    const diff = it.store_qty != null ? (it.store_qty - it.hq_qty) : 0;
                                    return (
                                    <tr key={it.id}>
                                      <td>{it.product?.name||'-'}</td>
                                      <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.product?.code||'-'}</td>
                                      <td className="r" style={{color:'var(--text3)'}}>{it.sold_qty}</td>
                                      <td className="r" style={{fontFamily:'var(--mono)'}}>{it.hq_qty}</td>
                                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight: it.store_qty != null ? 700 : 400, color: it.store_qty != null ? 'var(--accent)' : 'var(--text3)'}}>
                                        {it.store_qty != null ? it.store_qty : '-'}
                                      </td>
                                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text3)'}}>
                                        {diff > 0 ? `+${diff}` : diff < 0 ? diff : '-'}
                                      </td>
                                      <td className="r" style={{fontFamily:'var(--mono)'}}>
                                        {it.received_qty != null
                                          ? <span style={{color: it.received_ok ? 'var(--success)' : 'var(--danger)', fontWeight:700}}>
                                              {it.received_qty} {it.received_ok ? '✅' : '❌'}
                                            </span>
                                          : '-'}
                                      </td>
                                    </tr>
                                  )})}
                                </tbody>
                              </table>
                            </div>
                            <div style={{marginTop:8, fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)', textAlign:'right'}}>
                              본사 발주 합계: {(o.items||[]).reduce((s,i)=>s+i.hq_qty,0)}개 ·
                              매장 요청 합계: {(o.items||[]).reduce((s,i)=>s+(i.store_qty != null ? i.store_qty : i.hq_qty),0)}개
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )})}
                </tbody>
              </table>
            </div>
          }
        </div>
      )}
    </div>
  );
}
