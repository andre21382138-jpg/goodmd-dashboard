import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

// 매장용 — 본사가 처리/발송하는 택배(본사요청, delivery_type='hq') 내역 조회
// 자기 매장(store_name + branch_name)으로 자동 필터
export default function StoreDeliveryStatusPage({ profile }) {
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const minusDays = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const [tab, setTab] = useState('pending'); // 'pending' | 'dispatched'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fFrom, setFFrom] = useState(minusDays(30));
  const [fTo,   setFTo]   = useState(todayStr());

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('sales')
      .select('id, sold_at, recipient_name, recipient_phone, recipient_address, delivery_notes, delivery_type, delivery_status, dispatched_at, tracking_number, quantity, price, memo, brand:brands(name), product:products(name, code)')
      .eq('store_name',  profile.department)
      .eq('branch_name', profile.branch)
      .eq('delivery_type', 'hq');

    if (tab === 'pending') {
      // 발송 대기 — 미발송 (delivery_status가 'dispatched' 아닌 것)
      q = q.or('delivery_status.is.null,delivery_status.neq.dispatched')
        .order('sold_at', { ascending: false })
        .limit(300);
    } else {
      // 발송 완료 — 기간 + dispatched_at
      q = q.eq('delivery_status', 'dispatched');
      if (fFrom) q = q.gte('dispatched_at', `${fFrom}T00:00:00`);
      if (fTo)   q = q.lte('dispatched_at', `${fTo}T23:59:59`);
      q = q.order('dispatched_at', { ascending: false }).limit(500);
    }
    const { data, error } = await q;
    if (error) toast(error.message, 'err');
    else setRows(data || []);
    setLoading(false);
  }, [tab, fFrom, fTo, profile.department, profile.branch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 수취인 단위로 그룹화 (한 결제에서 여러 상품이 같은 수취인으로 가는 케이스)
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = `${r.sold_at}|${r.recipient_name || ''}|${r.recipient_phone || ''}|${r.tracking_number || ''}`;
      if (!map.has(key)) map.set(key, {
        key,
        sold_at: r.sold_at,
        recipient_name: r.recipient_name,
        recipient_phone: r.recipient_phone,
        recipient_address: r.recipient_address,
        delivery_notes: r.delivery_notes,
        delivery_status: r.delivery_status,
        dispatched_at: r.dispatched_at,
        tracking_number: r.tracking_number,
        items: [],
      });
      map.get(key).items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  return (
    <div>
      <div className="card" style={{padding:'14px 18px', marginBottom:0}}>
        <div style={{fontSize:12, color:'var(--text2)', marginBottom:6, fontFamily:'var(--mono)'}}>
          📍 {profile.department} · {profile.branch}
        </div>
        <div style={{fontSize:11, color:'var(--text3)'}}>
          판매 입력 시 '본사 택배요청'을 선택한 건의 발송 현황입니다.
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==='pending'?'on':''}`} onClick={() => setTab('pending')}>
          📦 발송 대기
        </button>
        <button className={`tab ${tab==='dispatched'?'on':''}`} onClick={() => setTab('dispatched')}>
          ✅ 발송 완료
        </button>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        {tab === 'dispatched' && (
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap'}}>
            <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)}
              style={{height:32, padding:'0 8px', fontSize:12}}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)}
              style={{height:32, padding:'0 8px', fontSize:12}}/>
            <button className="btn btn-s" onClick={() => { setFFrom(minusDays(30)); setFTo(todayStr()); }}>최근 30일</button>
            <button className="btn btn-s" onClick={() => { setFFrom(minusDays(90)); setFTo(todayStr()); }}>최근 3개월</button>
          </div>
        )}

        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <span className="fresult">
            {tab === 'pending'
              ? <>발송 대기 — <b>{groups.length}</b>건 (라인 {rows.length}개)</>
              : <>발송 완료 — <b>{groups.length}</b>건 (라인 {rows.length}개) <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>{fFrom} ~ {fTo}</span></>}
          </span>
          <button className="btn btn-s" onClick={fetchData} disabled={loading}>
            {loading ? <span className="spinner"/> : '🔄 새로고침'}
          </button>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
        : rows.length === 0 ? <div className="empty">
            {tab === 'pending' ? '발송 대기 중인 본사 택배가 없습니다' : '해당 기간 발송 완료된 본사 택배가 없습니다'}
          </div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>판매일</th>
                  <th>수취인</th>
                  <th>주소</th>
                  <th>연락처</th>
                  <th>상품</th>
                  <th className="r" style={{width:60}}>수량</th>
                  {tab === 'dispatched' && (
                    <>
                      <th style={{whiteSpace:'nowrap'}}>발송일</th>
                      <th style={{textAlign:'center', minWidth:160}}>송장번호</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const totalQty = g.items.reduce((s, i) => s + (Number(i.quantity)||0), 0);
                  const productSummary = g.items.length === 1
                    ? (g.items[0].product?.name || '-')
                    : `${g.items[0].product?.name || '-'} 외 ${g.items.length - 1}개`;
                  return (
                  <tr key={g.key}>
                    <td className="mono" style={{fontSize:11, whiteSpace:'nowrap'}}>{g.sold_at}</td>
                    <td style={{fontSize:12, fontWeight:600}}>{g.recipient_name || '-'}</td>
                    <td style={{fontSize:11, color:'var(--text2)'}}>{g.recipient_address || '-'}</td>
                    <td className="mono" style={{fontSize:11, color:'var(--text2)'}}>{g.recipient_phone || '-'}</td>
                    <td style={{fontSize:12}}>{productSummary}</td>
                    <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{totalQty}</td>
                    {tab === 'dispatched' && (
                      <>
                        <td className="mono" style={{fontSize:11, whiteSpace:'nowrap'}}>
                          {g.dispatched_at ? new Date(g.dispatched_at).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td style={{textAlign:'center'}}>
                          {g.tracking_number ? (
                            <div style={{display:'flex', alignItems:'center', gap:6, justifyContent:'center', flexWrap:'wrap'}}>
                              <span className="mono" style={{fontSize:11, fontWeight:700}}>📦 {g.tracking_number}</span>
                              <button type="button"
                                onClick={() => window.open(`https://tracker.delivery/#/kr.cjlogistics/${g.tracking_number}`, '_blank', 'noopener,noreferrer')}
                                title="CJ대한통운 배송조회 (새 창)"
                                style={{height:24, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:4, background:'#fff3e0', color:'var(--accent)', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                                🔍 조회
                              </button>
                            </div>
                          ) : <span style={{fontSize:11, color:'var(--text3)'}}>송장 미등록</span>}
                        </td>
                      </>
                    )}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
