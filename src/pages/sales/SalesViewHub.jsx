import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { SPECIAL_SALES_STORES } from '../../lib/constants';

export default function SalesViewHub({ setPage }) {
  const items = [
    { key:'sales_list',         icon:'🏬', label:'매장 매출',  desc:'매장별 판매 내역 조회' },
    { key:'biz_sales_view',     icon:'🤝', label:'특판 매출',  desc:'B2B 특판 업체 매출 조회' },
    { key:'lecture_sales_view', icon:'🎓', label:'강좌 매출',  desc:'강좌 진행 매출 조회' },
  ];

  // 기간 선택
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const todayStr   = fmt(today);
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo,   setFTo]   = useState(todayStr);
  const [appliedFrom, setAppliedFrom] = useState(monthStart);
  const [appliedTo,   setAppliedTo]   = useState(todayStr);
  const [storeRows,   setStoreRows]   = useState([]);
  const [bizRows,     setBizRows]     = useState([]);
  const [lectureRows, setLectureRows] = useState([]);
  const [loading,     setLoading]     = useState(false);

  // 상세보기 모달
  const [drill, setDrill] = useState(null); // { kind:'store'|'biz'|'lecture', title:string, daily:[{date, count, amt}] }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 매장매출 — sales (페이징)
      const PAGE = 1000;
      let allSales = [];
      let start = 0;
      while (true) {
        const { data, error } = await supabase.from('sales')
          .select('sold_at, store_name, branch_name, price, quantity, payment')
          .gte('sold_at', appliedFrom).lte('sold_at', appliedTo)
          .range(start, start + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allSales.push(...data);
        if (data.length < PAGE) break;
        start += PAGE;
      }
      setStoreRows(allSales);

      // 특판매출
      const { data: bizData, error: bizErr } = await supabase.from('biz_sales')
        .select('sold_at, company_name, supply_price, quantity')
        .gte('sold_at', appliedFrom).lte('sold_at', appliedTo);
      if (bizErr) throw bizErr;
      setBizRows(bizData || []);

      // 강좌매출
      const { data: lecData, error: lecErr } = await supabase.from('lecture_sales')
        .select('sold_at, store_name, branch_name, price')
        .gte('sold_at', appliedFrom).lte('sold_at', appliedTo);
      if (lecErr) throw lecErr;
      setLectureRows(lecData || []);
    } catch (err) {
      toast('조회 실패: ' + (err.message || err), 'err');
    }
    setLoading(false);
  }, [appliedFrom, appliedTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 그룹화 helper — keyFn, labelFn으로 주체별 묶고, 각 그룹마다 일자별 분포까지 같이 계산
  const groupBy = (rows, keyFn, labelFn, amountFn) => {
    const map = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!k) continue;
      const amt = Math.round(amountFn(r)); // 특판 supply_price 소수점 → 원단위 정수화
      let g = map.get(k);
      if (!g) {
        g = { key: k, label: labelFn(r), count: 0, total: 0, daily: new Map() };
        map.set(k, g);
      }
      g.count += 1;
      g.total += amt;
      const d = r.sold_at;
      if (d) {
        const dEntry = g.daily.get(d) || { date: d, count: 0, amt: 0 };
        dEntry.count += 1;
        dEntry.amt   += amt;
        g.daily.set(d, dEntry);
      }
    }
    const list = Array.from(map.values()).map(g => ({
      ...g,
      daily: Array.from(g.daily.values()).sort((a,b) => a.date.localeCompare(b.date)),
    }));
    list.sort((a,b) => b.total - a.total); // 매출액 큰 순
    return list;
  };

  // 매장매출 = 강좌매출(결제='강좌매출') 제외
  const storeRegularRows = useMemo(() => storeRows.filter(r => r.payment !== '강좌매출'), [storeRows]);
  // 특판매출로 잡을 sales (store_name='특판' 또는 과거 통합 점포명) / 그 외는 일반 매장
  const isSpecialStore = (r) => SPECIAL_SALES_STORES.includes(r.store_name);
  const specialSalesRows = useMemo(() => storeRegularRows.filter(isSpecialStore), [storeRegularRows]);
  const realStoreRows    = useMemo(() => storeRegularRows.filter(r => !isSpecialStore(r)), [storeRegularRows]);
  // 강좌매출(신규) = 판매입력에서 결제 '강좌매출'로 잡힌 sales
  const lectureSalesTotal = useMemo(() => storeRows
    .filter(r => r.payment === '강좌매출')
    .reduce((s, r) => s + Math.round((Number(r.price)||0) * (Number(r.quantity)||0)), 0), [storeRows]);

  const storeGroups   = useMemo(() => groupBy(
    realStoreRows,
    r => `${r.store_name||''}|${r.branch_name||''}`,
    r => `${r.store_name||''} ${r.branch_name||''}`.trim(),
    r => (Number(r.price)||0) * (Number(r.quantity)||0)
  ), [realStoreRows]);

  // 특판매출 = biz_sales(B2B 거래처) + 특판 sales(지점별)
  const bizSalesGroups = useMemo(() => groupBy(
    bizRows,
    r => `biz|${r.company_name || '(미지정)'}`,
    r => r.company_name || '(미지정)',
    r => (Number(r.supply_price)||0) * (Number(r.quantity)||0)
  ), [bizRows]);
  const specialSalesGroups = useMemo(() => groupBy(
    specialSalesRows,
    r => `특판|${r.branch_name || r.store_name || '미지정'}`,
    r => r.branch_name || r.store_name || '(미지정)',
    r => (Number(r.price)||0) * (Number(r.quantity)||0)
  ), [specialSalesRows]);
  const bizGroups = useMemo(
    () => [...bizSalesGroups, ...specialSalesGroups].sort((a,b) => b.total - a.total),
    [bizSalesGroups, specialSalesGroups]
  );

  const lectureGroups = useMemo(() => groupBy(
    lectureRows,
    r => `${r.store_name||''}|${r.branch_name||''}`,
    r => `${r.store_name||''} ${r.branch_name||''}`.trim() || '(미지정)',
    r => (Number(r.price)||0)
  ), [lectureRows]);

  const storeTotal   = useMemo(() => storeGroups.reduce((s,g) => s + g.total, 0), [storeGroups]);
  const bizTotal     = useMemo(() => bizGroups.reduce((s,g) => s + g.total, 0), [bizGroups]);
  const oldLectureTotal = useMemo(() => lectureGroups.reduce((s,g) => s + g.total, 0), [lectureGroups]);
  const lectureTotal = oldLectureTotal + lectureSalesTotal; // 과거 lecture_sales + 신규 판매입력 강좌
  const grandTotal   = storeTotal + bizTotal + lectureTotal;

  const filtersDirty = (fFrom !== appliedFrom) || (fTo !== appliedTo);
  const handleSearch = () => {
    if (!fFrom || !fTo) { toast('기간을 선택해주세요', 'err'); return; }
    if (fFrom > fTo)    { toast('시작일이 종료일보다 늦습니다', 'err'); return; }
    setAppliedFrom(fFrom); setAppliedTo(fTo);
  };

  // 빠른 기간 설정
  const setRange = (type) => {
    if (type === 'today') {
      setFFrom(todayStr); setFTo(todayStr);
    } else if (type === 'thismonth') {
      setFFrom(monthStart); setFTo(todayStr);
    } else if (type === 'lastmonth') {
      const first = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      setFFrom(fmt(first)); setFTo(fmt(last));
    } else if (type === 'last7') {
      const d = new Date(today); d.setDate(d.getDate()-6);
      setFFrom(fmt(d)); setFTo(todayStr);
    }
  };

  // 그룹 카드 (특판: 거래처 / 매장·강좌: 매장+지점)
  const SectionCard = ({ title, icon, groups, total, color, kind, headerOnClick, subjectLabel }) => (
    <div className="card" style={{padding:0, overflow:'hidden'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'#fafafa', cursor: headerOnClick ? 'pointer' : 'default'}} onClick={headerOnClick}>
        <span style={{fontSize:18}}>{icon}</span>
        <strong style={{fontSize:14}}>{title}</strong>
        <span style={{fontSize:11, color:'var(--text3)'}}>{groups.length}곳</span>
        <span style={{marginLeft:'auto', fontFamily:'var(--mono)', fontWeight:700, color, fontSize:16}}>
          {total.toLocaleString()}원
        </span>
      </div>
      {groups.length === 0 ? (
        <div className="empty" style={{padding:'18px 0', fontSize:12}}>해당 기간 매출 없음</div>
      ) : (
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th>{subjectLabel}</th>
                <th className="r">판매건수</th>
                <th className="r">매출액</th>
                <th style={{width:100, textAlign:'center'}}>상세</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.key}>
                  <td style={{fontWeight:600}}>{g.label}</td>
                  <td className="r" style={{fontFamily:'var(--mono)'}}>{g.count.toLocaleString()}건</td>
                  <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, color}}>{g.total.toLocaleString()}원</td>
                  <td style={{textAlign:'center'}}>
                    <button className="btn btn-s" style={{padding:'2px 10px', fontSize:11}}
                      onClick={() => setDrill({ kind, title: `${icon} ${g.label}`, daily: g.daily, total: g.total, count: g.count, color })}>
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
              <tr style={{background:'#fafafa', fontWeight:700}}>
                <td style={{textAlign:'right'}}>합계</td>
                <td className="r" style={{fontFamily:'var(--mono)'}}>{groups.reduce((s,g)=>s+g.count,0).toLocaleString()}건</td>
                <td className="r" style={{fontFamily:'var(--mono)', color}}>{total.toLocaleString()}원</td>
                <td/>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const quickBtn = (active) => ({
    height:32, padding:'0 10px', border:'2px solid', borderRadius:'var(--radius)',
    fontSize:11, fontWeight:700, cursor:'pointer',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    background:  active ? '#fff3e0' : '#fff',
    color:       active ? 'var(--accent)' : 'var(--text2)',
  });

  return (
    <div>
      {/* 카드 3개 — 기존 */}
      <div style={{display:'flex', gap:16, flexWrap:'wrap', marginTop:8, marginBottom:18}}>
        {items.map(item => (
          <button key={item.key} onClick={() => setPage(item.key)}
            style={{flex:'1 1 200px', minWidth:200, background:'#fff', border:'2px solid var(--border)',
              borderRadius:16, padding:'22px 20px', cursor:'pointer', textAlign:'left',
              transition:'all 150ms', outline:'none', fontFamily:'var(--sans)' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.boxShadow='0 4px 20px rgba(255,143,0,0.15)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';}}>
            <div style={{fontSize:28, marginBottom:8}}>{item.icon}</div>
            <div style={{fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:4}}>{item.label}</div>
            <div style={{fontSize:11, color:'var(--text3)'}}>{item.desc}</div>
          </button>
        ))}
      </div>

      {/* 기간 선택 + 조회 */}
      <div className="card">
        <div className="card-label">📅 기간별 매출 조회</div>
        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} title="시작일"/>
          <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} title="종료일"/>
          <button style={quickBtn(fFrom===todayStr && fTo===todayStr)} onClick={() => setRange('today')}>오늘</button>
          <button style={quickBtn(false)} onClick={() => setRange('last7')}>최근 7일</button>
          <button style={quickBtn(fFrom===monthStart && fTo===todayStr)} onClick={() => setRange('thismonth')}>당월</button>
          <button style={quickBtn(false)} onClick={() => setRange('lastmonth')}>전월</button>
          <button type="button" onClick={handleSearch} disabled={loading}
            style={{
              height:34, padding:'0 16px', border:'1px solid var(--accent)', borderRadius:'var(--radius)',
              background: filtersDirty ? 'var(--accent)' : '#fff3e0',
              color:      filtersDirty ? '#fff' : 'var(--accent)',
              fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            }}>
            {loading ? <span className="spinner"/> : '🔍 조회'}
          </button>
        </div>
      </div>

      {/* 총 매출액 카드 */}
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:14}}>
        <div style={{background:'#fff', border:'2px solid var(--sidebar)', borderRadius:'var(--radius)', padding:'16px 20px'}}>
          <div style={{fontSize:11, fontWeight:700, color:'var(--text3)', marginBottom:6}}>총 매출액</div>
          <div style={{fontSize:24, fontWeight:700, color:'var(--text)', fontFamily:'var(--mono)'}}>
            {grandTotal.toLocaleString()}원
          </div>
          <div style={{fontSize:11, color:'var(--text3)', marginTop:4, fontFamily:'var(--mono)'}}>
            {appliedFrom} ~ {appliedTo}
          </div>
        </div>
        <div style={{background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px'}}>
          <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6}}>🏬 매장매출</div>
          <div style={{fontSize:16, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>
            {storeTotal.toLocaleString()}원
          </div>
          <div style={{fontSize:11, color:'#6a1b9a', marginTop:6, fontWeight:600}}>
            🎓 그 중 강좌매출 <b style={{fontFamily:'var(--mono)'}}>{lectureTotal.toLocaleString()}</b>원
          </div>
        </div>
        <div style={{background:'#fff', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px'}}>
          <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6}}>🤝 특판매출</div>
          <div style={{fontSize:16, fontWeight:700, color:'#1565C0', fontFamily:'var(--mono)'}}>
            {bizTotal.toLocaleString()}원
          </div>
        </div>
      </div>

      {/* 매출 내역 3개 섹션 — 주체별 그룹 */}
      <div style={{display:'grid', gap:14}}>
        <SectionCard title="매장 매출 내역 (강좌매출 포함)" icon="🏬" groups={storeGroups}   total={storeTotal}   color="var(--accent)" kind="store"   subjectLabel="매장 / 지점" headerOnClick={() => setPage('sales_list')}/>
        <SectionCard title="특판 매출 내역" icon="🤝" groups={bizGroups}     total={bizTotal}     color="#1565C0"       kind="biz"     subjectLabel="거래처"     headerOnClick={() => setPage('biz_sales_view')}/>
      </div>

      {/* 상세보기 모달 — 그룹의 일자별 분포 */}
      {drill && (
        <div style={{position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.5)'}} onClick={() => setDrill(null)}/>
          <div style={{position:'relative', background:'#fff', borderRadius:12, padding:'20px 24px', width:'90vw', maxWidth:720, maxHeight:'85vh', overflow:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap'}}>
              <strong style={{fontSize:15}}>{drill.title}</strong>
              <span style={{fontSize:12, color:'var(--text3)'}}>{drill.daily.length}일</span>
              <span style={{fontSize:12, color:'var(--text3)'}}>· 판매 {drill.count}건</span>
              <span style={{marginLeft:'auto', fontSize:18, fontWeight:700, color:drill.color, fontFamily:'var(--mono)'}}>
                {drill.total.toLocaleString()}원
              </span>
              <button type="button" onClick={() => setDrill(null)}
                style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999'}}>✕</button>
            </div>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>요일</th>
                    <th className="r">판매건수</th>
                    <th className="r">매출액</th>
                  </tr>
                </thead>
                <tbody>
                  {drill.daily.map(r => {
                    const dow = ['일','월','화','수','목','금','토'][new Date(r.date).getDay()];
                    const isSun = dow === '일'; const isSat = dow === '토';
                    return (
                      <tr key={r.date}>
                        <td className="mono">{r.date}</td>
                        <td style={{fontWeight:700, color: isSun?'var(--danger)':isSat?'var(--accent2)':'var(--text)'}}>{dow}</td>
                        <td className="r" style={{fontFamily:'var(--mono)'}}>{r.count.toLocaleString()}건</td>
                        <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700}}>{r.amt.toLocaleString()}원</td>
                      </tr>
                    );
                  })}
                  <tr style={{background:'#fafafa', fontWeight:700}}>
                    <td colSpan={2} style={{textAlign:'right'}}>합계</td>
                    <td className="r" style={{fontFamily:'var(--mono)'}}>{drill.count.toLocaleString()}건</td>
                    <td className="r" style={{fontFamily:'var(--mono)', color:drill.color}}>{drill.total.toLocaleString()}원</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
