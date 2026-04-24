import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function HomePage({ profile, setPage }) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const toLocalDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = toLocalDate(yesterday);
  const monthLabel = `${year}년 ${month}월`;

  const [storeSummary,   setStoreSummary]   = useState({amt:0,count:0,qty:0});
  const [storeRows,      setStoreRows]      = useState([]);
  const [lectureSummary, setLectureSummary] = useState({amt:0,count:0,qty:0});
  const [lectureRows,    setLectureRows]    = useState([]);
  const [bizSummary,     setBizSummary]     = useState({amt:0,count:0,qty:0});
  const [bizRows,        setBizRows]        = useState([]);
  const [prevTotalAmt,   setPrevTotalAmt]   = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [showBanner,     setShowBanner]     = useState(false);

  // 전월 동일기간 날짜 계산
  const prevMonthDate = new Date(year, now.getMonth() - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMon  = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const prevMonthStart = `${prevYear}-${prevMon}-01`;
  const prevMonthLastDay = new Date(prevYear, prevMonthDate.getMonth() + 1, 0).getDate();
  const prevMonthEndDay  = Math.min(yesterday.getDate(), prevMonthLastDay);
  const prevMonthEnd = `${prevYear}-${prevMon}-${String(prevMonthEndDay).padStart(2, '0')}`;

  const isManager = profile?.job_title === '매니저';
  const isHQ      = profile?.job_title === '담당자';
  const isAdmin   = profile?.role === 'admin';
  const canSeeAll = isAdmin || isHQ;
  const today = now.getDate();
  const isReminderPeriod = today >= 20 && today <= 25;
  const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonStr = `${nextM.getFullYear()}-${String(nextM.getMonth()+1).padStart(2,'0')}`;
  const daysLeft = 25 - today;

  useEffect(() => {
    if (!isManager || !isReminderPeriod) return;
    supabase.from('leave_plans')
      .select('id').eq('manager_id', profile.id).eq('target_month', nextMonStr)
      .maybeSingle()
      .then(({ data }) => { if (!data) setShowBanner(true); });
  }, [isManager, isReminderPeriod, profile?.id, nextMonStr]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // 1. 매장 매출
      let storeQ = supabase.from('sales')
        .select('store_name, branch_name, quantity, price, returned_qty')
        .gte('sold_at', monthStart).lte('sold_at', yesterdayStr);
      if (isManager && profile?.department)
        storeQ = storeQ.eq('store_name', profile.department).eq('branch_name', profile.branch);
      const { data: storeData } = await storeQ;
      const sRows = (storeData || []).map(r => ({...r, _eff: Math.max(0,(r.quantity||0)-(r.returned_qty||0))}));
      const sMap = new Map();
      for (const r of sRows) {
        if (r._eff <= 0) continue; // 완전반품 제외
        const key = `${r.store_name}|||${r.branch_name}`;
        if (!sMap.has(key)) sMap.set(key, {store:r.store_name, branch:r.branch_name, count:0, qty:0, amt:0});
        const e = sMap.get(key);
        e.count++; e.qty += r._eff; e.amt += r.price * r._eff;
      }
      setStoreSummary({
        amt:   sRows.reduce((s,r)=>s+r.price*r._eff, 0),
        count: sRows.filter(r => r._eff > 0).length,
        qty:   sRows.reduce((s,r)=>s+r._eff, 0),
      });
      setStoreRows([...sMap.values()].sort((a,b)=>b.amt-a.amt));

      if (canSeeAll) {
        // 2. 강좌 매출
        const { data: lectureData } = await supabase.from('lecture_sales')
          .select('store_name, branch_name, quantity, price')
          .gte('sold_at', monthStart).lte('sold_at', yesterdayStr);
        const lRows = lectureData || [];
        const lMap = new Map();
        for (const r of lRows) {
          const key = `${r.store_name}|||${r.branch_name}`;
          if (!lMap.has(key)) lMap.set(key, {store:r.store_name, branch:r.branch_name, count:0, qty:0, amt:0});
          const e = lMap.get(key); e.count++; e.qty += r.quantity; e.amt += r.price * r.quantity;
        }
        setLectureSummary({
          amt:   lRows.reduce((s,r)=>s+r.price*r.quantity, 0),
          count: lRows.length,
          qty:   lRows.reduce((s,r)=>s+r.quantity, 0),
        });
        setLectureRows([...lMap.values()].sort((a,b)=>b.amt-a.amt));

        // 3. 특판 매출
        const { data: bizData } = await supabase.from('biz_sales')
          .select('company_name, quantity, supply_price')
          .gte('sold_at', monthStart).lte('sold_at', yesterdayStr);
        const bRows = bizData || [];
        const bMap = new Map();
        for (const r of bRows) {
          const key = r.company_name||'미지정';
          if (!bMap.has(key)) bMap.set(key, {company:key, count:0, qty:0, amt:0});
          const e = bMap.get(key); e.count++; e.qty += r.quantity; e.amt += r.supply_price * r.quantity;
        }
        setBizSummary({
          amt:   bRows.reduce((s,r)=>s+r.supply_price*r.quantity, 0),
          count: bRows.length,
          qty:   bRows.reduce((s,r)=>s+r.quantity, 0),
        });
        setBizRows([...bMap.values()].sort((a,b)=>b.amt-a.amt));

        // 4. 전월 동일기간 통합 매출
        const [{ data: prevSales }, { data: prevLecture }, { data: prevBiz }] = await Promise.all([
          supabase.from('sales').select('quantity, price, returned_qty')
            .gte('sold_at', prevMonthStart).lte('sold_at', prevMonthEnd),
          supabase.from('lecture_sales').select('quantity, price')
            .gte('sold_at', prevMonthStart).lte('sold_at', prevMonthEnd),
          supabase.from('biz_sales').select('quantity, supply_price')
            .gte('sold_at', prevMonthStart).lte('sold_at', prevMonthEnd),
        ]);
        const prevStore   = (prevSales   ||[]).reduce((s,r)=>s+r.price*Math.max(0,(r.quantity||0)-(r.returned_qty||0)), 0);
        const prevLect    = (prevLecture ||[]).reduce((s,r)=>s+r.price*r.quantity, 0);
        const prevBizAmt  = (prevBiz     ||[]).reduce((s,r)=>s+r.supply_price*r.quantity, 0);
        setPrevTotalAmt(prevStore + prevLect + prevBizAmt);
      }
      setLoading(false);
    };
    fetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAmt = storeSummary.amt + lectureSummary.amt + bizSummary.amt;

  if (loading) return <div className="empty"><span className="spinner"/></div>;

  const SummaryCard = ({title, icon, summary, color, extra}) => (
    <div style={{background:'#fff', border:`2px solid ${color}20`, borderRadius:12, padding:'16px 20px', flex:1}}>
      <div style={{fontSize:12, fontWeight:700, color, marginBottom:12, display:'flex', alignItems:'center', gap:6}}>
        <span>{icon}</span>{title}
      </div>
      <div style={{fontSize:24, fontWeight:700, color, fontFamily:'var(--mono)', marginBottom:8}}>
        {summary.amt.toLocaleString()}원
      </div>
      <div style={{display:'flex', gap:12, fontSize:12, color:'var(--text2)'}}>
        {extra || <>
          <span>주문 : <b>{summary.count}</b>건</span>
          <span>수량 : <b>{summary.qty}</b>개</span>
        </>}
      </div>
    </div>
  );

  return (
    <div>
      {/* 휴무계획 미제출 배너 */}
      {showBanner && (
        <div style={{ display:'flex', alignItems:'center', gap:12, background:'#ffebee', border:'1px solid #ef9a9a', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:16 }}>
          <span style={{ fontSize:18 }}>🔴</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#c62828', marginBottom:2 }}>
              {nextMonStr.replace('-','년 ').replace('-','월')} 휴무계획을 아직 제출하지 않았습니다
            </div>
            <div style={{ fontSize:12, color:'#b71c1c' }}>
              제출 마감일: {now.getMonth()+1}월 25일 · 오늘 포함 {daysLeft + 1}일 남았습니다
            </div>
          </div>
          <button onClick={() => { setShowBanner(false); setPage && setPage('leave_plan'); }}
            style={{ height:32, padding:'0 14px', background:'#c62828', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
            지금 제출
          </button>
          <button onClick={() => setShowBanner(false)}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#ef9a9a', lineHeight:1 }}>✕</button>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>
            {monthLabel} 누적 판매매출
            {isManager && <span style={{ fontSize:13, fontWeight:500, color:'var(--text3)', marginLeft:8 }}>({profile?.branch})</span>}
          </div>
          <div style={{ fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)' }}>
            {monthStart} ~ {yesterdayStr} (어제까지)
          </div>
        </div>
        {canSeeAll && (() => {
          const diff = totalAmt - prevTotalAmt;
          const diffPct = prevTotalAmt > 0 ? ((diff / prevTotalAmt) * 100).toFixed(1) : null;
          const isUp = diff >= 0;
          const diffColor = isUp ? '#1b5e20' : '#b71c1c';
          return (
            <div style={{ background:'#fff8f0', border:'2px solid #e65100', borderRadius:12, padding:'12px 20px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#bf360c', letterSpacing:1, textAlign:'center', marginBottom:10 }}>
                통합 총 매출
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:0 }}>
                {/* 당월 */}
                <div style={{ textAlign:'center', padding:'0 18px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#6d4c41', marginBottom:5 }}>{month}월 (당월)</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:800, color:'#bf360c', lineHeight:1 }}>
                    {totalAmt.toLocaleString()}<span style={{ fontSize:12, marginLeft:2, fontWeight:600 }}>원</span>
                  </div>
                </div>
                {/* 세로 구분선 */}
                <div style={{ width:1, background:'#ffcc80', alignSelf:'stretch', margin:'2px 0' }}/>
                {/* 전월 동기 */}
                <div style={{ textAlign:'center', padding:'0 18px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#6d4c41', marginBottom:5 }}>{prevMon}월 동기 (1~{String(prevMonthEndDay).padStart(2,'0')}일)</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:700, color:'#4e342e', lineHeight:1 }}>
                    {prevTotalAmt.toLocaleString()}<span style={{ fontSize:12, marginLeft:2, fontWeight:600 }}>원</span>
                  </div>
                </div>
                {/* 세로 구분선 */}
                <div style={{ width:1, background:'#ffcc80', alignSelf:'stretch', margin:'2px 0' }}/>
                {/* 증감 */}
                <div style={{ textAlign:'center', padding:'0 18px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#6d4c41', marginBottom:5 }}>증감</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:800, color:diffColor, lineHeight:1 }}>
                    {isUp ? '▲' : '▼'} {Math.abs(diff).toLocaleString()}<span style={{ fontSize:12, marginLeft:2, fontWeight:600 }}>원</span>
                  </div>
                  {diffPct !== null && (
                    <div style={{ fontSize:12, fontWeight:700, color:diffColor, marginTop:4 }}>
                      ({isUp ? '+' : ''}{diffPct}%)
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3개 매출 카드 (본사만) */}
      {canSeeAll && (
        <div style={{display:'flex', gap:12, marginBottom:20}}>
          <SummaryCard title="매장 매출" icon="🏬" summary={storeSummary} color="#E65100"/>
          <SummaryCard title="강좌 매출" icon="🎓" summary={lectureSummary} color="#1565C0"
              extra={<><span>강좌횟수 : <b>{lectureSummary.count}</b>회</span><span>인원 : <b>{lectureSummary.qty}</b>명</span></>}/>
          <SummaryCard title="특판 매출" icon="🤝" summary={bizSummary} color="#2E7D32"/>
        </div>
      )}

      {/* 매니저: 기존 4개 요약 카드 */}
      {isManager && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'총 매출금액', value: storeSummary.amt.toLocaleString()+'원', big:true },
            { label:'판매 건수',   value: storeSummary.count.toLocaleString()+'건' },
            { label:'판매 수량',   value: storeSummary.qty.toLocaleString()+'개' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', border: s.big?'2px solid var(--sidebar)':'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px 20px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8 }}>{s.label}</div>
              <div style={{ fontSize: s.big?26:22, fontWeight:700, color: s.big?'var(--accent)':'var(--text)', fontFamily:'var(--mono)', lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 매장 매출 현황 */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-label">🏬 매장별 당월 누적 판매매출</div>
        {storeRows.length === 0 ? <div className="empty">이번 달 판매 데이터가 없습니다</div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>순위</th><th>점포</th><th>지점</th><th className="r">판매건수</th><th className="r">판매수량</th><th className="r">매출금액</th><th style={{minWidth:100}}>비중</th></tr>
              </thead>
              <tbody>
                {storeRows.map((r,i) => {
                  const pct = storeSummary.amt>0 ? (r.amt/storeSummary.amt*100).toFixed(1) : 0;
                  return (
                    <tr key={i}>
                      <td className="mono" style={{color:'var(--text3)',width:40}}>{i+1}</td>
                      <td><span className="badge badge-dept">{r.store}</span></td>
                      <td><span className="badge badge-store">{r.branch}</span></td>
                      <td className="r">{r.count.toLocaleString()}건</td>
                      <td className="r">{r.qty.toLocaleString()}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)'}}>{r.amt.toLocaleString()}원</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,height:6,background:'#f0f0f0',borderRadius:3,overflow:'hidden'}}>
                            <div style={{width:`${pct}%`,height:'100%',background:'var(--sidebar)',borderRadius:3}}/>
                          </div>
                          <span style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)',minWidth:36}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{background:'var(--bg3)',borderTop:'2px solid var(--border2)'}}>
                  <td colSpan={3} style={{padding:'9px 11px',fontWeight:700}}>합계</td>
                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{storeSummary.count.toLocaleString()}건</td>
                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{storeSummary.qty.toLocaleString()}개</td>
                  <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--accent)',fontSize:14}}>{storeSummary.amt.toLocaleString()}원</td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 강좌 매출 현황 (본사만) */}
      {canSeeAll && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-label">🎓 강좌별 당월 누적 매출</div>
          {lectureRows.length===0 ? <div className="empty">이번 달 강좌 매출이 없습니다</div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>순위</th><th>점포</th><th>지점</th><th className="r">건수</th><th className="r">인원수</th><th className="r">매출금액</th></tr>
                </thead>
                <tbody>
                  {lectureRows.map((r,i)=>(
                    <tr key={i}>
                      <td className="mono" style={{color:'var(--text3)',width:40}}>{i+1}</td>
                      <td><span className="badge badge-dept">{r.store}</span></td>
                      <td><span className="badge badge-store">{r.branch}</span></td>
                      <td className="r">{r.count}건</td>
                      <td className="r">{r.qty}명</td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'#1565C0'}}>{r.amt.toLocaleString()}원</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)',borderTop:'2px solid var(--border2)'}}>
                    <td colSpan={3} style={{padding:'9px 11px',fontWeight:700}}>합계</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{lectureSummary.count}건</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{lectureSummary.qty}명</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'#1565C0',fontSize:14}}>{lectureSummary.amt.toLocaleString()}원</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 특판 매출 현황 (본사만) */}
      {canSeeAll && (
        <div className="card">
          <div className="card-label">🤝 특판 당월 누적 매출</div>
          {bizRows.length===0 ? <div className="empty">이번 달 특판 매출이 없습니다</div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>순위</th><th>업체</th><th className="r">건수</th><th className="r">수량</th><th className="r">매출금액</th></tr>
                </thead>
                <tbody>
                  {bizRows.map((r,i)=>(
                    <tr key={i}>
                      <td className="mono" style={{color:'var(--text3)',width:40}}>{i+1}</td>
                      <td style={{fontWeight:600}}>{r.company}</td>
                      <td className="r">{r.count}건</td>
                      <td className="r">{r.qty}개</td>
                      <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'#2E7D32'}}>{r.amt.toLocaleString()}원</td>
                    </tr>
                  ))}
                  <tr style={{background:'var(--bg3)',borderTop:'2px solid var(--border2)'}}>
                    <td colSpan={2} style={{padding:'9px 11px',fontWeight:700}}>합계</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{bizSummary.count}건</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700}}>{bizSummary.qty}개</td>
                    <td className="r" style={{fontFamily:'var(--mono)',fontWeight:700,color:'#2E7D32',fontSize:14}}>{bizSummary.amt.toLocaleString()}원</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
