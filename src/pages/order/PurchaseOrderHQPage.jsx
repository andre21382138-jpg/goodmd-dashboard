import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob } from '../../lib/utils';
import { ORDER_CONSTANTS } from '../../lib/constants';
import StockRequestsAdminView from './StockRequestsAdminView';

const STATUS_LABEL = {
  sent:        { label:'발송',        color:'#1565C0', bg:'#e3f2fd', border:'#90caf9' },
  requested:   { label:'발주요청',    color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  rerequested: { label:'재요청',      color:'#bf360c', bg:'#fbe9e7', border:'#ffab91' },
  confirmed:   { label:'확정',        color:'#bf360c', bg:'#fff3e0', border:'#ffcc80' },
  received:    { label:'입고완료',    color:'#6a1b9a', bg:'#f3e5f5', border:'#ce93d8' },
};

async function exportPurchaseOrders({ orderIds = null } = {}) {
  // 1) 다운로드 대상 발주 fetch
  //    - orderIds=null (기본): status='confirmed' AND exported_at IS NULL (배치 다운로드)
  //    - orderIds=[...] : 해당 ID만 (재다운로드) — exported_at 무관
  let q = supabase.from('purchase_orders')
    .select('id, store_name, branch_name, items:purchase_order_items(id, product_id, hq_qty, store_qty, product:products(name, erp_code, code))')
    .order('store_name', { ascending: true })
    .order('branch_name', { ascending: true });
  if (orderIds && orderIds.length > 0) {
    q = q.in('id', orderIds);
  } else {
    q = q.eq('status', 'confirmed').is('exported_at', null);
  }
  const { data: orders, error: oErr } = await q;
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
  const downloadedIds = orders.map(o => o.id);
  const { error: uErr } = await supabase.from('purchase_orders')
    .update({ exported_at: new Date().toISOString() })
    .in('id', downloadedIds);
  if (uErr) throw uErr;

  return { count: downloadedIds.length, missingMaster };
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
  // 초기 탭 — NotificationCenter가 localStorage에 'open_purchase_hq_tab'='stock_request' 같은
  // hint를 남기면 그 탭으로 진입. 사용 후 즉시 삭제하여 다음 방문 때는 기본 탭으로 돌아감.
  const [tab, setTab] = useState(() => {
    try {
      const hint = localStorage.getItem('open_purchase_hq_tab');
      if (hint) { localStorage.removeItem('open_purchase_hq_tab'); return hint; }
    } catch {}
    return 'create';
  }); // 'create' | 'status' | 'stock_request'
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
  const [exporting,     setExporting]     = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [confirmEditMap, setConfirmEditMap] = useState({}); // { itemId: qty }
  const [confirming, setConfirming] = useState(false);

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
      .select('store_name, branch_name, product_id, quantity, returned_qty, delivery_type, product:products(name,code)')
      .gte('sold_at', fFrom).lte('sold_at', fTo);
    if (error) { toast(error.message, 'err'); setAggLoading(false); return; }

    // 같은 주에 이미 발주된 라인 fetch → 중복 발주 방지용
    const { data: existing } = await supabase.from('purchase_orders')
      .select('store_name, branch_name, items:purchase_order_items(product_id)')
      .eq('week_start', fFrom).eq('week_end', fTo);
    const orderedKeys = new Set();
    for (const o of (existing || [])) {
      for (const it of (o.items || [])) {
        orderedKeys.add(`${o.store_name}|${o.branch_name}|${it.product_id}`);
      }
    }

    // 센터재고 fetch → product_id 별 합산
    const { data: centerRows } = await supabase.from('center_stock').select('product_id, quantity');
    const centerStockMap = new Map(); // product_id → total quantity
    for (const c of (centerRows || [])) {
      centerStockMap.set(c.product_id, (centerStockMap.get(c.product_id) || 0) + (c.quantity || 0));
    }

    // 집계: store+branch+product_id 별로 effQty 합산
    // 단, 본사 발송 요청건(delivery_type='hq')은 본사에서 대신 발송하므로 매장 발주에서 제외
    const map = new Map();
    for (const r of (data || [])) {
      if (!r.product_id) continue;
      if (r.delivery_type === 'hq') continue;
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
        .map(it => {
          const alreadyOrdered = orderedKeys.has(`${grp.store}|${grp.branch}|${it.product_id}`);
          const center_stock = centerStockMap.get(it.product_id) || 0;
          return { ...it, hq_qty: it.sold_qty, checked: !alreadyOrdered, alreadyOrdered, center_stock };
        });
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
      return { ...g, items: g.items.map(it => (it.product_id === pid && !it.alreadyOrdered) ? { ...it, checked: !it.checked } : it) };
    }));
  };
  const toggleStore = (storeKey, on) => {
    setAggRows(prev => prev.map(g => {
      if (`${g.store}|${g.branch}` !== storeKey) return g;
      return { ...g, items: g.items.map(it => it.alreadyOrdered ? it : { ...it, checked: on }) };
    }));
  };
  const toggleAll = (on) => {
    setAggRows(prev => prev.map(g => ({ ...g, items: g.items.map(it => it.alreadyOrdered ? it : { ...it, checked: on }) })));
  };

  // 상품 수동 추가
  const addProductToStore = (storeKey, product) => {
    setAggRows(prev => prev.map(g => {
      if (`${g.store}|${g.branch}` !== storeKey) return g;
      // 이미 있는지 확인
      const existing = g.items.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.alreadyOrdered) {
          toast('이미 같은 주에 발주된 상품입니다', 'inf');
          return g;
        }
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
        alreadyOrdered: false,
        center_stock: 0,
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
      .map(g => ({ ...g, items: g.items.filter(i => i.checked && i.hq_qty > 0 && !i.alreadyOrdered) }))
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

  const handleReexport = async (orderId) => {
    const ok = window.confirm(
      '⚠️ 재다운로드 경고\n\n' +
      '이 발주는 이미 한 번 다운로드되어 외부 시스템에 발주가 진행 중일 수 있습니다.\n' +
      '재다운로드 파일을 다시 업로드하면 이중 발주가 발생합니다.\n\n' +
      '꼭 필요한 경우에만 진행하세요.\n\n' +
      '재다운로드 하시겠습니까?'
    );
    if (!ok) return;
    if (exporting) return;
    setExporting(true);
    try {
      const { count } = await exportPurchaseOrders({ orderIds: [orderId] });
      if (count > 0) toast(`재다운로드 완료 (${count}건)`, 'ok');
      else toast('재다운로드 실패: 발주를 찾을 수 없습니다', 'err');
      fetchOrders();
    } catch (err) {
      toast('재다운로드 실패: ' + (err.message || err), 'err');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // 미리 조회해서 미설정 매장 확인
      const { data: previewOrders, error: pErr } = await supabase.from('purchase_orders')
        .select('store_name, branch_name')
        .eq('status', 'confirmed')
        .is('exported_at', null);
      if (pErr) throw pErr;
      if (!previewOrders || previewOrders.length === 0) {
        toast('다운로드 대상 발주가 없습니다', 'inf');
        setExporting(false);
        return;
      }

      const { data: addrs, error: aErr } = await supabase.from('store_addresses').select('*');
      if (aErr) throw aErr;
      const addrMap = new Map();
      for (const a of (addrs || [])) addrMap.set(`${a.store_name}|${a.branch_name}`, a);
      const missing = [];
      const seen = new Set();
      for (const o of previewOrders) {
        const k = `${o.store_name}|${o.branch_name}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const a = addrMap.get(k);
        const ok = !!(a && a.shopping_mall_id && a.postal_code && a.address && a.recipient_phone);
        if (!ok) missing.push(`${o.store_name} / ${o.branch_name}`);
      }
      if (missing.length > 0) {
        const sample = missing.slice(0, 5).join('\n  ');
        const more = missing.length > 5 ? `\n  ... 외 ${missing.length - 5}개` : '';
        const ok = window.confirm(
          `⚠️ ${missing.length}개 매장 마스터 정보 미설정\n  ${sample}${more}\n\n빈 셀로 다운로드하시겠습니까?`
        );
        if (!ok) {
          toast('매장 정보 → 매장주소정보 메뉴에서 보충 후 재시도해주세요', 'inf');
          setExporting(false);
          return;
        }
      }

      const { count } = await exportPurchaseOrders();
      toast(`매장발주 ${count}건 다운로드 완료`, 'ok');
      fetchOrders();
    } catch (err) {
      toast('다운로드 실패: ' + (err.message || err), 'err');
    } finally {
      setExporting(false);
    }
  };

  const toggleExpandWithEdit = (o) => {
    if (expandedOrder === o.id) {
      setExpandedOrder(null);
      setConfirmEditMap({});
    } else {
      // 편집 가능 상태인 경우 input 초기값 채우기
      if (o.status === 'requested' || o.status === 'rerequested') {
        const em = {};
        for (const it of (o.items||[])) {
          em[it.id] = it.store_qty != null ? it.store_qty : it.hq_qty;
        }
        setConfirmEditMap(em);
      } else {
        setConfirmEditMap({});
      }
      setExpandedOrder(o.id);
    }
  };

  const handleConfirm = async (order) => {
    const items = order.items || [];
    if (items.length === 0) { toast('항목이 없습니다', 'err'); return; }
    if (!window.confirm(`발주를 확정하시겠습니까?\n\n총 ${items.length}개 상품, ${items.reduce((s,i) => s + (Number(confirmEditMap[i.id])||0), 0)}개 수량으로 확정됩니다.`)) return;
    setConfirming(true);
    try {
      // 각 item hq_qty 업데이트
      for (const it of items) {
        const newQty = Math.max(0, Number(confirmEditMap[it.id]) || 0);
        const { error } = await supabase.from('purchase_order_items')
          .update({ hq_qty: newQty })
          .eq('id', it.id);
        if (error) throw error;
      }
      // order status 'confirmed'로
      const { error: oErr } = await supabase.from('purchase_orders')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (oErr) throw oErr;
      toast('발주 확정 완료', 'ok');
      setExpandedOrder(null);
      setConfirmEditMap({});
      fetchOrders();
    } catch (err) {
      toast('확정 실패: ' + (err.message || err), 'err');
    }
    setConfirming(false);
  };

  const inputStyle = { height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, background:'#fff', outline:'none' };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='create'?'on':''}`} onClick={() => setTab('create')}>발주 진행</button>
        <button className={`tab ${tab==='status'?'on':''}`} onClick={() => setTab('status')}>발주 현황</button>
        <button className={`tab ${tab==='stock_request'?'on':''}`} onClick={() => setTab('stock_request')}>매장 재고요청</button>
        <button className={`tab ${tab==='stock_completed'?'on':''}`} onClick={() => setTab('stock_completed')}>매장 발주완료</button>
      </div>

      {tab === 'stock_request'   && <StockRequestsAdminView mode="pending"   profile={profile}/>}
      {tab === 'stock_completed' && <StockRequestsAdminView mode="completed" profile={profile}/>}

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
                  <button className="btn btn-p" disabled={totalChecked === 0 || submitting} onClick={handleSubmitOrders}>
                    {submitting ? <span className="spinner"/> : `📋 발주진행 (${totalChecked})`}
                  </button>
                </div>
              </div>

              {aggRows.map(g => {
                const sk = `${g.store}|${g.branch}`;
                const selectable = g.items.filter(i => !i.alreadyOrdered);
                const allOn = selectable.length > 0 && selectable.every(i => i.checked);
                const orderedCount = g.items.filter(i => i.alreadyOrdered).length;
                const sug = getSuggestions(sk);
                return (
                <div key={sk} style={{marginBottom:14, border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'visible'}}>
                  <div style={{background:'#f5f7fa', padding:'8px 14px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid var(--border)'}}>
                    <input type="checkbox" checked={allOn} disabled={selectable.length === 0}
                      onChange={() => toggleStore(sk, !allOn)} style={{cursor: selectable.length === 0 ? 'not-allowed' : 'pointer'}}/>
                    <strong>{g.store} · {g.branch}</strong>
                    <span style={{fontSize:11, color:'var(--text3)'}}>{g.items.length}개 상품</span>
                    {orderedCount > 0 && (
                      <span style={{fontSize:11, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 8px', borderRadius:3}}>
                        📋 발주 완료 {orderedCount}건
                      </span>
                    )}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{width:36}}></th>
                        <th>상품명</th>
                        <th>코드</th>
                        <th className="r" style={{width:80}}>센터재고</th>
                        <th className="r">판매수량</th>
                        <th className="r" style={{width:120}}>발주수량</th>
                        <th style={{width:40}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map(it => (
                        <tr key={it.product_id} style={it.alreadyOrdered ? {background:'#fafafa', opacity:0.7} : undefined}>
                          <td style={{textAlign:'center'}}>
                            {it.alreadyOrdered ? (
                              <span title="이미 같은 주에 발주된 라인" style={{fontSize:14}}>📋</span>
                            ) : (
                              <input type="checkbox" checked={it.checked}
                                onChange={() => toggleItem(sk, it.product_id)}
                                style={{cursor:'pointer'}}/>
                            )}
                          </td>
                          <td>
                            {it.name || '-'}
                            {it.manual && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#1565C0', background:'#e3f2fd', border:'1px solid #90caf9', padding:'1px 6px', borderRadius:3}}>추가</span>}
                            {it.alreadyOrdered && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 6px', borderRadius:3}}>📋 발주 완료</span>}
                          </td>
                          <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.code || '-'}</td>
                          <td className="r" style={{fontFamily:'var(--mono)', color: (it.center_stock || 0) === 0 ? 'var(--text3)' : 'var(--text)'}}>
                            {(it.center_stock || 0).toLocaleString()}
                          </td>
                          <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color: it.manual ? 'var(--text3)' : 'var(--text)'}}>
                            {it.manual ? '-' : it.sold_qty}
                          </td>
                          <td className="r">
                            {it.alreadyOrdered ? (
                              <span style={{fontFamily:'var(--mono)', color:'var(--text3)'}}>{it.hq_qty}</span>
                            ) : (
                              <input type="number" min={0} value={it.hq_qty}
                                onChange={e => updateQty(sk, it.product_id, e.target.value)}
                                disabled={!it.checked}
                                style={{width:80, height:28, padding:'0 8px', border:`1px solid ${it.checked?'var(--accent)':'var(--border)'}`, borderRadius:4, fontFamily:'var(--mono)', fontWeight:700, textAlign:'right', fontSize:12, background: it.checked ? '#fff3e0' : '#f5f5f5'}}/>
                            )}
                          </td>
                          <td style={{textAlign:'center'}}>
                            {it.manual && !it.alreadyOrdered && (
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
                      <tr>
                        <th>상품명</th>
                        <th>코드</th>
                        <th className="r" style={{width:80}}>센터재고</th>
                        <th className="r">판매수량</th>
                        <th className="r" style={{width:130}}>발주수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkedItems.map(it => (
                        <tr key={it.product_id}>
                          <td>{it.name}</td>
                          <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.code || '-'}</td>
                          <td className="r" style={{fontFamily:'var(--mono)', color: (it.center_stock || 0) === 0 ? 'var(--text3)' : 'var(--text)'}}>
                            {(it.center_stock || 0).toLocaleString()}
                          </td>
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
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-p" onClick={handleExport} disabled={exporting}
                title="확정된 미출하 발주를 한 번에 묶어 매장발주 양식 xlsx 다운로드">
                {exporting ? <span className="spinner"/> : '📥'} 매장발주 엑셀 다운로드
              </button>
              <button className="btn btn-s" onClick={fetchOrders} disabled={statusLoading}>
                {statusLoading ? <span className="spinner"/> : '🔄 새로고침'}
              </button>
            </div>
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
                        onClick={() => toggleExpandWithEdit(o)}>
                        <td style={{textAlign:'center', color:'var(--text2)'}}>{open ? '▼' : '▶'}</td>
                        <td className="mono" style={{fontSize:11}}>{new Date(o.created_at).toLocaleDateString('ko-KR')}</td>
                        <td><span className="badge badge-dept">{o.store_name}</span></td>
                        <td><span className="badge badge-store">{o.branch_name}</span></td>
                        <td className="mono" style={{fontSize:11}}>{o.week_start} ~ {o.week_end}</td>
                        <td className="r">{o.items?.length || 0}</td>
                        <td style={{textAlign:'center'}}>
                          <span style={{display:'inline-block', padding:'2px 10px', borderRadius:4, fontSize:11, fontWeight:700,
                            background:st.bg, color:st.color, border:`1px solid ${st.border}`}}>{st.label}</span>
                          {o.exported_at && (
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); handleReexport(o.id); }}
                              disabled={exporting}
                              title={`출하됨: ${new Date(o.exported_at).toLocaleString('ko-KR')}\n클릭하여 재다운로드`}
                              style={{display:'inline-block', marginLeft:6, padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700,
                                background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7',
                                cursor: exporting ? 'not-allowed' : 'pointer', fontFamily:'inherit'}}>
                              ✓ 출하됨 🔄
                            </button>
                          )}
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
                            {(() => {
                              const editable = o.status === 'requested' || o.status === 'rerequested';
                              return (
                              <>
                              <div className="twrap">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>상품명</th><th>코드</th>
                                      <th className="r">판매수량</th>
                                      <th className="r">본사 발주</th>
                                      <th className="r">매장 요청</th>
                                      <th className="r">변동</th>
                                      {editable
                                        ? <th className="r" style={{color:'var(--accent)'}}>확정 수량</th>
                                        : <th className="r">입고확인</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(o.items||[]).map(it => {
                                      const diff = it.store_qty != null ? (it.store_qty - it.hq_qty) : 0;
                                      return (
                                      <tr key={it.id}>
                                        <td>
                                          {it.product?.name||'-'}
                                          {((it.hq_qty || 0) === 0 && (it.store_qty || 0) > 0) && (
                                            <span style={{marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px',
                                              background:'#fff3e0', color:'#bf360c', border:'1px solid #ffcc80', borderRadius:3}}>
                                              🆕 매장 추가
                                            </span>
                                          )}
                                        </td>
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
                                          {editable ? (
                                            <input type="number" min={0}
                                              value={confirmEditMap[it.id] != null ? confirmEditMap[it.id] : ''}
                                              onChange={e => {
                                                const v = Math.max(0, Number(e.target.value)||0);
                                                setConfirmEditMap(prev => ({...prev, [it.id]: v}));
                                              }}
                                              style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right', fontWeight:700, color:'var(--accent)'}}/>
                                          ) : (
                                            it.received_qty != null
                                              ? <span style={{color: it.received_ok ? 'var(--success)' : 'var(--danger)', fontWeight:700}}>
                                                  {it.received_qty} {it.received_ok ? '✅' : '❌'}
                                                </span>
                                              : '-'
                                          )}
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
                              {editable && (
                                <div style={{marginTop:10, display:'flex', justifyContent:'flex-end', gap:8}}>
                                  <button className="btn btn-p" onClick={() => handleConfirm(o)} disabled={confirming}
                                    style={{padding:'0 20px', height:36, fontSize:13, fontWeight:700}}>
                                    {confirming ? <span className="spinner"/> : `✓ 확정 (${(o.items||[]).reduce((s,i) => s + (Number(confirmEditMap[i.id])||0), 0)}개)`}
                                  </button>
                                </div>
                              )}
                              </>
                            );})()}
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
