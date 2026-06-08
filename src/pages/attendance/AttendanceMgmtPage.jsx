import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob } from '../../lib/utils';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const firstOfMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
};
const DOW = ['일','월','화','수','목','금','토'];

export default function AttendanceMgmtPage() {
  const [tab,         setTab]         = useState('attendance');
  const [records,     setRecords]     = useState([]);
  const [storeMembers,setStoreMembers]= useState([]);
  const [plans,       setPlans]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fStore,      setFStore]      = useState('');
  const [fManager,    setFManager]    = useState('');
  const [fDate,       setFDate]       = useState(todayStr());

  // 근무자별 이력 탭 (history)
  const [hStore,      setHStore]      = useState('');
  const [hMemberKey,  setHMemberKey]  = useState(''); // store_members.id
  const [hFrom,       setHFrom]       = useState(firstOfMonthStr());
  const [hTo,         setHTo]         = useState(todayStr());
  const [hRecords,    setHRecords]    = useState([]);
  const [hLoading,    setHLoading]    = useState(false);

  const [closures, setClosures] = useState([]); // 휴점일 데이터

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: att }, { data: lp }, { data: sm }, { data: cl }] = await Promise.all([
      supabase.from('attendance').select('*')
        .gte('work_date', fDate).lte('work_date', fDate)
        .order('store_name', { ascending: true }),
      supabase.from('leave_plans').select('*')
        .order('created_at', { ascending: false }),
      supabase.from('store_members')
        .select('id, name, display_name, job_title, store_account_id, store:profiles!store_account_id(department, branch)')
        .order('id', { ascending: true }),
      supabase.from('store_closures').select('store_name, branch_name, dates'),
    ]);
    setClosures(cl || []);
    setRecords(att || []);
    setPlans(lp || []);
    setStoreMembers((sm || []).map(m => ({
      sm_id: m.id,
      name: m.name,
      display_name: m.display_name || m.name,
      job_title: m.job_title,
      store_account_id: m.store_account_id,
      store_name: m.store?.department || '',
      branch_name: m.store?.branch || '',
    })));
    setLoading(false);
  }, [fDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  const duration = (ci, co) => {
    if (!ci || !co) return '-';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}h ${m%60}m`;
  };

  // 매장 = 등록된 모든 매장 (출퇴근 기록 없어도 표시)
  const stores = useMemo(() =>
    [...new Set(storeMembers.map(m => m.store_name).filter(Boolean))].sort(),
    [storeMembers]
  );
  const managers = useMemo(() => {
    const ms = storeMembers
      .filter(m => !fStore || m.store_name === fStore)
      .map(m => m.display_name)
      .filter(Boolean);
    return [...new Set(ms)].sort();
  }, [storeMembers, fStore]);

  // 매장 매니저별 × 선택 날짜 → row 만들기.
  // attendance 기록과 매칭되면 시각 표시, 안 되면 [미체크].
  // store_members에 없는 attendance(기타근무자)는 별도 행으로 추가.
  const displayRows = useMemo(() => {
    const lookup = new Map();
    for (const r of records) {
      lookup.set(`${r.store_name}|${r.branch_name}|${r.manager_name}`, r);
    }
    // 매장별 휴점일 lookup: 'store|branch' → Set<date>
    const closureMap = new Map();
    for (const c of closures) {
      const key = `${c.store_name}|${c.branch_name}`;
      if (!closureMap.has(key)) closureMap.set(key, new Set());
      for (const d of (c.dates || [])) closureMap.get(key).add(d);
    }
    const isClosed = (store, branch, date) =>
      closureMap.get(`${store}|${branch}`)?.has(date) || false;

    const usedRecordIds = new Set();
    const rows = storeMembers
      .filter(m => m.store_name && m.branch_name)
      .map(m => {
        const rec = lookup.get(`${m.store_name}|${m.branch_name}|${m.name}`);
        if (rec) usedRecordIds.add(rec.id);
        return {
          key: `sm-${m.sm_id}`,
          name: m.name,
          display_name: m.display_name,
          job_title: m.job_title,
          store_name: m.store_name,
          branch_name: m.branch_name,
          work_date: fDate,
          clock_in: rec?.clock_in || null,
          clock_out: rec?.clock_out || null,
          isClosed: isClosed(m.store_name, m.branch_name, fDate),
          isExtra: false,
        };
      });
    const extras = records
      .filter(r => !usedRecordIds.has(r.id))
      .map(r => ({
        key: `extra-${r.id}`,
        name: r.manager_name,
        display_name: r.manager_name,
        job_title: '기타근무자',
        store_name: r.store_name || '',
        branch_name: r.branch_name || '',
        work_date: r.work_date,
        clock_in: r.clock_in,
        clock_out: r.clock_out,
        isClosed: isClosed(r.store_name, r.branch_name, r.work_date),
        isExtra: true,
      }));
    return [...rows, ...extras];
  }, [records, storeMembers, closures, fDate]);

  const filteredAtt = useMemo(() => {
    let r = displayRows;
    if (fStore)   r = r.filter(x => x.store_name === fStore);
    if (fManager) r = r.filter(x => x.display_name === fManager);
    return r;
  }, [displayRows, fStore, fManager]);

  const stat = useMemo(() => {
    const total = filteredAtt.length;
    const checkedIn = filteredAtt.filter(r => !!r.clock_in).length;
    const closed = filteredAtt.filter(r => r.isClosed && !r.clock_in).length;
    const missing = total - checkedIn - closed;
    return { total, checkedIn, closed, missing };
  }, [filteredAtt]);

  const newPlanCount = plans.filter(p => p.status === 'pending').length;

  // 근무자별 이력 — 점포·근무자·기간 변경 시 자동 조회
  const hMember = useMemo(
    () => storeMembers.find(m => String(m.sm_id) === String(hMemberKey)),
    [storeMembers, hMemberKey]
  );
  const fetchHistory = useCallback(async () => {
    if (!hMember || !hFrom || !hTo) { setHRecords([]); return; }
    setHLoading(true);
    const { data } = await supabase.from('attendance').select('*')
      .eq('manager_id', hMember.store_account_id)
      .eq('manager_name', hMember.name)
      .gte('work_date', hFrom).lte('work_date', hTo)
      .order('work_date', { ascending: false });
    setHRecords(data || []);
    setHLoading(false);
  }, [hMember, hFrom, hTo]);
  useEffect(() => {
    if (tab !== 'history') return;
    fetchHistory();
  }, [tab, fetchHistory]);

  // 기간 내 모든 날짜 × attendance 매핑 (미체크 표시 포함)
  const hDisplayRows = useMemo(() => {
    if (!hMember || !hFrom || !hTo) return [];
    const lookup = new Map();
    for (const r of hRecords) lookup.set(r.work_date, r);
    // 해당 매장 휴점일 set
    const closureSet = new Set();
    for (const c of closures) {
      if (c.store_name === hMember.store_name && c.branch_name === hMember.branch_name) {
        (c.dates || []).forEach(d => closureSet.add(d));
      }
    }
    const rows = [];
    const start = new Date(hFrom);
    const end   = new Date(hTo);
    if (isNaN(start) || isNaN(end) || start > end) return [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const rec = lookup.get(ds);
      rows.push({
        date: ds, dow: DOW[d.getDay()],
        clock_in: rec?.clock_in || null,
        clock_out: rec?.clock_out || null,
        isClosed: closureSet.has(ds),
      });
    }
    return rows.reverse(); // 최신 날짜가 위로
  }, [hMember, hFrom, hTo, hRecords, closures]);

  const hStat = useMemo(() => {
    const total    = hDisplayRows.length;
    const worked   = hDisplayRows.filter(r => r.clock_in).length;
    const closedDays = hDisplayRows.filter(r => r.isClosed && !r.clock_in).length;
    const missing  = total - worked - closedDays;
    const totalMin = hDisplayRows.reduce((s,r) => {
      if (!r.clock_in || !r.clock_out) return s;
      return s + Math.round((new Date(r.clock_out) - new Date(r.clock_in)) / 60000);
    }, 0);
    const hours = `${Math.floor(totalMin/60)}h ${totalMin%60}m`;
    return { total, worked, missing, closedDays, hours };
  }, [hDisplayRows]);

  const handleDownloadAttendance = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('출퇴근현황');
      const header = ['날짜', '점포명', '지점', '직책', '이름(근무자)', '출근시간', '퇴근시간'];
      const hr = ws.addRow(header);
      hr.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFEEEEEE'} };
        cell.alignment = { horizontal:'center', vertical:'middle' };
      });
      for (const r of filteredAtt) {
        ws.addRow([
          r.work_date,
          r.store_name || '-',
          r.branch_name || '-',
          r.job_title || (r.isExtra ? '기타근무자' : '-'),
          r.display_name || r.name || '-',
          r.clock_in ? fmt(r.clock_in) : (r.isClosed ? '휴점' : '미체크'),
          r.clock_out ? fmt(r.clock_out) : (r.isClosed ? '휴점' : '미체크'),
        ]);
      }
      ws.columns.forEach(col => {
        let max = 10;
        col.eachCell({ includeEmpty:false }, cell => {
          const v = cell.value == null ? '' : String(cell.value);
          if (v.length > max) max = Math.min(40, v.length + 2);
        });
        col.width = max;
      });
      const buf = await wb.xlsx.writeBuffer();
      dlBlob(buf, `출퇴근현황_${fDate}.xlsx`);
      toast(`엑셀 다운로드 완료 (${filteredAtt.length}명)`, 'ok');
    } catch (err) {
      toast('다운로드 실패: ' + (err.message || err), 'err');
    }
  };

  const updatePlanStatus = async (id, status) => {
    const { error } = await supabase.from('leave_plans').update({ status }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast(status === 'approved' ? '확인 완료' : '반려 처리', 'ok'); fetchAll(); }
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='attendance'?'on':''}`} onClick={() => setTab('attendance')}>출퇴근 현황</button>
        <button className={`tab ${tab==='history'?'on':''}`} onClick={() => setTab('history')}>근무자별 이력</button>
        <button className={`tab ${tab==='leave'?'on':''}`} onClick={() => setTab('leave')}>
          연차계획
          {newPlanCount > 0 && (
            <span style={{marginLeft:6, background:'var(--danger)', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700}}>
              NEW {newPlanCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'attendance' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar" style={{flexWrap:'wrap'}}>
            <input type="date" className="fsel" value={fDate}
              onChange={e => setFDate(e.target.value || todayStr())}/>
            <button className="btn btn-s" onClick={() => setFDate(todayStr())}>오늘</button>
            <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFManager(''); }}>
              <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={fManager} onChange={e => setFManager(e.target.value)}>
              <option value="">전체 근무자</option>{managers.map(m => <option key={m}>{m}</option>)}
            </select>
            <button type="button" onClick={handleDownloadAttendance}
              title={`${fDate} 출퇴근현황을 엑셀로 다운로드`}
              style={{height:30, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background:'#fff3e0', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
              📥 엑셀
            </button>
            {(fStore||fManager) && (
              <button className="btn-ghost" onClick={() => { setFStore(''); setFManager(''); }}>✕ 초기화</button>
            )}
            <div className="fbar-right" style={{display:'flex', alignItems:'center', gap:14}}>
              <span className="fresult">근무자 <b>{stat.total}</b>명</span>
              <span style={{fontSize:12, color:'var(--success)', fontWeight:700}}>출근 {stat.checkedIn}</span>
              {stat.closed > 0 && <span style={{fontSize:12, color:'#6a1b9a', fontWeight:700}}>휴점 {stat.closed}</span>}
              <span style={{fontSize:12, color:'var(--danger)', fontWeight:700}}>미체크 {stat.missing}</span>
            </div>
          </div>

          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>날짜</th><th>근무자</th><th>점포</th><th>지점</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr></thead>
                <tbody>
                  {filteredAtt.length === 0
                    ? <tr><td colSpan={7} className="empty">등록된 근무자가 없습니다</td></tr>
                    : filteredAtt.map(r => (
                      <tr key={r.key} style={r.isClosed ? {background:'#f3e5f5'} : (!r.clock_in && !r.isExtra ? {background:'#fafafa'} : {})}>
                        <td className="mono">{r.work_date}</td>
                        <td>
                          <strong>{r.display_name}</strong>
                          {r.job_title && r.job_title !== '매니저' && (
                            <span style={{fontSize:10, color:'var(--text3)', marginLeft:6}}>{r.job_title}</span>
                          )}
                        </td>
                        <td><span className="badge badge-dept">{r.store_name || '-'}</span></td>
                        <td><span className="badge badge-store">{r.branch_name || '-'}</span></td>
                        <td>
                          {r.clock_in
                            ? <span style={{fontFamily:'var(--mono)', color:'var(--success)', fontWeight:600}}>{fmt(r.clock_in)}</span>
                            : r.isClosed
                              ? <span style={{padding:'2px 8px', background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', borderRadius:3, fontSize:11, fontWeight:700}}>🏪 휴점</span>
                              : <span style={{padding:'2px 8px', background:'#ffebee', color:'var(--danger)', border:'1px solid #f48fb1', borderRadius:3, fontSize:11, fontWeight:700}}>미체크</span>
                          }
                        </td>
                        <td style={{fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:600}}>{fmt(r.clock_out)}</td>
                        <td className="mono" style={{color:'var(--text2)'}}>{duration(r.clock_in, r.clock_out)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card" style={{padding:'16px 20px'}}>
          <div className="fbar" style={{flexWrap:'wrap'}}>
            <select className="fsel" value={hStore}
              onChange={e => { setHStore(e.target.value); setHMemberKey(''); }}>
              <option value="">점포 선택</option>
              {stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={hMemberKey}
              onChange={e => setHMemberKey(e.target.value)} disabled={!hStore}
              style={{background:!hStore?'#f0f0f0':'#fff'}}>
              <option value="">근무자 선택</option>
              {storeMembers
                .filter(m => m.store_name === hStore)
                .map(m => (
                  <option key={m.sm_id} value={m.sm_id}>
                    {m.branch_name ? `[${m.branch_name}] ` : ''}{m.display_name}{m.job_title === '부매니저' ? ' (부)' : ''}
                  </option>
                ))
              }
            </select>
            <input type="date" className="fsel" value={hFrom} onChange={e => setHFrom(e.target.value)}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={hTo} onChange={e => setHTo(e.target.value)}/>
            <button className="btn btn-s" onClick={() => { setHFrom(firstOfMonthStr()); setHTo(todayStr()); }}>이번달</button>
            <div className="fbar-right" style={{display:'flex', alignItems:'center', gap:14}}>
              {hMember && (
                <>
                  <span className="fresult">대상기간 <b>{hStat.total}</b>일</span>
                  <span style={{fontSize:12, color:'var(--success)', fontWeight:700}}>근무 {hStat.worked}</span>
                  {hStat.closedDays > 0 && <span style={{fontSize:12, color:'#6a1b9a', fontWeight:700}}>휴점 {hStat.closedDays}</span>}
                  <span style={{fontSize:12, color:'var(--danger)', fontWeight:700}}>미체크 {hStat.missing}</span>
                  <span style={{fontSize:12, color:'var(--text2)', fontFamily:'var(--mono)', fontWeight:700}}>총 {hStat.hours}</span>
                </>
              )}
            </div>
          </div>

          {!hMember
            ? <div className="empty" style={{padding:'40px 0', color:'var(--text3)'}}>점포와 근무자를 선택하면 이력이 표시됩니다</div>
            : hLoading
              ? <div className="empty"><span className="spinner"/></div>
              : (
                <div className="twrap">
                  <table>
                    <thead><tr><th>날짜</th><th>요일</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr></thead>
                    <tbody>
                      {hDisplayRows.length === 0
                        ? <tr><td colSpan={5} className="empty">기간을 선택해주세요</td></tr>
                        : hDisplayRows.map(r => (
                          <tr key={r.date} style={r.isClosed ? {background:'#f3e5f5'} : (!r.clock_in ? {background:'#fafafa'} : {})}>
                            <td className="mono">{r.date}</td>
                            <td style={{
                              fontSize:12, fontWeight:600,
                              color: r.dow === '일' ? 'var(--danger)' : r.dow === '토' ? 'var(--accent2)' : 'var(--text2)',
                            }}>{r.dow}</td>
                            <td>
                              {r.clock_in
                                ? <span style={{fontFamily:'var(--mono)', color:'var(--success)', fontWeight:600}}>{fmt(r.clock_in)}</span>
                                : r.isClosed
                                  ? <span style={{padding:'2px 8px', background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', borderRadius:3, fontSize:11, fontWeight:700}}>🏪 휴점</span>
                                  : <span style={{padding:'2px 8px', background:'#ffebee', color:'var(--danger)', border:'1px solid #f48fb1', borderRadius:3, fontSize:11, fontWeight:700}}>미체크</span>
                              }
                            </td>
                            <td style={{fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:600}}>{fmt(r.clock_out)}</td>
                            <td className="mono" style={{color:'var(--text2)'}}>{duration(r.clock_in, r.clock_out)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>
      )}

      {tab === 'leave' && (
        <div className="card" style={{padding:'16px 20px'}}>
          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead>
                  <tr><th>신청월</th><th>매니저</th><th>점포</th><th>지점</th><th>선택날짜</th><th>일수</th><th>메모</th><th>제출일</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {plans.length === 0
                    ? <tr><td colSpan={9} className="empty">연차계획 신청 내역이 없습니다</td></tr>
                    : plans.map(p => (
                      <tr key={p.id}>
                        <td className="mono" style={{fontWeight:700}}>{p.target_month}</td>
                        <td><strong>{p.manager_name}</strong></td>
                        <td><span className="badge badge-dept">{p.store_name}</span></td>
                        <td><span className="badge badge-store">{p.branch_name}</span></td>
                        <td style={{fontSize:11, color:'var(--text2)', maxWidth:200}}><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{(p.dates||[]).map(d=><span key={d} style={{background:'#fff3e0',color:'var(--accent)',border:'1px solid #ffcc80',borderRadius:3,padding:'1px 6px',fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{d}</span>)}</div></td>
                        <td style={{textAlign:'center', fontWeight:700, color:'var(--accent)'}}>{(p.dates||[]).length}일</td>
                        <td style={{fontSize:11, color:'var(--text3)'}}>{p.memo||'-'}</td>
                        <td className="mono" style={{fontSize:11}}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                        <td>
                          {p.status === 'pending' ? (
                            <div style={{display:'flex', gap:4}}>
                              <button className="btn btn-p" style={{padding:'3px 8px', fontSize:11}}
                                onClick={() => updatePlanStatus(p.id, 'approved')}>확인</button>
                              <button className="btn-danger" style={{padding:'3px 8px', fontSize:11}}
                                onClick={() => updatePlanStatus(p.id, 'rejected')}>반려</button>
                            </div>
                          ) : (
                            <span style={{
                              padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                              background: p.status==='approved'?'#e8f5e9':'#ffebee',
                              color: p.status==='approved'?'var(--success)':'var(--danger)',
                            }}>
                              {p.status==='approved'?'✅ 확인':'❌ 반려'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
