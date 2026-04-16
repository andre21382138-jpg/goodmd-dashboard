import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function AttendanceMgmtPage() {
  const [tab,      setTab]      = useState('attendance');
  const [records,  setRecords]  = useState([]);
  const [plans,    setPlans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [fStore,   setFStore]   = useState('');
  const [fManager, setFManager] = useState('');
  const [fFrom,    setFFrom]    = useState('');
  const [fTo,      setFTo]      = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: att } = await supabase.from('attendance')
      .select('*').order('work_date', { ascending: false }).limit(200);
    const { data: lp } = await supabase.from('leave_plans')
      .select('*').order('created_at', { ascending: false });
    setRecords(att || []);
    setPlans(lp || []);
    setLoading(false);
  }, []);

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

  const stores = useMemo(() => [...new Set(records.map(r => r.store_name).filter(Boolean))].sort(), [records]);
  const managers = useMemo(() => [...new Set(records.map(r => r.manager_name).filter(Boolean))].sort(), [records]);

  const filteredAtt = useMemo(() => {
    let r = records;
    if (fStore)   r = r.filter(x => x.store_name === fStore);
    if (fManager) r = r.filter(x => x.manager_name === fManager);
    if (fFrom)    r = r.filter(x => x.work_date >= fFrom);
    if (fTo)      r = r.filter(x => x.work_date <= fTo);
    return r;
  }, [records, fStore, fManager, fFrom, fTo]);

  const newPlanCount = plans.filter(p => p.status === 'pending').length;

  const updatePlanStatus = async (id, status) => {
    const { error } = await supabase.from('leave_plans').update({ status }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast(status === 'approved' ? '확인 완료' : '반려 처리', 'ok'); fetchAll(); }
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='attendance'?'on':''}`} onClick={() => setTab('attendance')}>출퇴근 현황</button>
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
            <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFManager(''); }}>
              <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="fsel" value={fManager} onChange={e => setFManager(e.target.value)}>
              <option value="">전체 매니저</option>{managers.map(m => <option key={m}>{m}</option>)}
            </select>
            <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)}/>
            {(fStore||fManager||fFrom||fTo) && (
              <button className="btn-ghost" onClick={() => { setFStore(''); setFManager(''); setFFrom(''); setFTo(''); }}>✕ 초기화</button>
            )}
            <div className="fbar-right"><span className="fresult"><b>{filteredAtt.length}</b>건</span></div>
          </div>

          {loading ? <div className="empty"><span className="spinner"/></div> : (
            <div className="twrap">
              <table>
                <thead><tr><th>날짜</th><th>매니저</th><th>점포</th><th>지점</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr></thead>
                <tbody>
                  {filteredAtt.length === 0
                    ? <tr><td colSpan={7} className="empty">데이터가 없습니다</td></tr>
                    : filteredAtt.map(r => (
                      <tr key={r.id}>
                        <td className="mono">{r.work_date}</td>
                        <td><strong>{r.manager_name}</strong></td>
                        <td><span className="badge badge-dept">{r.store_name}</span></td>
                        <td><span className="badge badge-store">{r.branch_name}</span></td>
                        <td style={{fontFamily:'var(--mono)', color:'var(--success)', fontWeight:600}}>{fmt(r.clock_in)}</td>
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
