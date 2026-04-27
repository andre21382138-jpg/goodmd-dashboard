import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, GradeBadge, getGrade } from '../../lib/utils';

export default function SalesReturnPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [fFrom,    setFFrom]    = useState(today);
  const [fTo,      setFTo]      = useState(today);
  const [fSearch,  setFSearch]  = useState('');
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(null);     // 펼쳐진 주문 key
  const [returnMap, setReturnMap] = useState({});     // { saleId: qty }
  const [saving,   setSaving]   = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const hasSearch = !!fSearch.trim();
    let q = supabase.from('sales')
      .select('*, product:products(name,code), brand:brands(name), customer:customers(id,name,phone,total_points,used_points,total_purchase,grade)')
      .eq('store_name', profile.department)
      .eq('branch_name', profile.branch)
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
  }, [profile.department, profile.branch, fFrom, fTo, fSearch]);

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

    if (!window.confirm(`총 ${toReturn.length}개 상품을 반품 처리하시겠습니까?\n\n` +
      `환불 금액: ${preview.cash.toLocaleString()}원\n` +
      `복구 적립금: ${preview.pointsRestore.toLocaleString()}원\n` +
      `적립금 회수: ${preview.pointsRevoke.toLocaleString()}원`)) return;

    setSaving(true);
    try {
      for (const it of toReturn) {
        const qty = Number(returnMap[it.id]);
        const newReturnedQty = (it.returned_qty||0) + qty;
        const fullyReturned = newReturnedQty >= it.quantity;

        await supabase.from('sales').update({
          returned_qty: newReturnedQty,
          returned_at: fullyReturned ? new Date().toISOString() : it.returned_at,
        }).eq('id', it.id);

        if (it.product?.code) {
          const { data: stockRow } = await supabase.from('store_stock')
            .select('id, stock_qty')
            .eq('store_name',  profile.department)
            .eq('branch_name', profile.branch)
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
          const cashRefund = it.price * qty;

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

  return (
    <div>
      {/* 필터 */}
      <div className="card">
        <div className="card-label">반품 접수</div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
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
                    <tr style={{cursor:'pointer', background: open ? '#fff8e1' : 'transparent'}} onClick={() => toggleExpand(o)}>
                      <td style={{textAlign:'center', fontWeight:700, color:'var(--accent)'}}>{open ? '▼' : '▶'}</td>
                      <td className="mono">{o.sold_at}</td>
                      <td><strong>{o.customer?.name || <span style={{color:'var(--text3)'}}>비회원</span>}</strong></td>
                      <td>{o.customer?.grade ? <GradeBadge grade={o.customer.grade}/> : '-'}</td>
                      <td className="mono" style={{fontSize:12}}>{o.customer?.phone || '-'}</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{o.items.length}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)'}}>{orderQty(o)}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{orderTotal(o).toLocaleString()}원</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} style={{background:'#fafafa', padding:'14px 16px', borderTop:'2px solid var(--accent)'}}>
                          {/* 헤더 */}
                          <div style={{display:'flex', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:12}}>
                            <div style={{fontSize:14, fontWeight:700}}>↩️ 반품 처리</div>
                            {o.customer && <>
                              <strong style={{fontSize:13}}>{o.customer.name}</strong>
                              <GradeBadge grade={o.customer.grade || '패밀리'}/>
                              <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)'}}>{o.customer.phone}</span>
                              <span style={{fontSize:12, color:'var(--text3)'}}>·</span>
                              <span style={{fontSize:12, color:'#6a1b9a', fontWeight:700}}>사용가능 적립금: {(o.customer.total_points||0).toLocaleString()}원</span>
                            </>}
                            <div style={{marginLeft:'auto', display:'flex', gap:6}}>
                              <button type="button" className="btn btn-s" style={{fontSize:11, padding:'3px 10px'}} onClick={() => setAllZero(o)}>전체 0</button>
                              <button type="button" className="btn btn-p" style={{fontSize:11, padding:'3px 10px'}} onClick={() => setAllFull(o)}>전체 반품</button>
                            </div>
                          </div>

                          {/* 상품 목록 */}
                          <div className="twrap" style={{background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)'}}>
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
                                      {it.product?.code && <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>코드: {it.product.code}</div>}
                                    </td>
                                    <td className="r">{it.quantity}</td>
                                    <td className="r" style={{color:'var(--text3)'}}>{it.returned_qty||0}</td>
                                    <td className="r" style={{fontWeight:700}}>{remain}</td>
                                    <td className="r" style={{fontFamily:'var(--mono)'}}>{Number(it.price).toLocaleString()}원</td>
                                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color:'var(--accent)'}}>{(it.price * remain).toLocaleString()}원</td>
                                    <td className="r" style={{color:(it.points_used||0)>0?'#6a1b9a':'var(--text3)', fontFamily:'var(--mono)'}}>
                                      {(it.points_used||0) > 0 ? `-${Number(it.points_used).toLocaleString()}` : '-'}
                                    </td>
                                    <td>
                                      <span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11}}>
                                        {it.payment}
                                      </span>
                                    </td>
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
                            <div style={{marginTop:12, display:'flex', gap:10, flexWrap:'wrap', alignItems:'stretch'}}>
                              <div style={{flex:1, minWidth:280, background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px'}}>
                                <div style={{fontSize:11, fontWeight:700, color:'var(--text2)', marginBottom:6}}>💰 반품 요약</div>
                                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, fontSize:12}}>
                                  <div>
                                    <div style={{fontSize:10, color:'var(--text3)'}}>환불 금액</div>
                                    <div style={{fontSize:14, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{preview.cash.toLocaleString()}원</div>
                                  </div>
                                  <div>
                                    <div style={{fontSize:10, color:'var(--text3)'}}>복구 적립금</div>
                                    <div style={{fontSize:14, fontWeight:700, color:'#6a1b9a', fontFamily:'var(--mono)'}}>+{preview.pointsRestore.toLocaleString()}원</div>
                                  </div>
                                  <div>
                                    <div style={{fontSize:10, color:'var(--text3)'}}>회수 적립금</div>
                                    <div style={{fontSize:14, fontWeight:700, color:'var(--danger)', fontFamily:'var(--mono)'}}>-{preview.pointsRevoke.toLocaleString()}원</div>
                                  </div>
                                </div>
                              </div>
                              <div style={{display:'flex', gap:8, alignItems:'stretch'}}>
                                <button className="btn btn-s" style={{padding:'0 18px', fontSize:12}}
                                  onClick={() => { setExpanded(null); setReturnMap({}); }} disabled={saving}>
                                  접기
                                </button>
                                <button className="btn btn-p" style={{padding:'0 22px', fontWeight:700, fontSize:13}}
                                  onClick={handleReturn} disabled={saving || preview.qtySum === 0}>
                                  {saving ? <span className="spinner"/> : `↩️ 반품 처리${preview.qtySum > 0 ? ` (${preview.qtySum}개)` : ''}`}
                                </button>
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
    </div>
  );
}
