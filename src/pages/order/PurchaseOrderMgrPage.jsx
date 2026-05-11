import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const STATUS_LABEL = {
  sent:        { label:'본사 발송',    color:'#1565C0', bg:'#e3f2fd', border:'#90caf9' },
  requested:   { label:'발주요청 완료', color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7' },
  rerequested: { label:'재요청 보냄',   color:'#bf360c', bg:'#fbe9e7', border:'#ffab91' },
  confirmed:   { label:'본사 확정',     color:'#bf360c', bg:'#fff3e0', border:'#ffcc80' },
  received:    { label:'입고 완료',    color:'#6a1b9a', bg:'#f3e5f5', border:'#ce93d8' },
};

export default function PurchaseOrderMgrPage({ profile }) {
  const [tab, setTab] = useState('check');
  const [orders,    setOrders]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState(null);
  const [editMap,   setEditMap]   = useState({});
  const [memoMap,   setMemoMap]   = useState({});
  const [recvMap,   setRecvMap]   = useState({});
  const [saving,    setSaving]    = useState(false);
  // 매장이 펼침 영역에서 추가한 상품들 (펼침 닫으면 초기화)
  // [{ tempId, product_id, name, code, qty }]
  const [addedItems, setAddedItems] = useState([]);
  // 상품 검색 UI 상태
  const [searchQ,        setSearchQ]        = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [addQty,         setAddQty]         = useState('');
  const [selProduct,     setSelProduct]     = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const filterStatuses = tab === 'check'
      ? ['sent']
      : ['confirmed','received'];
    const { data, error } = await supabase.from('purchase_orders')
      .select('*, items:purchase_order_items(*, product:products(name, code))')
      .eq('store_name',  profile.department)
      .eq('branch_name', profile.branch)
      .in('status', filterStatuses)
      .order('created_at', { ascending: false });
    if (error) toast(error.message, 'err');
    else setOrders(data || []);
    setLoading(false);
  }, [profile.department, profile.branch, tab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // 상품 검색 (debounce 300ms)
  useEffect(() => {
    const q = (searchQ || '').trim();
    if (q.length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.from('products')
        .select('id, name, code')
        .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
        .limit(10);
      if (cancelled) return;
      if (error) toast(error.message, 'err');
      setSearchResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQ]);

  const toggleExpand = (o) => {
    if (expanded === o.id) {
      setExpanded(null); setEditMap({}); setMemoMap({}); setRecvMap({});
      setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null);
    } else {
      const em = {};
      const rm = {};
      for (const it of (o.items||[])) {
        em[it.id] = it.store_qty != null ? it.store_qty : it.hq_qty;
        rm[it.id] = { qty: it.received_qty != null ? it.received_qty : (it.store_qty != null ? it.store_qty : it.hq_qty), ok: it.received_ok != null ? it.received_ok : true };
      }
      setEditMap(em);
      setRecvMap(rm);
      setMemoMap({ [o.id]: o.store_note || '' });
      setExpanded(o.id);
      setAddedItems([]); setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null);
    }
  };

  // 매장이 입력행에서 상품 + 수량 골라 "+ 추가" 누름
  const handleAddItem = (order) => {
    if (!selProduct) { toast('상품을 선택하세요', 'err'); return; }
    const qty = Number(addQty) || 0;
    if (qty <= 0) { toast('수량을 입력하세요', 'err'); return; }
    // 중복 검사: 기존 본사 라인 + 이미 추가된 라인
    const inOrder = (order.items||[]).some(it => it.product_id === selProduct.id);
    const inAdded = addedItems.some(a => a.product_id === selProduct.id);
    if (inOrder || inAdded) { toast('이미 발주 목록에 있는 상품입니다', 'err'); return; }
    setAddedItems(prev => [...prev, {
      tempId: `tmp_${Date.now()}_${prev.length}`,
      product_id: selProduct.id,
      name: selProduct.name,
      code: selProduct.code,
      qty,
    }]);
    // 입력 리셋
    setSearchQ(''); setSearchResults([]); setSearchOpen(false); setAddQty(''); setSelProduct(null);
  };

  const handleRemoveAddedItem = (tempId) => {
    setAddedItems(prev => prev.filter(a => a.tempId !== tempId));
  };

  const handleAddedQtyChange = (tempId, qty) => {
    setAddedItems(prev => prev.map(a => a.tempId === tempId ? { ...a, qty: Math.max(0, Number(qty)||0) } : a));
  };

  // 그대로 발주요청 (본사 수량 그대로)
  const handleRequestAsIs = async (order) => {
    if (!window.confirm('본사 발주 수량 그대로 발주요청 하시겠습니까?')) return;
    setSaving(true);
    try {
      // 모든 아이템의 store_qty를 hq_qty와 동일하게 설정 (변경 없음 표시)
      const itemUpdates = (order.items||[]).map(it =>
        supabase.from('purchase_order_items').update({ store_qty: it.hq_qty }).eq('id', it.id)
      );
      await Promise.all(itemUpdates);
      const { error } = await supabase.from('purchase_orders').update({
        status: 'requested',
        store_note: memoMap[order.id] || null,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (error) throw error;
      toast('발주요청 완료', 'ok');
      setExpanded(null); setEditMap({}); setMemoMap({});
      fetchOrders();
    } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
    setSaving(false);
  };

  // 수량 수정 후 재요청
  const handleRerequest = async (order) => {
    if (!window.confirm('수정한 수량으로 재요청 하시겠습니까?\n\n본사가 매장에 직접 연락하여 수량을 확정합니다.')) return;
    setSaving(true);
    try {
      const itemUpdates = (order.items||[]).map(it => {
        const newQty = Number(editMap[it.id]) || 0;
        return supabase.from('purchase_order_items').update({ store_qty: newQty }).eq('id', it.id);
      });
      await Promise.all(itemUpdates);
      const { error } = await supabase.from('purchase_orders').update({
        status: 'rerequested',
        store_note: memoMap[order.id] || null,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (error) throw error;
      toast('재요청 보냄', 'ok');
      setExpanded(null); setEditMap({}); setMemoMap({});
      fetchOrders();
    } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
    setSaving(false);
  };

  // 입고 확인
  const handleReceive = async (order) => {
    const allOk = (order.items||[]).every(it => recvMap[it.id]?.qty != null);
    if (!allOk) { toast('모든 상품의 입고 수량을 입력해주세요', 'err'); return; }
    if (!window.confirm('입고 확인을 완료 처리하시겠습니까?')) return;
    setSaving(true);
    try {
      const itemUpdates = (order.items||[]).map(it => {
        const r = recvMap[it.id] || { qty: 0, ok: true };
        return supabase.from('purchase_order_items').update({
          received_qty: Number(r.qty)||0,
          received_ok:  !!r.ok,
        }).eq('id', it.id);
      });
      await Promise.all(itemUpdates);

      // 매장재고 +received_qty 반영 (판매입력의 차감 로직의 거울)
      for (const it of (order.items||[])) {
        const r = recvMap[it.id] || { qty: 0 };
        const recv = Number(r.qty) || 0;
        if (recv <= 0 || !it.product?.code || it.received_qty != null) continue;
        const { data: stockRow } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name',  profile.department)
          .eq('branch_name', profile.branch)
          .eq('product_code', it.product.code)
          .maybeSingle();
        if (stockRow) {
          await supabase.from('store_stock').update({
            stock_qty: (stockRow.stock_qty || 0) + recv,
            updated_at: new Date().toISOString(),
          }).eq('id', stockRow.id);
        }
      }

      const { error } = await supabase.from('purchase_orders').update({
        status: 'received',
        received_at: new Date().toISOString(),
        received_by: profile.id,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id);
      if (error) throw error;
      toast('입고 확인 완료 (매장재고 자동 반영)', 'ok');
      setExpanded(null); setRecvMap({});
      fetchOrders();
    } catch (err) { toast('처리 실패: ' + err.message, 'err'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='check'?'on':''}`} onClick={() => { setTab('check'); setExpanded(null); }}>발주 확인</button>
        <button className={`tab ${tab==='receive'?'on':''}`} onClick={() => { setTab('receive'); setExpanded(null); }}>입고 확인</button>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <span className="fresult">
            {tab === 'check' ? '본사 발주 / 응답 대기 중인 발주' : '입고 확인 대기 / 완료된 발주'}
          </span>
          <button className="btn btn-s" onClick={fetchOrders} disabled={loading}>
            {loading ? <span className="spinner"/> : '🔄 새로고침'}
          </button>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div>
          : orders.length === 0 ? <div className="empty">{tab === 'check' ? '발주 데이터가 없습니다' : '입고 대기/완료 발주가 없습니다'}</div>
          : <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:30}}></th>
                  <th>발주일</th>
                  <th>대상기간</th>
                  <th className="r">상품수</th>
                  <th className="r">본사발주합계</th>
                  <th style={{textAlign:'center'}}>상태</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const open = expanded === o.id;
                  const st = STATUS_LABEL[o.status] || { label:o.status, color:'#666', bg:'#f5f5f5', border:'#ddd' };
                  const totalHq = (o.items||[]).reduce((s,i)=>s+i.hq_qty,0);
                  return (
                  <React.Fragment key={o.id}>
                    <tr style={{cursor:'pointer', background: open ? '#f8f9fa' : 'transparent'}}
                      onClick={() => toggleExpand(o)}>
                      <td style={{textAlign:'center', color:'var(--text2)'}}>{open ? '▼' : '▶'}</td>
                      <td className="mono" style={{fontSize:11}}>{new Date(o.created_at).toLocaleDateString('ko-KR')}</td>
                      <td className="mono" style={{fontSize:11}}>{o.week_start} ~ {o.week_end}</td>
                      <td className="r">{o.items?.length || 0}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{totalHq}개</td>
                      <td style={{textAlign:'center'}}>
                        <span style={{display:'inline-block', padding:'2px 10px', borderRadius:4, fontSize:11, fontWeight:700,
                          background:st.bg, color:st.color, border:`1px solid ${st.border}`}}>{st.label}</span>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} style={{background:'#fff', padding:'14px 18px', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)'}}>
                          {/* 발주 확인 탭 */}
                          {tab === 'check' && (
                            <>
                              <div style={{fontSize:13, fontWeight:700, marginBottom:10}}>
                                {o.status === 'sent'        ? '📋 발주 내용 확인'
                                 : o.status === 'requested'  ? '✅ 발주요청 완료 (본사 발주 진행 중)'
                                 : o.status === 'rerequested'? '⚠️ 재요청 보냄 (본사 응답 대기)' : ''}
                              </div>
                              <div className="twrap">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>상품명</th>
                                      <th>코드</th>
                                      <th className="r">지난주 판매</th>
                                      <th className="r">본사 발주</th>
                                      <th className="r" style={{width:130}}>요청 수량</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(o.items||[]).map(it => {
                                      const editing = o.status === 'sent';
                                      const cur = editing ? (editMap[it.id] != null ? editMap[it.id] : it.hq_qty) : (it.store_qty != null ? it.store_qty : it.hq_qty);
                                      const diff = Number(cur) - it.hq_qty;
                                      return (
                                      <tr key={it.id}>
                                        <td>{it.product?.name || '-'}</td>
                                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.product?.code || '-'}</td>
                                        <td className="r" style={{color:'var(--text3)'}}>{it.sold_qty}</td>
                                        <td className="r" style={{fontFamily:'var(--mono)'}}>{it.hq_qty}</td>
                                        <td className="r">
                                          {editing
                                            ? <>
                                                <input type="number" min={0}
                                                  value={editMap[it.id] != null ? editMap[it.id] : it.hq_qty}
                                                  onChange={e => setEditMap(prev => ({...prev, [it.id]: Math.max(0, Number(e.target.value)||0)}))}
                                                  style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right', fontWeight:700}}/>
                                                {diff !== 0 && (
                                                  <div style={{fontSize:10, marginTop:2, color: diff > 0 ? 'var(--success)' : 'var(--danger)', fontWeight:700}}>
                                                    {diff > 0 ? `+${diff}` : diff}
                                                  </div>
                                                )}
                                              </>
                                            : <span style={{fontFamily:'var(--mono)', fontWeight:700}}>{cur}</span>
                                          }
                                        </td>
                                      </tr>
                                    )})}
                                    {/* 매장이 추가한 상품들 (state, 아직 DB 저장 전) */}
                                    {o.status === 'sent' && addedItems.map(a => (
                                      <tr key={a.tempId} style={{background:'#fffde7'}}>
                                        <td>
                                          {a.name}
                                          <span style={{marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px',
                                            background:'#fff3e0', color:'#bf360c', border:'1px solid #ffcc80', borderRadius:3}}>
                                            🆕 매장추가
                                          </span>
                                        </td>
                                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{a.code || '-'}</td>
                                        <td className="r" style={{color:'var(--text3)'}}>-</td>
                                        <td className="r" style={{color:'var(--text3)'}}>-</td>
                                        <td className="r">
                                          <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}>
                                            <input type="number" min={0} value={a.qty}
                                              onChange={e => handleAddedQtyChange(a.tempId, e.target.value)}
                                              style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right', fontWeight:700}}/>
                                            <button onClick={() => handleRemoveAddedItem(a.tempId)}
                                              title="삭제"
                                              style={{height:30, width:30, border:'1px solid var(--border)', borderRadius:4, background:'#fff', cursor:'pointer', fontSize:14, color:'var(--text3)'}}>
                                              ✕
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                    {/* 입력행: 검색 + 수량 + + 추가 (sent 상태일 때만) */}
                                    {o.status === 'sent' && (
                                      <tr style={{background:'#fafafa'}}>
                                        <td colSpan={4} style={{padding:'10px 8px'}}>
                                          <div style={{display:'flex', alignItems:'center', gap:8, position:'relative'}}>
                                            <span style={{fontSize:12, fontWeight:700, color:'var(--text2)'}}>+ 상품 추가</span>
                                            <div style={{flex:1, position:'relative'}}>
                                              <input type="text"
                                                value={searchQ}
                                                placeholder="상품명 또는 코드 검색 (2글자 이상)"
                                                onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); setSelProduct(null); }}
                                                onFocus={() => setSearchOpen(true)}
                                                style={{width:'100%', height:30, padding:'0 10px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, boxSizing:'border-box'}}/>
                                              {searchOpen && searchQ.trim().length >= 2 && (
                                                <div style={{position:'absolute', top:32, left:0, right:0, zIndex:10,
                                                  background:'#fff', border:'1px solid var(--border)', borderRadius:4,
                                                  maxHeight:200, overflowY:'auto', boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
                                                  {searchLoading ? (
                                                    <div style={{padding:'8px 12px', fontSize:11, color:'var(--text3)'}}>검색 중...</div>
                                                  ) : searchResults.length === 0 ? (
                                                    <div style={{padding:'8px 12px', fontSize:11, color:'var(--text3)'}}>검색 결과 없음</div>
                                                  ) : searchResults.map(p => {
                                                    const dup = (o.items||[]).some(it => it.product_id === p.id) || addedItems.some(a => a.product_id === p.id);
                                                    return (
                                                      <button key={p.id} type="button"
                                                        disabled={dup}
                                                        onClick={() => { setSelProduct(p); setSearchQ(`${p.name} (${p.code||'-'})`); setSearchOpen(false); }}
                                                        style={{display:'block', width:'100%', textAlign:'left', padding:'6px 12px',
                                                          border:'none', background: dup ? '#f5f5f5' : '#fff',
                                                          color: dup ? 'var(--text3)' : 'var(--text)',
                                                          cursor: dup ? 'not-allowed' : 'pointer', fontSize:12,
                                                          borderBottom:'1px solid var(--border)'}}>
                                                        {p.name}
                                                        <span style={{marginLeft:8, fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)'}}>{p.code || '-'}</span>
                                                        {dup && <span style={{marginLeft:8, fontSize:10, color:'var(--danger)'}}>이미 있음</span>}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="r">
                                          <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6}}>
                                            <input type="number" min={1} value={addQty}
                                              placeholder="수량"
                                              onChange={e => setAddQty(e.target.value)}
                                              style={{width:60, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, textAlign:'right'}}/>
                                            <button type="button"
                                              disabled={!selProduct || !(Number(addQty)>0)}
                                              onClick={() => handleAddItem(o)}
                                              style={{height:30, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:4,
                                                background: (selProduct && Number(addQty)>0) ? 'var(--accent)' : '#fff',
                                                color: (selProduct && Number(addQty)>0) ? '#fff' : 'var(--text3)',
                                                fontSize:11, fontWeight:700,
                                                cursor: (selProduct && Number(addQty)>0) ? 'pointer' : 'not-allowed'}}>
                                              + 추가
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {o.status === 'sent' && (
                                <>
                                  <div style={{marginTop:12}}>
                                    <label style={{fontSize:11, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:4}}>메모 (선택)</label>
                                    <input value={memoMap[o.id] || ''}
                                      onChange={e => setMemoMap(prev => ({...prev, [o.id]: e.target.value}))}
                                      placeholder="재요청 사유 등"
                                      style={{width:'100%', height:34, padding:'0 10px', border:'1px solid var(--border)', borderRadius:4, fontSize:12, boxSizing:'border-box'}}/>
                                  </div>
                                  <div style={{display:'flex', gap:8, marginTop:12, justifyContent:'flex-end'}}>
                                    <button className="btn btn-s" onClick={() => handleRequestAsIs(o)} disabled={saving} style={{padding:'0 18px', height:38, fontSize:13, fontWeight:700}}>
                                      ✓ 그대로 발주요청
                                    </button>
                                    <button className="btn btn-p" onClick={() => handleRerequest(o)} disabled={saving} style={{padding:'0 18px', height:38, fontSize:13, fontWeight:700}}>
                                      ✏️ 수정 후 재요청
                                    </button>
                                  </div>
                                </>
                              )}
                              {o.store_note && o.status !== 'sent' && (
                                <div style={{marginTop:12, padding:'8px 12px', background:'#f5f7fa', border:'1px solid var(--border)', borderRadius:4, fontSize:12}}>
                                  💬 매장 메모: {o.store_note}
                                </div>
                              )}
                            </>
                          )}

                          {/* 입고 확인 탭 */}
                          {tab === 'receive' && (
                            <>
                              <div style={{fontSize:13, fontWeight:700, marginBottom:10}}>
                                {o.status === 'received' ? '✅ 입고 완료 내역' : '📦 입고 수량 확인'}
                              </div>
                              <div className="twrap">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>상품명</th>
                                      <th>코드</th>
                                      <th className="r">발주 수량</th>
                                      <th className="r" style={{width:130}}>입고 수량</th>
                                      <th style={{textAlign:'center', width:120}}>이상유무</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(o.items||[]).map(it => {
                                      const editing = o.status !== 'received';
                                      const orderedQty = it.store_qty != null ? it.store_qty : it.hq_qty;
                                      const r = recvMap[it.id] || { qty: orderedQty, ok: true };
                                      return (
                                      <tr key={it.id}>
                                        <td>{it.product?.name || '-'}</td>
                                        <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>{it.product?.code || '-'}</td>
                                        <td className="r" style={{fontFamily:'var(--mono)'}}>{orderedQty}</td>
                                        <td className="r">
                                          {editing
                                            ? <input type="number" min={0} value={r.qty}
                                                onChange={e => setRecvMap(prev => ({...prev, [it.id]: { ...r, qty: Math.max(0, Number(e.target.value)||0) }}))}
                                                style={{width:80, height:30, padding:'0 8px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, textAlign:'right'}}/>
                                            : <span style={{fontFamily:'var(--mono)', fontWeight:700}}>{it.received_qty}</span>
                                          }
                                        </td>
                                        <td style={{textAlign:'center'}}>
                                          {editing ? (
                                            <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                                              <button onClick={() => setRecvMap(prev => ({...prev, [it.id]: { ...r, ok: true }}))}
                                                style={{height:30, padding:'0 10px', border:'1px solid', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer',
                                                  borderColor: r.ok ? 'var(--success)' : 'var(--border)',
                                                  background: r.ok ? '#e8f5e9' : '#fff',
                                                  color: r.ok ? 'var(--success)' : 'var(--text3)'}}>
                                                ✅ 정상
                                              </button>
                                              <button onClick={() => setRecvMap(prev => ({...prev, [it.id]: { ...r, ok: false }}))}
                                                style={{height:30, padding:'0 10px', border:'1px solid', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer',
                                                  borderColor: !r.ok ? 'var(--danger)' : 'var(--border)',
                                                  background: !r.ok ? '#ffebee' : '#fff',
                                                  color: !r.ok ? 'var(--danger)' : 'var(--text3)'}}>
                                                ❌ 이상
                                              </button>
                                            </div>
                                          ) : (
                                            <span style={{color: it.received_ok ? 'var(--success)' : 'var(--danger)', fontWeight:700}}>
                                              {it.received_ok ? '✅ 정상' : '❌ 이상'}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    )})}
                                  </tbody>
                                </table>
                              </div>
                              {o.status !== 'received' && (
                                <div style={{display:'flex', justifyContent:'flex-end', marginTop:12}}>
                                  <button className="btn btn-p" onClick={() => handleReceive(o)} disabled={saving}
                                    style={{padding:'0 22px', height:40, fontWeight:700}}>
                                    {saving ? <span className="spinner"/> : '✓ 입고 확인 완료'}
                                  </button>
                                </div>
                              )}
                              {o.received_at && (
                                <div style={{marginTop:10, fontSize:11, color:'var(--text3)', textAlign:'right'}}>
                                  입고 확인: {new Date(o.received_at).toLocaleString('ko-KR')}
                                </div>
                              )}
                            </>
                          )}
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
    </div>
  );
}
