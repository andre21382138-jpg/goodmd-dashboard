import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, formatNumInput, parseNumInput } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

export default function MgrSalesViewPage({ profile }) {
  // 본사 계정(admin/hq — 매니저 아님)은 점포/지점 선택해서 조회 + 라인 수정 가능
  const isStoreMgr = profile?.job_title === '매니저';
  const isHQ = !isStoreMgr;
  const [hqStore,  setHqStore]  = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const hqBranchOptions = useMemo(() => hqStore ? (STORE_MAP[hqStore] || []) : [], [hqStore]);

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const todayStr = fmt(today);
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;

  // 수정 권한: 본사(HQ)는 전체, 매장 매니저는 '당월' 매출만 (판매수량/판매금액)
  const curMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
  const isCurrentMonth = (sold_at) => String(sold_at || '').slice(0, 7) === curMonth;
  const canEditLine = (it) => isHQ || isCurrentMonth(it.sold_at);

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo,   setFTo]   = useState(todayStr);
  const [sales, setSales] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);
  const [expandedTxn, setExpandedTxn]   = useState(null);  // 트랜잭션 그룹 식별자(첫 라인의 id)

  // 본사 계정용 라인 인라인 수정
  const [editingLine, setEditingLine] = useState(null);  // sale id
  const [editDraft,   setEditDraft]   = useState({});    // { quantity, price, payment, memo }
  const [savingLine,  setSavingLine]  = useState(false);

  const startEditLine = (it) => {
    setEditingLine(it.id);
    setEditDraft({
      quantity: it.quantity,
      price:    it.price,
      payment:  it.payment || '카드',
      memo:     it.memo || '',
    });
  };
  const cancelEditLine = () => { setEditingLine(null); setEditDraft({}); };
  const saveEditLine = async (it) => {
    // 매장 매니저는 당월 매출만 수정 가능 (방어)
    if (!isHQ && !isCurrentMonth(it.sold_at)) { toast('당월 매출만 수정할 수 있습니다', 'err'); return; }
    const qty   = Number(editDraft.quantity);
    const price = Number(parseNumInput(editDraft.price));
    if (!Number.isFinite(qty) || qty === 0) { toast('수량은 0이 아닌 숫자여야 합니다', 'err'); return; }
    if (!Number.isFinite(price))            { toast('판매금액이 유효하지 않습니다', 'err'); return; }
    if (!isHQ && (qty < 0 || price < 0))    { toast('수량·판매금액은 0 이상이어야 합니다', 'err'); return; }
    setSavingLine(true);
    try {
      // 매장 매니저는 수량·금액만 갱신 (결제수단/메모는 본사만)
      const patch = isHQ
        ? { quantity: qty, price, payment: editDraft.payment || '카드', memo: editDraft.memo?.trim() || null }
        : { quantity: qty, price };
      const { error } = await supabase.from('sales').update(patch).eq('id', it.id);
      if (error) throw error;
      toast('수정 완료', 'ok');
      cancelEditLine();
      fetchSales();
    } catch (err) {
      toast('수정 실패: ' + (err.message || err), 'err');
    }
    setSavingLine(false);
  };
  const deleteLine = async (it) => {
    if (!window.confirm(`이 라인을 삭제하시겠습니까?\n\n상품: ${it.product?.name || '-'}\n수량: ${it.quantity}\n단가: ${Number(it.price).toLocaleString()}원\n\n해당 sales row가 영구 삭제됩니다.`)) return;
    setSavingLine(true);
    try {
      const { error } = await supabase.from('sales').delete().eq('id', it.id);
      if (error) throw error;
      toast('라인 삭제 완료', 'inf');
      cancelEditLine();
      fetchSales();
    } catch (err) {
      toast('삭제 실패: ' + (err.message || err), 'err');
    }
    setSavingLine(false);
  };

  const setRange = (type) => {
    if (type === 'today') {
      setFFrom(todayStr); setFTo(todayStr);
    } else if (type === 'yesterday') {
      const y = new Date(today); y.setDate(today.getDate()-1);
      setFFrom(fmt(y)); setFTo(fmt(y));
    } else if (type === 'thismonth') {
      setFFrom(monthStart); setFTo(todayStr);
    } else if (type === 'lastmonth') {
      const first = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      setFFrom(fmt(first)); setFTo(fmt(last));
    }
  };

  const fetchSales = useCallback(async () => {
    if (!fFrom || !fTo) { toast('기간을 선택해주세요', 'err'); return; }
    if (!storeName || !branchName) {
      setSales([]); setLoading(false); return;
    }
    setLoading(true);
    setExpandedDate(null);
    const { data, error } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name,code), customer:customers(name,phone)')
      .eq('store_name', storeName)
      .eq('branch_name', branchName)
      .gte('sold_at', fFrom).lte('sold_at', fTo)
      .order('sold_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) toast(error.message, 'err');
    // 새 정책: 반품은 음수 매출 row로 처리되므로 returned_qty는 무시 (이중 반품 방지용으로만 보존)
    else setSales((data || []).map(r => ({...r, _eff: (r.quantity || 0)})));
    setLoading(false);
  }, [fFrom, fTo, storeName, branchName]);

  useEffect(() => { fetchSales(); }, []); // 최초 1회 (당월)

  // 1) 트랜잭션 단위 그룹화 — 같은 sold_at + customer + created_at 60초 윈도 = 1 결제묶음
  // 2) 일자별 집계는 트랜잭션 수 기준으로 (사용자 요청: 6개 상품 1번 결제 = 판매건수 1건)
  const { dailyRows, dailyDetails, totals } = useMemo(() => {
    // 1단계: 트랜잭션 그룹
    const txnGroups = [];
    const groupMap = new Map();
    for (const r of sales) {
      if (r._eff <= 0) continue;
      const custKey = r.customer_id || `__noc_${r.id}`;
      const baseKey = `${r.sold_at}|${custKey}`;
      const ts = new Date(r.created_at || 0).getTime();
      let g = groupMap.get(baseKey);
      if (g && Math.abs(ts - g.lastTs) <= 60000) {
        g.rows.push(r); g.lastTs = ts;
      } else {
        g = { date: r.sold_at, rows: [r], firstTs: ts, lastTs: ts };
        groupMap.set(baseKey, g);
        txnGroups.push(g);
      }
    }
    // 2단계: 일자 집계 (트랜잭션 단위로 카운트)
    const dMap = new Map();
    const dDetails = {};
    let totC = 0, totQ = 0, totA = 0;
    let delC = 0, delA = 0;
    for (const g of txnGroups) {
      const d = g.date;
      const gQty = g.rows.reduce((s, r) => s + r._eff, 0);
      const gAmt = g.rows.reduce((s, r) => s + Math.round(r.price * r._eff), 0);
      if (!dMap.has(d)) dMap.set(d, { date: d, count: 0, qty: 0, amt: 0 });
      const e = dMap.get(d);
      e.count++; e.qty += gQty; e.amt += gAmt;
      if (!dDetails[d]) dDetails[d] = [];
      dDetails[d].push(g);
      totC++; totQ += gQty; totA += gAmt;
      // 택배는 라인 단위(트랜잭션 일부만 택배일 수도 있음)
      for (const r of g.rows) {
        if (r.delivery_requested) { delC++; delA += Math.round(r.price * r._eff); }
      }
    }
    const list = [...dMap.values()].sort((a,b) => b.date.localeCompare(a.date));
    return { dailyRows: list, dailyDetails: dDetails, totals: { count: totC, qty: totQ, amt: totA, deliveryCount: delC, deliveryAmt: delA } };
  }, [sales]);

  const isToday     = fFrom === todayStr   && fTo === todayStr;
  const yest = new Date(today); yest.setDate(today.getDate()-1);
  const yestStr = fmt(yest);
  const isYesterday = fFrom === yestStr    && fTo === yestStr;
  const isThisMonth = fFrom === monthStart && fTo === todayStr;
  const lmFirst = new Date(today.getFullYear(), today.getMonth()-1, 1);
  const lmLast  = new Date(today.getFullYear(), today.getMonth(), 0);
  const isLastMonth = fFrom === fmt(lmFirst) && fTo === fmt(lmLast);

  const quickBtn = (active) => ({
    height:34, padding:'0 12px', border:'2px solid', borderRadius:'var(--radius)',
    fontSize:12, fontWeight:700, cursor:'pointer',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    background:  active ? '#fff3e0' : '#fff',
    color:       active ? 'var(--accent)' : 'var(--text2)',
  });

  return (
    <div>
      {/* 필터 */}
      <div className="card">
        <div className="card-label">매출 조회</div>
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
            {(storeName && branchName) && (
              <span style={{fontSize:11, color:'#2e7d32', alignSelf:'center', fontWeight:700}}>📍 {storeName} · {branchName} (본사 — 라인 수정 가능)</span>
            )}
          </div>
        )}
        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="시작일"/>
          <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="종료일"/>
          <button style={quickBtn(isToday)}     onClick={() => setRange('today')}>오늘</button>
          <button style={quickBtn(isYesterday)} onClick={() => setRange('yesterday')}>어제</button>
          <button style={quickBtn(isThisMonth)} onClick={() => setRange('thismonth')}>당월</button>
          <button style={quickBtn(isLastMonth)} onClick={() => setRange('lastmonth')}>전월</button>
          <div className="fbar-right">
            <button className="btn btn-p" onClick={fetchSales} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔍 조회'}
            </button>
          </div>
        </div>
      </div>

      {/* 요약 */}
      {sales.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
          {[
            { label:'기간 매출', value: totals.amt.toLocaleString()+'원', color:'var(--accent)', big:true },
            { label:'판매 건수', value: totals.count.toLocaleString()+'건' },
            { label:'판매 수량', value: totals.qty.toLocaleString()+'개' },
            { label:'🚚 택배발송', value: totals.deliveryAmt.toLocaleString()+'원 ('+totals.deliveryCount.toLocaleString()+'건)', color:'#e65100', borderColor:'#ffcc80' },
          ].map(s => (
            <div key={s.label} style={{
              background:'#fff',
              border: s.big ? '2px solid var(--sidebar)'
                    : s.borderColor ? `2px solid ${s.borderColor}`
                    : '1px solid var(--border)',
              borderRadius:'var(--radius)', padding:'14px 18px'
            }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:s.big?22:14, fontWeight:700, color: s.color || 'var(--text)', fontFamily:'var(--mono)', lineHeight:1.3 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 일자별 결과 */}
      {dailyRows.length === 0 && !loading && (
        <div className="empty">조회된 판매 내역이 없습니다</div>
      )}
      {dailyRows.length > 0 && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div style={{marginBottom:10}}>
            <span className="fresult"><b>{dailyRows.length}</b>일 / 총 <b>{totals.count.toLocaleString()}</b>건 · <b>{totals.amt.toLocaleString()}</b>원</span>
            <span style={{fontSize:11, color:'var(--text3)', marginLeft:8}}>(행 클릭 시 판매 상세 펼쳐짐)</span>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th className="r">판매건수</th>
                  <th className="r">판매수량</th>
                  <th className="r">매출금액</th>
                  <th style={{textAlign:'center', width:90}}></th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map(r => {
                  const open = expandedDate === r.date;
                  const items = dailyDetails[r.date] || [];
                  return (
                  <React.Fragment key={r.date}>
                    <tr style={{cursor:'pointer', background: open ? '#fff8e1' : 'transparent'}}
                      onClick={() => setExpandedDate(open ? null : r.date)}>
                      <td className="mono" style={{fontWeight:700}}>{r.date}</td>
                      <td className="r">{r.count.toLocaleString()}건</td>
                      <td className="r">{r.qty.toLocaleString()}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)'}}>{r.amt.toLocaleString()}원</td>
                      <td style={{textAlign:'center'}}>
                        <button className="btn btn-s" style={{padding:'3px 12px', fontSize:11}}
                          onClick={(e) => { e.stopPropagation(); setExpandedDate(open ? null : r.date); }}>
                          {open ? '▲ 닫기' : '▼ 조회'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={5} style={{background:'#fafafa', padding:'10px 14px', borderTop:'2px solid var(--accent)'}}>
                          <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8}}>
                            📋 {r.date} 판매 내역 — {items.length}건 (결제 묶음)
                          </div>
                          <div className="twrap" style={{background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)'}}>
                            <table>
                              <thead>
                                <tr>
                                  <th>브랜드</th>
                                  <th>상품명</th>
                                  <th className="r">총 수량</th>
                                  <th className="r">총 합계</th>
                                  <th className="r">적립금사용</th>
                                  <th>결제</th>
                                  <th>출고방식</th>
                                  <th>고객</th>
                                  <th style={{textAlign:'center'}}>상세</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map(g => {
                                  const txnId = g.rows[0].id;
                                  const isTxnOpen = expandedTxn === txnId;
                                  const head = g.rows[0];
                                  const allFully = false; // 새 정책: 반품은 별도 음수 row, 원본은 그대로
                                  const isAllReturnEntries = g.rows.every(x => (Number(x.price)||0) < 0 || x.payment === '반품');
                                  const gQty = g.rows.reduce((s, x) => s + x._eff, 0);
                                  const gAmt = g.rows.reduce((s, x) => s + Math.round(x.price * x._eff), 0);
                                  const gPts = g.rows.reduce((s, x) => s + (Number(x.points_used)||0), 0);
                                  const paymentSet = Array.from(new Set(g.rows.map(x => x.payment).filter(p => p && p !== '적립금사용')));
                                  const extraCount = g.rows.length - 1;
                                  const strike = allFully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                                  return (
                                  <React.Fragment key={txnId}>
                                  <tr style={{...(allFully?{background:'#fafafa'}:{}), ...(isTxnOpen?{background:'#fff8e1'}:{})}}>
                                    <td style={strike}>{head.brand?.name || '-'}</td>
                                    <td style={{fontSize:12, ...strike}}>
                                      <strong>{head.product?.name || '-'}</strong>
                                      {extraCount > 0 && (
                                        <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#1565C0', background:'#e3f2fd', border:'1px solid #90caf9', padding:'1px 6px', borderRadius:3}}>
                                          외 {extraCount}개
                                        </span>
                                      )}
                                    </td>
                                    <td className="r" style={strike}>{gQty}</td>
                                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)', ...strike}}>{gAmt.toLocaleString()}원</td>
                                    <td className="r" style={{color: gPts>0?'#6a1b9a':'var(--text3)', fontFamily:'var(--mono)', ...(allFully?{opacity:0.5}:{})}}>
                                      {gPts > 0 ? `-${gPts.toLocaleString()}` : '-'}
                                    </td>
                                    <td>
                                      {paymentSet.map(p => (
                                        <span key={p} className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, marginRight:2, ...(allFully?{opacity:0.5}:{})}}>{p}</span>
                                      ))}
                                    </td>
                                    <td style={strike}>
                                      {(!head.delivery_type || head.delivery_type === 'none') && <span style={{fontSize:10, fontWeight:700, color:'#455a64', background:'#eceff1', border:'1px solid #b0bec5', padding:'1px 6px', borderRadius:3}}>매장판매</span>}
                                      {head.delivery_type === 'store' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(매장)</span>}
                                      {head.delivery_type === 'hq' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(본사)</span>}
                                    </td>
                                    <td style={{fontSize:12}}>{head.customer ? <span style={{color:'var(--success)',fontWeight:600}}>👤 {head.customer.name}</span> : '-'}</td>
                                    <td style={{textAlign:'center'}}>
                                      <button className="btn btn-s" style={{padding:'3px 10px', fontSize:11}}
                                        onClick={() => setExpandedTxn(isTxnOpen ? null : txnId)}>
                                        {isTxnOpen ? '▲ 닫기' : '▼ 상세'}
                                      </button>
                                    </td>
                                  </tr>
                                  {isTxnOpen && (
                                    <tr>
                                      <td colSpan={9} style={{background:'#fafafa', padding:'8px 12px', borderTop:'1px dashed var(--border)'}}>
                                        <div className="twrap" style={{background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)'}}>
                                          <table>
                                            <thead>
                                              <tr>
                                                <th>상품명</th>
                                                <th className="r">수량</th>
                                                <th className="r">단가</th>
                                                <th className="r">합계</th>
                                                <th className="r">적립금</th>
                                                <th>결제</th>
                                                <th>출고방식</th>
                                                <th>메모</th>
                                                <th style={{textAlign:'center', width:80}}>작업</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {g.rows.map(it => {
                                                // 새 정책: 반품 표시는 음수 매출 row 기준
                                                const fully = false;
                                                const partial = false;
                                                const eff = it._eff;
                                                const lineStrike = fully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                                                return (
                                                <tr key={it.id} style={fully?{background:'#fafafa'}:{}}>
                                                  <td style={{fontSize:12, ...lineStrike}}>
                                                    {it.product?.name || '-'}
                                                    {it.product?.code && <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>코드: {it.product.code}</div>}
                                                    {fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                                                    {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {it.returned_qty}</span>}
                                                  </td>
                                                  <td className="r" style={lineStrike}>{eff}</td>
                                                  <td className="r" style={{fontFamily:'var(--mono)', ...lineStrike}}>{Math.round(Number(it.price)).toLocaleString()}원</td>
                                                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)', ...lineStrike}}>{Math.round(it.price*eff).toLocaleString()}원</td>
                                                  <td className="r" style={{color:(it.points_used||0)>0?'#6a1b9a':'var(--text3)', fontFamily:'var(--mono)', ...(fully?{opacity:0.5}:{})}}>
                                                    {(it.points_used||0) > 0 ? `-${Number(it.points_used).toLocaleString()}` : '-'}
                                                  </td>
                                                  <td>{it.payment && it.payment !== '적립금사용' && <span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, ...(fully?{opacity:0.5}:{})}}>{it.payment}</span>}</td>
                                                  <td style={lineStrike}>
                                                    {(!it.delivery_type || it.delivery_type === 'none') && <span style={{fontSize:10, fontWeight:700, color:'#455a64', background:'#eceff1', border:'1px solid #b0bec5', padding:'1px 6px', borderRadius:3}}>매장판매</span>}
                                                    {it.delivery_type === 'store' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(매장)</span>}
                                                    {it.delivery_type === 'hq' && it.delivery_status !== 'dispatched' && <span style={{fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(본사)</span>}
                                                    {it.delivery_type === 'hq' && it.delivery_status === 'dispatched' && <span style={{fontSize:10, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 6px', borderRadius:3}}>택배(본사)</span>}
                                                  </td>
                                                  <td style={{fontSize:11,color:'var(--text2)'}}>{it.memo||'-'}</td>
                                                  <td style={{textAlign:'center'}}>
                                                    {canEditLine(it) ? (
                                                      <button type="button" onClick={() => startEditLine(it)}
                                                        title={isHQ ? '라인 수정' : '당월 매출 수정 (수량·금액)'}
                                                        style={{padding:'2px 8px', fontSize:11, border:'1px solid var(--accent)', borderRadius:4, background:'#fff3e0', color:'var(--accent)', fontWeight:700, cursor:'pointer'}}>
                                                        ✏️ 수정
                                                      </button>
                                                    ) : (
                                                      <span style={{fontSize:10, color:'var(--text3)'}} title="당월 매출만 수정 가능">–</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              )})}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  </React.Fragment>
                                )})}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )})}
                <tr style={{background:'var(--bg3)',borderTop:'2px solid var(--border2)'}}>
                  <td style={{padding:'9px 11px',fontWeight:700}}>합계</td>
                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{totals.count.toLocaleString()}건</td>
                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{totals.qty.toLocaleString()}개</td>
                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)',fontSize:14}}>{totals.amt.toLocaleString()}원</td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 본사 라인 수정 모달 */}
      {editingLine && (() => {
        const it = sales.find(s => s.id === editingLine);
        if (!it) return null;
        const PAYMENTS = ['카드','현금','증정','시식','반품'];
        return (
          <div style={{position:'fixed', inset:0, zIndex:400, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}} onClick={cancelEditLine}/>
            <div style={{position:'relative', background:'#fff', borderRadius:12, padding:'22px 24px', width:'90vw', maxWidth:520, boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:14}}>
                <strong style={{fontSize:15}}>✏️ 매출 라인 수정</strong>
                <span style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)'}}>ID:{it.id} · {it.sold_at}</span>
                <button type="button" onClick={cancelEditLine}
                  style={{marginLeft:'auto', background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
              </div>
              <div style={{fontSize:13, fontWeight:600, marginBottom:14}}>{it.product?.name || '-'}</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>수량</label>
                  <input type="number" value={editDraft.quantity ?? ''}
                    onChange={e => setEditDraft(p => ({...p, quantity: e.target.value}))}
                    style={{width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, textAlign:'right', fontFamily:'var(--mono)'}}/>
                </div>
                <div>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>{isHQ ? '단가 (원) · 음수=반품' : '판매금액 (단가)'}</label>
                  <input type="text" inputMode="numeric" value={formatNumInput(editDraft.price)}
                    onChange={e => setEditDraft(p => ({...p, price: parseNumInput(e.target.value)}))}
                    style={{width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, textAlign:'right', fontFamily:'var(--mono)'}}/>
                </div>
              </div>
              {/* 결제수단/메모/삭제는 본사(HQ)만 — 매장 매니저는 당월 수량·금액만 수정 */}
              {isHQ && (
                <div style={{marginBottom:12}}>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>결제수단</label>
                  <div style={{display:'flex', gap:4}}>
                    {PAYMENTS.map(p => {
                      const active = editDraft.payment === p;
                      return (
                        <button key={p} type="button" onClick={() => setEditDraft(d => ({...d, payment: p}))}
                          style={{
                            flex:1, height:34, border:`1px solid ${active?'var(--accent)':'var(--border)'}`, borderRadius:6,
                            background: active ? '#fff3e0' : '#fff',
                            color:      active ? 'var(--accent)' : 'var(--text2)',
                            fontWeight: active ? 700 : 500, fontSize:12, cursor:'pointer',
                          }}>{p}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              {isHQ && (
                <div style={{marginBottom:14}}>
                  <label style={{display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:4}}>메모</label>
                  <input type="text" value={editDraft.memo ?? ''}
                    onChange={e => setEditDraft(p => ({...p, memo: e.target.value}))}
                    style={{width:'100%', height:36, padding:'0 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13}}/>
                </div>
              )}
              <div style={{padding:'10px 12px', background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:6, fontSize:11, color:'#6d4c41', marginBottom:14}}>
                {isHQ
                  ? '⚠️ 합계 = 수량 × 단가. 반품 음수 매출은 단가에 음수 입력. 회원 적립금/누적구매는 자동 보정되지 않으므로 필요 시 별도 조정.'
                  : '⚠️ 당월 매출의 수량·판매금액만 수정됩니다. 합계 = 수량 × 판매금액.'}
              </div>
              <div style={{display:'flex', gap:8}}>
                {isHQ && (
                  <button type="button" onClick={() => deleteLine(it)} disabled={savingLine}
                    style={{height:38, padding:'0 14px', border:'1px solid var(--danger)', borderRadius:6, background:'#fff', color:'var(--danger)', fontWeight:700, fontSize:12, cursor:'pointer'}}>
                    🗑️ 삭제
                  </button>
                )}
                <button type="button" onClick={cancelEditLine} disabled={savingLine}
                  style={{flex:1, height:38, padding:'0 14px', border:'1px solid var(--border)', borderRadius:6, background:'#fafafa', color:'var(--text2)', fontWeight:700, fontSize:13, cursor:'pointer'}}>
                  취소
                </button>
                <button type="button" onClick={() => saveEditLine(it)} disabled={savingLine}
                  style={{flex:1, height:38, padding:'0 14px', border:'1px solid var(--accent)', borderRadius:6, background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer'}}>
                  {savingLine ? <span className="spinner"/> : '💾 저장'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
