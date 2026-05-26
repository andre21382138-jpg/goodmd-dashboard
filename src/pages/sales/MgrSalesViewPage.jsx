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
    else setSales((data || []).map(r => ({...r, _eff: Math.max(0,(r.quantity||0)-(r.returned_qty||0))})));
    setLoading(false);
  }, [fFrom, fTo, profile.department, profile.branch]);

  useEffect(() => { fetchSales(); }, []); // 최초 1회 (당월)

  // 일자별 그룹핑
  const { dailyRows, dailyDetails, totals } = useMemo(() => {
    const dMap = new Map();
    const dDetails = {};
    let totC = 0, totQ = 0, totA = 0;
    let delC = 0, delA = 0;
    for (const r of sales) {
      if (r._eff <= 0) continue;
      const d = r.sold_at;
      if (!dMap.has(d)) dMap.set(d, { date: d, count: 0, qty: 0, amt: 0 });
      const e = dMap.get(d);
      e.count++; e.qty += r._eff; e.amt += r.price * r._eff;
      if (!dDetails[d]) dDetails[d] = [];
      dDetails[d].push(r);
      totC++; totQ += r._eff; totA += r.price * r._eff;
      if (r.delivery_requested) { delC++; delA += r.price * r._eff; }
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
                            📋 {r.date} 판매 내역 ({items.length}건)
                          </div>
                          <div className="twrap" style={{background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)'}}>
                            <table>
                              <thead>
                                <tr>
                                  <th>브랜드</th>
                                  <th>상품명</th>
                                  <th className="r">수량</th>
                                  <th className="r">단가</th>
                                  <th className="r">합계</th>
                                  <th className="r">적립금사용</th>
                                  <th>결제</th>
                                  <th>고객</th>
                                  <th>메모</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map(it => {
                                  const fully = (it.returned_qty||0) >= (it.quantity||0);
                                  const partial = (it.returned_qty||0) > 0 && !fully;
                                  const eff = it._eff;
                                  const strike = fully ? { textDecoration:'line-through', color:'var(--text3)' } : {};
                                  return (
                                  <tr key={it.id} style={fully?{background:'#fafafa'}:{}}>
                                    <td style={strike}>{it.brand?.name || '-'}</td>
                                    <td style={{fontSize:12, ...strike}}>
                                      <strong>{it.product?.name || '-'}</strong>
                                      {it.product?.code && <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>코드: {it.product.code}</div>}
                                      {it.delivery_type === 'store' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(매장)</span>}
                                      {it.delivery_type === 'hq' && it.delivery_status !== 'dispatched' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'1px 6px', borderRadius:3}}>택배(본사)</span>}
                                      {it.delivery_type === 'hq' && it.delivery_status === 'dispatched' && !fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'1px 6px', borderRadius:3}}>택배(본사)</span>}
                                      {fully && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'var(--danger)', background:'#fce4ec', border:'1px solid #f48fb1', padding:'1px 6px', borderRadius:3}}>반품됨</span>}
                                      {partial && <span style={{marginLeft:6, fontSize:10, fontWeight:700, color:'#6a1b9a', background:'#f3e5f5', border:'1px solid #ce93d8', padding:'1px 6px', borderRadius:3}}>부분반품 {it.returned_qty}</span>}
                                    </td>
                                    <td className="r" style={strike}>{eff}</td>
                                    <td className="r" style={{fontFamily:'var(--mono)', ...strike}}>{Number(it.price).toLocaleString()}원</td>
                                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)', ...strike}}>{(it.price*eff).toLocaleString()}원</td>
                                    <td className="r" style={{color:(it.points_used||0)>0?'#6a1b9a':'var(--text3)', fontFamily:'var(--mono)', ...(fully?{opacity:0.5}:{})}}>
                                      {(it.points_used||0) > 0 ? `-${Number(it.points_used).toLocaleString()}` : '-'}
                                    </td>
                                    <td><span className="badge" style={{background:'#e3f2fd',color:'#1565C0',border:'1px solid #90caf9',fontSize:11, ...(fully?{opacity:0.5}:{})}}>{it.payment}</span></td>
                                    <td style={{fontSize:12}}>{it.customer ? <span style={{color:'var(--success)',fontWeight:600}}>👤 {it.customer.name}</span> : '-'}</td>
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
