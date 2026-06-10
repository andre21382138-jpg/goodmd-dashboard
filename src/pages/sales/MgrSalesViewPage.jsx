import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function MgrSalesViewPage({ profile }) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const todayStr = fmt(today);
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo,   setFTo]   = useState(todayStr);
  const [sales, setSales] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);
  const [expandedTxn, setExpandedTxn]   = useState(null);  // 트랜잭션 그룹 식별자(첫 라인의 id)

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
    setLoading(true);
    setExpandedDate(null);
    const { data, error } = await supabase.from('sales')
      .select('*, brand:brands(name), product:products(name,code), customer:customers(name,phone)')
      .eq('store_name', profile.department)
      .eq('branch_name', profile.branch)
      .gte('sold_at', fFrom).lte('sold_at', fTo)
      .order('sold_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) toast(error.message, 'err');
    // 새 정책: 반품은 음수 매출 row로 처리되므로 returned_qty는 무시 (이중 반품 방지용으로만 보존)
    else setSales((data || []).map(r => ({...r, _eff: (r.quantity || 0)})));
    setLoading(false);
  }, [fFrom, fTo, profile.department, profile.branch]);

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
      const gAmt = g.rows.reduce((s, r) => s + r.price * r._eff, 0);
      if (!dMap.has(d)) dMap.set(d, { date: d, count: 0, qty: 0, amt: 0 });
      const e = dMap.get(d);
      e.count++; e.qty += gQty; e.amt += gAmt;
      if (!dDetails[d]) dDetails[d] = [];
      dDetails[d].push(g);
      totC++; totQ += gQty; totA += gAmt;
      // 택배는 라인 단위(트랜잭션 일부만 택배일 수도 있음)
      for (const r of g.rows) {
        if (r.delivery_requested) { delC++; delA += r.price * r._eff; }
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
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
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
                                  const gAmt = g.rows.reduce((s, x) => s + x.price * x._eff, 0);
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
                                                  <td className="r" style={{fontFamily:'var(--mono)', ...lineStrike}}>{Number(it.price).toLocaleString()}원</td>
                                                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)', ...lineStrike}}>{(it.price*eff).toLocaleString()}원</td>
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
    </div>
  );
}
