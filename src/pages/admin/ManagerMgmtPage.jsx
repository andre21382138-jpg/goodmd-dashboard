import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { uniq } from '../../lib/utils';

export default function ManagerMgmtPage() {
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [fStore,    setFStore]    = useState('');
  const [fBranch,   setFBranch]   = useState('');
  const [fJob,      setFJob]      = useState('');
  const [fYear,     setFYear]     = useState('');
  const [sortOld,   setSortOld]   = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('store_members')
      .select('*, store:profiles!store_account_id(email, department, branch)')
      .order('store_account_id');
    setMembers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const stores   = useMemo(() => uniq(members.map(m => m.store?.department).filter(Boolean)), [members]);
  const branches = useMemo(() => uniq((fStore ? members.filter(m => m.store?.department===fStore) : members).map(m => m.store?.branch).filter(Boolean)), [members, fStore]);
  const hireYears = useMemo(() => uniq(members.map(m => m.hire_date?.slice(0,4)).filter(Boolean)).sort(), [members]);

  const filtered = useMemo(() => {
    let r = members;
    if (fStore)  r = r.filter(m => m.store?.department===fStore);
    if (fBranch) r = r.filter(m => m.store?.branch===fBranch);
    if (fJob)    r = r.filter(m => m.job_title===fJob);
    if (fYear)   r = r.filter(m => m.hire_date?.startsWith(fYear));
    if (sortOld) r = [...r].sort((a,b) => (a.hire_date||'').localeCompare(b.hire_date||''));
    return r;
  }, [members, fStore, fBranch, fJob, fYear, sortOld]);

  const td = { fontSize:13, color:'var(--text)' };

  return (
    <div>
      <div className="card" style={{padding:'16px 20px'}}>
        <div className="fbar">
          <select className="fsel" value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }}>
            <option value="">전체 점포</option>{stores.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fBranch} onChange={e => setFBranch(e.target.value)} disabled={!fStore} style={{background:!fStore?'#f0f0f0':'#fff'}}>
            <option value="">전체 지점</option>{branches.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="fsel" value={fJob} onChange={e => setFJob(e.target.value)}>
            <option value="">전체 직급</option>
            <option value="매니저">매니저</option>
            <option value="부매니저">부매니저</option>
          </select>
          <select className="fsel" value={fYear} onChange={e => setFYear(e.target.value)}>
            <option value="">전체 입사연도</option>
            {hireYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button className="btn btn-s" onClick={() => setSortOld(p => !p)}
            style={{fontWeight:700, background: sortOld?'var(--accent)':'', color: sortOld?'#fff':'', borderColor: sortOld?'var(--accent)':''}}>
            {sortOld ? '↑ 오래된순' : '정렬'}
          </button>
          {(fStore||fBranch||fJob||fYear) && <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); setFJob(''); setFYear(''); }}>✕ 초기화</button>}
          <div className="fbar-right"><span className="fresult">근무자 <b>{filtered.length}</b>명</span></div>
        </div>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>점포명</th><th>지점명</th><th>직급</th><th>이름</th><th>연락처</th><th>아이디</th><th>입사일</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={7} className="empty">근무자가 없습니다</td></tr>
                  : filtered.map(m => (
                    <tr key={m.id}>
                      <td><span className="badge badge-dept">{m.store?.department}</span></td>
                      <td><span className="badge badge-store">{m.store?.branch}</span></td>
                      <td style={{...td, fontWeight:600, color: m.job_title==='매니저'?'var(--accent)':'var(--text2)'}}>{m.job_title}</td>
                      <td style={{...td, fontWeight:700}}>{m.display_name || m.name}</td>
                      <td style={td}>{m.phone || '-'}</td>
                      <td style={td}>{m.employee_id}</td>
                      <td style={td}>{m.hire_date || '-'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
