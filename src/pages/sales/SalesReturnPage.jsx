import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, GradeBadge, getGrade, formatNumInput, parseNumInput } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

export default function SalesReturnPage({ profile }) {
  // 본사 계정(매니저가 아닌 admin/hq)이면 점포·지점을 직접 선택해 매장 반품 접수
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore,  setHqStore]  = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const hqBranchOptions = useMemo(() => hqStore ? (STORE_MAP[hqStore] || []) : [], [hqStore]);

  const today = new Date().toISOString().slice(0, 10);
  const [tab,      setTab]      = useState('search'); // 'search' | 'manual'
  const [fFrom,    setFFrom]    = useState(today);
  const [fTo,      setFTo]      = useState(today);
  const [fSearch,  setFSearch]  = useState('');
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [returnMap, setReturnMap] = useState({});
  const [saving,   setSaving]   = useState(false);
  // 검색 반품: 반품 날짜 + 환불 합계 수정(빈값='' = 자동계산 그대로)
  const kstToday = () => new Date(Date.now() + 9*60*60*1000).toISOString().slice(0, 10);
  const [returnDate, setReturnDate] = useState(kstToday());
  const [refundEdit, setRefundEdit] = useState('');

  // 직접입력 탭
  const [allProducts, setAllProducts] = useState([]);
  const [mDate,    setMDate]    = useState(today);
  const [mSearch,  setMSearch]  = useState('');
  const [mProduct, setMProduct] = useState(null); // {id, name, code, brand_id}
  const [mShowSug, setMShowSug] = useState(false);
  const [mQty,     setMQty]     = useState(1);
  const [mPrice,   setMPrice]   = useState('');
  const [mMemo,    setMMemo]    = useState('');
  const [mSaving,  setMSaving]  = useState(false);

  useEffect(() => {
    if (tab === 'manual' && allProducts.length === 0) {
      supabase.from('products').select('id, name, code, brand_id, price').order('name')
        .then(({ data }) => setAllProducts(data || []));
    }
  }, [tab, allProducts.length]);

  // 바코드 스캐너
  // - manual(직접입력) 탭: 스캔 → 상품 자동 선택 + 단가 기본값
  // - search(반품접수) 탭: 스캔 처리는 없지만 input에 들어간 꼬리 코드를 자동 제거 (안전망)
  const scanBufRef = useRef({ chars: '', lastTime: 0, startTime: 0 });
  useEffect(() => {
    // search 탭은 allProducts 없이도 동작 (input 꼬리 제거만), manual 탭은 allProducts 필요
    if (tab === 'manual' && allProducts.length === 0) return;
    const handler = (e) => {
      const tg = (e.target?.tagName || '').toLowerCase();
      const isInputFocused = tg === 'input' || tg === 'textarea' || tg === 'select';
      // manual 탭은 input 포커스 중엔 무시(직접 타이핑과 충돌 방지)
      if (tab === 'manual' && isInputFocused) return;
      const now = Date.now();
      const buf = scanBufRef.current;
      if (e.key === 'Enter') {
        const code = buf.chars.trim();
        const elapsed = now - buf.startTime;
        buf.chars = ''; buf.lastTime = 0; buf.startTime = 0;
        if (code.length >= 3 && elapsed < 800) {
          e.preventDefault();
          if (tab === 'manual') {
            const matched = allProducts.find(p => String(p.code || '').trim() === code);
            if (!matched) {
              toast(`상품 매칭 실패 — 코드: ${code}`, 'err');
              return;
            }
            setMProduct({ id: matched.id, name: matched.name, code: matched.code, brand_id: matched.brand_id });
            setMSearch(matched.name);
            if (matched.price) setMPrice(String(matched.price));
            toast(`📷 ${matched.name} 선택됨`, 'ok');
          } else if (tab === 'search') {
            // 반품접수 탭 안전망 — 포커스된 input에 들어간 스캔 꼬리 코드 자동 제거
            if (isInputFocused) {
              const el = document.activeElement;
              if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                const v = el.value || '';
                if (v.endsWith(code)) {
                  const nativeSetter = Object.getOwnPropertyDescriptor(
                    el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
                    'value'
                  )?.set;
                  const newVal = v.slice(0, -code.length);
                  if (nativeSetter) {
                    nativeSetter.call(el, newVal);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                  } else {
                    el.value = newVal;
                  }
                }
              }
            }
            toast('📷 반품접수 탭에서는 스캔이 동작하지 않습니다 — [직접입력] 탭에서 사용해주세요', 'inf');
          }
        }
      } else if (e.key.length === 1) {
        if (now - buf.lastTime > 100) {
          buf.chars = '';
          buf.startTime = now;
        }
        buf.chars += e.key;
        buf.lastTime = now;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, allProducts]);

  const fetchOrders = useCallback(async () => {
    // 본사 계정인데 점포/지점 미선택이면 조회 자체를 시도하지 않음
    if (!storeName || !branchName) {
      setOrders([]); setLoading(false); return;
    }
    setLoading(true);
    const hasSearch = !!fSearch.trim();
    let q = supabase.from('sales')
      .select('*, product:products(name,code), brand:brands(name), customer:customers(id,name,phone,total_points,used_points,total_purchase,grade)')
      .eq('store_name', storeName)
      .eq('branch_name', branchName)
      .order('sold_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (!hasSearch) {
      if (fFrom) q = q.gte('sold_at', fFrom);
      if (fTo)   q = q.lte('sold_at', fTo);
    }
    const { data, error } = await q;
    if (error) { toast(error.message, 'err'); setLoading(false); return; }

    const active = (data || []).filter(s => (s.quantity - (s.returned_qty||0)) > 0);
    let filtered = active;
    if (fSearch.trim()) {
      const q2 = fSearch.toLowerCase();
      filtered = filtered.filter(s =>
        (s.customer?.name||'').toLowerCase().includes(q2) ||
        (s.customer?.phone||'').includes(fSearch)
      );
    }
    const grouped = {};
    for (const s of filtered) {
      const key = s.customer_id ? `c-${s.customer_id}-${s.sold_at}` : `s-${s.id}`;
      if (!grouped[key]) grouped[key] = { key, customer: s.customer, customerId: s.customer_id, sold_at: s.sold_at, items: [] };
      grouped[key].items.push(s);
    }
    const list = Object.values(grouped).sort((a,b) => b.sold_at.localeCompare(a.sold_at));
    setOrders(list);
    setExpanded(null);
    setReturnMap({});
    setLoading(false);
  }, [storeName, branchName, fFrom, fTo, fSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const orderTotal = (o) => o.items.reduce((s,i) => {
    const remain = i.quantity - (i.returned_qty||0);
    return s + (i.price * remain);
  }, 0);

  const orderQty = (o) => o.items.reduce((s,i) => s + (i.quantity - (i.returned_qty||0)), 0);

  const toggleExpand = (order) => {
    if (expanded === order.key) {
      setExpanded(null); setReturnMap({});
    } else {
      const map = {};
      for (const i of order.items) map[i.id] = 0;
      setReturnMap(map);
      setReturnDate(kstToday()); setRefundEdit('');
      setExpanded(order.key);
    }
  };

  const setAllFull = (order) => {
    const map = {};
    for (const i of order.items) map[i.id] = i.quantity - (i.returned_qty||0);
    setReturnMap(map);
  };
  const setAllZero = (order) => {
    const map = {};
    for (const i of order.items) map[i.id] = 0;
    setReturnMap(map);
  };

  const expandedOrder = useMemo(() => orders.find(o => o.key === expanded) || null, [orders, expanded]);

  const preview = useMemo(() => {
    if (!expandedOrder) return null;
    let cash = 0, pointsRestore = 0, pointsRevoke = 0, qtySum = 0;
    for (const it of expandedOrder.items) {
      const qty = Number(returnMap[it.id] || 0);
      if (qty <= 0) continue;
      const ratio = qty / it.quantity;
      cash += it.price * qty;
      pointsRestore += Math.floor((it.points_used||0) * ratio);
      pointsRevoke  += Math.floor((it.points_earned||0) * ratio);
      qtySum += qty;
    }
    return { cash, pointsRestore, pointsRevoke, qtySum };
  }, [expandedOrder, returnMap]);

  const handleReturn = async () => {
    if (!expandedOrder) return;
    const toReturn = expandedOrder.items.filter(i => Number(returnMap[i.id] || 0) > 0);
    if (toReturn.length === 0) { toast('반품할 수량을 입력해주세요', 'err'); return; }
    for (const it of toReturn) {
      const qty = Number(returnMap[it.id]);
      const remain = it.quantity - (it.returned_qty||0);
      if (qty > remain) { toast(`${it.product?.name}: 남은 수량(${remain})을 초과합니다`, 'err'); return; }
    }

    if (!returnDate) { toast('반품 날짜를 선택해주세요', 'err'); return; }
    // 환불 합계 — 수정값(있으면) vs 자동계산값
    const refundComputed = preview.cash;
    const refundFinal = refundEdit.trim() !== '' ? Number(parseNumInput(refundEdit)) : refundComputed;
    if (!Number.isFinite(refundFinal) || refundFinal < 0) { toast('환불 합계가 유효하지 않습니다', 'err'); return; }
    const overridden = refundFinal !== refundComputed;

    if (!window.confirm(`총 ${toReturn.length}개 상품을 반품 처리하시겠습니까?\n\n` +
      `반품 날짜: ${returnDate}\n` +
      `환불 금액: ${refundFinal.toLocaleString()}원${overridden ? ` (수정됨, 원래 ${refundComputed.toLocaleString()}원)` : ''}\n` +
      `복구 적립금: ${preview.pointsRestore.toLocaleString()}원\n` +
      `적립금 회수: ${preview.pointsRevoke.toLocaleString()}원`)) return;

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      // 환불 합계 수정 시 각 라인 음수 금액을 비례 배분(마지막 라인이 잔차 흡수)
      const refundRatio = (overridden && refundComputed > 0) ? (refundFinal / refundComputed) : 1;
      let allocated = 0;
      for (let idx = 0; idx < toReturn.length; idx++) {
        const it = toReturn[idx];
        const qty = Number(returnMap[it.id]);
        const newReturnedQty = (it.returned_qty||0) + qty;
        const fullyReturned = newReturnedQty >= it.quantity;

        // 이 라인의 환불 합계(비례 배분, 마지막 라인은 잔차)
        const lineOrig = Math.abs(Number(it.price) || 0) * qty;
        let lineTotal;
        if (idx === toReturn.length - 1) {
          lineTotal = Math.max(0, refundFinal - allocated);
        } else {
          lineTotal = overridden ? Math.round(lineOrig * refundRatio) : lineOrig;
          allocated += lineTotal;
        }
        const unitPrice = qty > 0 ? lineTotal / qty : 0;

        // 1) 원본 row — returned_qty 누적 (이중 반품 방지용. 매출 차감용으로는 더 이상 안 씀)
        await supabase.from('sales').update({
          returned_qty: newReturnedQty,
          returned_at: fullyReturned ? nowIso : it.returned_at,
        }).eq('id', it.id);

        // 2) 반품일 기준 음수 매출 row INSERT — 매출조회는 이 row를 음수로 합산
        await supabase.from('sales').insert({
          sold_at:    returnDate,
          store_name: it.store_name,
          branch_name: it.branch_name,
          brand_id:   it.brand_id,
          product_id: it.product_id,
          quantity:   qty,
          price:      -Math.abs(unitPrice),
          payment:    '반품',
          memo:       `반품 (원본 매출일 ${it.sold_at}, 매출 ID:${it.id})${overridden ? ' · 환불합계 수정' : ''}`,
          created_by: profile.id,
          customer_id: it.customer_id,
          points_earned: 0,
          points_used: 0,
          delivery_type: 'none',
        });

        // 본사 택배요청(hq)은 판매 시 매장 재고를 차감하지 않았으므로 반품 시에도 복구하지 않음
        if (it.product?.code && it.delivery_type !== 'hq') {
          const { data: stockRow } = await supabase.from('store_stock')
            .select('id, stock_qty')
            .eq('store_name',  it.store_name || storeName)
            .eq('branch_name', it.branch_name || branchName)
            .eq('product_code', it.product.code)
            .maybeSingle();
          if (stockRow) {
            await supabase.from('store_stock').update({
              stock_qty: (stockRow.stock_qty||0) + qty,
              updated_at: new Date().toISOString(),
            }).eq('id', stockRow.id);
          }
        }

        if (it.customer_id && it.customer) {
          const ratio = qty / it.quantity;
          const pointsUsedRefund    = Math.floor((it.points_used||0) * ratio);
          const pointsEarnedReverse = Math.floor((it.points_earned||0) * ratio);
          const cashRefund = lineTotal; // 실제 환불 금액(합계 수정 반영)

          const newTotalPoints   = Math.max(0, (it.customer.total_points||0) + pointsUsedRefund - pointsEarnedReverse);
          const newUsedPoints    = Math.max(0, (it.customer.used_points||0) - pointsUsedRefund);
          const newTotalPurchase = Math.max(0, (it.customer.total_purchase||0) - cashRefund);
          const newGrade = getGrade(newTotalPurchase);

          await supabase.from('customers').update({
            total_points:   newTotalPoints,
            used_points:    newUsedPoints,
            total_purchase: newTotalPurchase,
            grade:          newGrade.grade,
          }).eq('id', it.customer_id);
        }
      }
      toast('반품 처리 완료', 'ok');
      setExpanded(null);
      setReturnMap({});
      fetchOrders();
    } catch (err) {
      toast('반품 실패: ' + err.message, 'err');
    }
    setSaving(false);
  };

  // 직접입력 반품 처리
  const handleManualReturn = async () => {
    if (!isStoreMgr && (!storeName || !branchName)) {
      toast('점포와 지점을 먼저 선택해주세요', 'err'); return;
    }
    if (!mProduct) { toast('상품을 선택해주세요', 'err'); return; }
    if (!mDate)    { toast('날짜를 선택해주세요', 'err'); return; }
    const qty = Number(mQty) || 0;
    const price = Number(String(mPrice).replace(/,/g,'')) || 0;
    if (qty <= 0)  { toast('수량을 입력해주세요', 'err'); return; }
    if (price < 0) { toast('가격을 확인해주세요', 'err'); return; }
    if (!window.confirm(`수기 반품 처리하시겠습니까?\n\n날짜: ${mDate}\n상품: ${mProduct.name}\n수량: ${qty}개\n가격: ${price.toLocaleString()}원\n환불 금액: ${(qty*price).toLocaleString()}원`)) return;

    setMSaving(true);
    try {
      const nowIso = new Date().toISOString();
      // 수기 반품도 음수 매출 row로 저장 (returned_qty 미사용 — 자기 자신 반품 마킹은 의미 없음)
      const { error } = await supabase.from('sales').insert({
        sold_at: mDate,
        store_name: storeName,
        branch_name: branchName,
        brand_id: mProduct.brand_id,
        product_id: mProduct.id,
        quantity: qty,
        price: -Math.abs(price),
        payment: '반품',
        memo: '수기 반품 접수' + (mMemo.trim() ? ` · ${mMemo.trim()}` : ''),
        created_by: profile.id,
        returned_qty: 0,
        returned_at: nowIso,
        points_earned: 0,
        points_used: 0,
      });
      if (error) throw error;

      // 매장재고 복구
      if (mProduct.code) {
        const { data: stockRow } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name',  storeName)
          .eq('branch_name', branchName)
          .eq('product_code', mProduct.code)
          .maybeSingle();
        if (stockRow) {
          await supabase.from('store_stock').update({
            stock_qty: (stockRow.stock_qty||0) + qty,
            updated_at: nowIso,
          }).eq('id', stockRow.id);
        }
      }

      toast('수기 반품 접수 완료', 'ok');
      setMProduct(null); setMSearch(''); setMQty(1); setMPrice(''); setMMemo('');
    } catch (err) {
      toast('반품 실패: ' + err.message, 'err');
    }
    setMSaving(false);
  };

  // 직접입력 상품 검색 결과
  const mSuggestions = useMemo(() => {
    if (!mSearch || mSearch.length < 1) return [];
    const q = mSearch.toLowerCase();
    return allProducts
      .filter(p => (p.name||'').toLowerCase().includes(q)
                || (p.code||'').toLowerCase().includes(q))
      .slice(0, 10);
  }, [mSearch, allProducts]);

  return (
    <div>
      {/* 탭 */}
      <div className="tabs">
        <button className={`tab ${tab==='search'?'on':''}`} onClick={() => setTab('search')}>반품접수</button>
        <button className={`tab ${tab==='manual'?'on':''}`} onClick={() => setTab('manual')}>직접입력</button>
      </div>

      {tab === 'search' && (<>
      {/* 필터 */}
      <div className="card">
        <div className="card-label">반품 접수</div>
        {isStoreMgr ? (
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, fontFamily:'var(--mono)' }}>
            📍 {profile.department} · {profile.branch}
          </div>
        ) : (
          <div style={{display:'flex', gap:10, marginBottom:12, flexWrap:'wrap'}}>
            <select className="fsel" value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }}>
              <option value="">점포 선택</option>
              {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="fsel" value={hqBranch} onChange={e => setHqBranch(e.target.value)}
              disabled={!hqStore} style={{background:!hqStore?'#f0f0f0':'#fff'}}>
              <option value="">{hqStore ? '지점 선택' : '먼저 점포 선택'}</option>
              {hqBranchOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {(!storeName || !branchName) && (
              <span style={{fontSize:11, color:'var(--danger)', alignSelf:'center'}}>※ 점포·지점을 선택하면 매출 조회가 시작됩니다</span>
            )}
          </div>
        )}
        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)}
            disabled={!!fSearch.trim()} title="판매일 시작"
            style={{background: fSearch.trim() ? '#f0f0f0' : '#fff'}}/>
          <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)}
            disabled={!!fSearch.trim()} title="판매일 종료"
            style={{background: fSearch.trim() ? '#f0f0f0' : '#fff'}}/>
          <input className="finput" value={fSearch} onChange={e => setFSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchOrders()}
            placeholder="고객명/연락처 검색 (입력 시 날짜 무시)" style={{flex:'1 1 280px'}}/>
          {(fSearch || fFrom !== today || fTo !== today) &&
            <button className="btn-ghost" onClick={() => { setFFrom(today); setFTo(today); setFSearch(''); }}>✕ 초기화</button>}
          <div className="fbar-right">
            <button className="btn btn-p" onClick={fetchOrders} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔍 조회'}
            </button>
          </div>
        </div>
        {fSearch.trim() && (
          <div style={{fontSize:11, color:'var(--text3)', marginTop:6, fontStyle:'italic'}}>
            💡 고객 검색 중 — 전체 기간에서 해당 고객의 판매내역을 조회합니다
          </div>
        )}
      </div>

      {/* 주문 목록 */}
      {orders.length === 0 && !loading && (
        <div className="empty">
          해당 조건의 주문이 없습니다<br/>
          <span style={{fontSize:11, color:'var(--text3)'}}>날짜와 고객을 입력 후 조회해주세요</span>
        </div>
      )}
      {orders.length > 0 && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{marginBottom:12}}>
            <span className="fresult">총 <b>{orders.length}</b>건의 주문</span>
            <span style={{fontSize:11, color:'var(--text3)', marginLeft:8}}>(행 클릭 시 상세보기/반품처리 펼쳐짐)</span>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:30}}></th>
                  <th>판매일</th>
                  <th>고객</th>
                  <th>등급</th>
                  <th>연락처</th>
                  <th className="r">상품수</th>
                  <th className="r">총수량</th>
                  <th className="r">미반품 잔여금액</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const open = expanded === o.key;
                  return (
                  <React.Fragment key={o.key}>
                    <tr style={{cursor:'pointer', background: open ? '#f8f9fa' : 'transparent'}} onClick={() => toggleExpand(o)}>
                      <td style={{textAlign:'center', fontWeight:700, color:'var(--text2)'}}>{open ? '▼' : '▶'}</td>
                      <td className="mono">{o.sold_at}</td>
                      <td><strong>{o.customer?.name || <span style={{color:'var(--text3)'}}>비회원</span>}</strong></td>
                      <td>{o.customer?.grade ? <GradeBadge grade={o.customer.grade}/> : '-'}</td>
                      <td className="mono" style={{fontSize:12}}>{o.customer?.phone || '-'}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{o.items.length}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{orderQty(o)}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{orderTotal(o).toLocaleString()}원</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} style={{background:'#fff', padding:'14px 18px', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)'}}>
                          {/* 헤더 - 심플하게 텍스트만 */}
                          <div style={{display:'flex', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:12, paddingBottom:10, borderBottom:'1px solid var(--border)'}}>
                            <div style={{fontSize:13, fontWeight:700, color:'var(--text)'}}>반품 처리</div>
                            {o.customer && <>
                              <strong style={{fontSize:13}}>{o.customer.name}</strong>
                              <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)'}}>{o.customer.phone}</span>
                              <span style={{fontSize:12, color:'var(--text3)'}}>사용가능 적립금</span>
                              <strong style={{fontSize:12, fontFamily:'var(--mono)'}}>{(o.customer.total_points||0).toLocaleString()}원</strong>
                            </>}
                            {/* 반품 날짜 */}
                            <div style={{display:'flex', alignItems:'center', gap:6, padding:'4px 8px', background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:6}}>
                              <span style={{fontSize:11, fontWeight:700, color:'#e65100'}}>📅 반품 날짜</span>
                              <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                                style={{height:30, padding:'0 8px', border:'1px solid var(--accent)', borderRadius:4, fontSize:13, fontWeight:700, color:'var(--accent)', outline:'none', background:'#fff'}}/>
                            </div>
                            <div style={{marginLeft:'auto', display:'flex', gap:6}}>
                              <button type="button" className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}} onClick={() => setAllZero(o)}>전체 0</button>
                              <button type="button" className="btn btn-s" style={{fontSize:11, padding:'4px 10px'}} onClick={() => setAllFull(o)}>전체 반품</button>
                            </div>
                          </div>

                          {/* 상품 목록 */}
                          <div className="twrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>브랜드</th>
                                  <th>상품명 (코드)</th>
                                  <th className="r">판매수량</th>
                                  <th className="r">이미반품</th>
                                  <th className="r">잔여</th>
                                  <th className="r">단가</th>
                                  <th className="r">합계</th>
                                  <th className="r">적립금사용</th>
                                  <th>결제</th>
                                  <th style={{textAlign:'center', width:130}}>반품 수량</th>
                                </tr>
                              </thead>
                              <tbody>
                                {o.items.map(it => {
                                  const remain = it.quantity - (it.returned_qty||0);
                                  return (
                                  <tr key={it.id}>
                                    <td>{it.brand?.name || '-'}</td>
                                    <td style={{fontSize:12}}>
                                      <strong>{it.product?.name || '-'}</strong>
                                      {it.product?.code && <span style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:6}}>{it.product.code}</span>}
                                    </td>
                                    <td className="r">{it.quantity}</td>
                                    <td className="r" style={{color:'var(--text3)'}}>{it.returned_qty||0}</td>
                                    <td className="r" style={{fontWeight:700}}>{remain}</td>
                                    <td className="r" style={{fontFamily:'var(--mono)'}}>{Number(it.price).toLocaleString()}원</td>
                                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{(it.price * remain).toLocaleString()}원</td>
                                    <td className="r" style={{fontFamily:'var(--mono)', color:(it.points_used||0)>0?'var(--text2)':'var(--text3)'}}>
                                      {(it.points_used||0) > 0 ? `-${Number(it.points_used).toLocaleString()}` : '-'}
                                    </td>
                                    <td style={{fontSize:12, color:'var(--text2)'}}>{it.payment}</td>
                                    <td style={{textAlign:'center'}}>
                                      <input type="number" min={0} max={remain}
                                        value={returnMap[it.id] || 0}
                                        onChange={e => {
                                          const v = Math.max(0, Math.min(remain, Number(e.target.value)||0));
                                          setReturnMap(prev => ({...prev, [it.id]: v}));
                                        }}
                                        style={{width:70, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'center'}}/>
                                      <span style={{fontSize:11, color:'var(--text3)', marginLeft:4}}>/ {remain}</span>
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
                          </div>

                          {/* 반품 미리보기 + 액션 */}
                          {preview && (
                            <div style={{marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)'}}>
                              {/* 환불 합계 수정 */}
                              <div style={{display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end', marginBottom:12}}>
                                <div>
                                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>환불 합계 <span style={{color:'var(--text3)', fontWeight:400}}>(비우면 자동계산 {preview.cash.toLocaleString()}원)</span></label>
                                  <input type="text" inputMode="numeric"
                                    value={refundEdit === '' ? '' : formatNumInput(refundEdit)}
                                    onChange={e => setRefundEdit(parseNumInput(e.target.value))}
                                    placeholder={preview.cash.toLocaleString()}
                                    style={{width:160, height:34, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:4, fontSize:14, fontWeight:700, fontFamily:'var(--mono)', textAlign:'right', outline:'none', background:'#fff3e0', color:'var(--accent)'}}/>
                                </div>
                              </div>
                              <div style={{display:'flex', gap:24, flexWrap:'wrap', alignItems:'center'}}>
                                <div style={{display:'flex', gap:24, fontSize:13, flexWrap:'wrap'}}>
                                  <div>
                                    <span style={{color:'var(--text3)', marginRight:6}}>환불 금액</span>
                                    <strong style={{fontFamily:'var(--mono)', color: refundEdit.trim()!=='' ? 'var(--accent)' : undefined}}>
                                      {(refundEdit.trim()!=='' ? Number(parseNumInput(refundEdit))||0 : preview.cash).toLocaleString()}원
                                    </strong>
                                  </div>
                                  <div>
                                    <span style={{color:'var(--text3)', marginRight:6}}>복구 적립금</span>
                                    <strong style={{fontFamily:'var(--mono)'}}>+{preview.pointsRestore.toLocaleString()}원</strong>
                                  </div>
                                  <div>
                                    <span style={{color:'var(--text3)', marginRight:6}}>회수 적립금</span>
                                    <strong style={{fontFamily:'var(--mono)'}}>-{preview.pointsRevoke.toLocaleString()}원</strong>
                                  </div>
                                </div>
                                <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                                  <button className="btn btn-s" style={{padding:'0 16px', height:36, fontSize:12}}
                                    onClick={() => { setExpanded(null); setReturnMap({}); }} disabled={saving}>
                                    접기
                                  </button>
                                  <button className="btn btn-p" style={{padding:'0 20px', height:36, fontSize:13, fontWeight:700}}
                                    onClick={handleReturn} disabled={saving || preview.qtySum === 0}>
                                    {saving ? <span className="spinner"/> : `반품 처리${preview.qtySum > 0 ? ` (${preview.qtySum}개)` : ''}`}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>)}

      {tab === 'manual' && (
        <div className="card">
          <div className="card-label">직접 입력 반품</div>
          {isStoreMgr ? (
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:14, fontFamily:'var(--mono)' }}>
              📍 {profile.department} · {profile.branch}
            </div>
          ) : (
            <div style={{display:'flex', gap:10, marginBottom:14, flexWrap:'wrap'}}>
              <select className="fsel" value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }}>
                <option value="">점포 선택</option>
                {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="fsel" value={hqBranch} onChange={e => setHqBranch(e.target.value)}
                disabled={!hqStore} style={{background:!hqStore?'#f0f0f0':'#fff'}}>
                <option value="">{hqStore ? '지점 선택' : '먼저 점포 선택'}</option>
                {hqBranchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {(!storeName || !branchName) && (
                <span style={{fontSize:11, color:'var(--danger)', alignSelf:'center'}}>※ 점포·지점을 선택하면 매장재고가 복구될 매장이 결정됩니다</span>
              )}
            </div>
          )}
          <div style={{background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, fontSize:12, color:'#6d4c41'}}>
            💡 주문건을 찾을 수 없는 경우, 날짜·상품·수량·가격을 직접 입력하여 반품을 접수합니다.
            처리 시 매장재고는 자동 복구되며, 회원 적립금은 변동되지 않습니다.
          </div>

          <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:14, marginBottom:14}}>
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>판매 날짜</label>
              <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, outline:'none', boxSizing:'border-box'}}/>
            </div>
            <div style={{position:'relative'}}>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>상품 검색</label>
              <input
                value={mProduct ? mProduct.name : mSearch}
                onChange={e => { setMSearch(e.target.value); setMProduct(null); setMShowSug(true); }}
                onFocus={() => setMShowSug(true)}
                onBlur={() => setTimeout(() => setMShowSug(false), 200)}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, outline:'none', boxSizing:'border-box', background:'#fff'}}
                placeholder="상품명 또는 상품코드로 검색"
                autoComplete="off"
              />
              {mShowSug && mSuggestions.length > 0 && !mProduct && (
                <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:240, overflowY:'auto', marginTop:2}}>
                  {mSuggestions.map(p => (
                    <div key={p.id}
                      onMouseDown={e => { e.preventDefault(); setMProduct(p); setMSearch(p.name); setMShowSug(false); if (p.price) setMPrice(String(p.price)); }}
                      style={{padding:'9px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0f0f0'}}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f7fa'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                      <div>{p.name}</div>
                      <div style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>
                        {p.code && <span>코드: {p.code}</span>}
                        {p.price && <span style={{marginLeft:10}}>판매가: {Number(p.price).toLocaleString()}원</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {mProduct && (
                <div style={{marginTop:4, fontSize:11, color:'var(--success)', fontWeight:600}}>
                  ✅ {mProduct.name} {mProduct.code && <span style={{color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:6}}>({mProduct.code})</span>}
                </div>
              )}
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14}}>
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>수량</label>
              <input type="number" min={1} value={mQty} onChange={e => setMQty(e.target.value)}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, outline:'none', boxSizing:'border-box', textAlign:'right'}}/>
            </div>
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>가격 (단가)</label>
              <input type="text" inputMode="numeric" value={formatNumInput(mPrice)}
                onChange={e => setMPrice(parseNumInput(e.target.value))}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, outline:'none', boxSizing:'border-box', textAlign:'right'}}
                placeholder="0"/>
            </div>
            <div>
              <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>환불 합계 <span style={{color:'var(--text3)', fontWeight:400}}>(수정 시 단가 자동계산)</span></label>
              <input type="text" inputMode="numeric"
                value={formatNumInput(String((Number(mQty)||0) * (Number(parseNumInput(mPrice))||0)))}
                onChange={e => {
                  const total = Number(parseNumInput(e.target.value)) || 0;
                  const q = Number(mQty) || 1;
                  setMPrice(String(q > 0 ? Math.round(total / q) : total));
                }}
                style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', fontSize:14, fontWeight:700, fontFamily:'var(--mono)', outline:'none', boxSizing:'border-box', textAlign:'right', background:'#fff3e0', color:'var(--accent)'}}
                placeholder="0"/>
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5}}>메모 (선택)</label>
            <input value={mMemo} onChange={e => setMMemo(e.target.value)}
              style={{width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, outline:'none', boxSizing:'border-box'}}
              placeholder="반품 사유 등"/>
          </div>

          <button className="btn btn-p" disabled={mSaving || !mProduct || !mQty || mPrice === ''}
            style={{width:'100%', justifyContent:'center', height:44, fontWeight:700}}
            onClick={handleManualReturn}>
            {mSaving ? <span className="spinner"/> : '↩️ 반품 접수'}
          </button>
        </div>
      )}
    </div>
  );
}
