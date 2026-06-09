import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export default function MyAttendancePage({ profile }) {
  const now = new Date();
  const defaultYear  = now.getFullYear();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, '0');
  const [selMonth,  setSelMonth]  = useState(`${defaultYear}-${defaultMonth}`);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [members,   setMembers]   = useState([]);
  const [selMember, setSelMember] = useState(null);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); if (data?.length === 1) setSelMember(data[0]); });
  }, [profile.id]);

  const fetchData = useCallback(async () => {
    if (!selMember) { setRecords([]); setLoading(false); return; }
    setLoading(true);
    const from = `${selMonth}-01`;
    const toD  = new Date(selMonth.split('-')[0], selMonth.split('-')[1], 0);
    const to   = `${selMonth}-${String(toD.getDate()).padStart(2,'0')}`;
    const { data } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id).eq('manager_name', selMember.name)
      .gte('work_date', from).lte('work_date', to)
      .order('work_date', { ascending: true });
    setRecords(data || []);
    setLoading(false);
  }, [profile.id, selMonth, selMember]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const duration = (ci, co) => {
    if (!ci || !co) return '-';
    const m = Math.round((new Date(co) - new Date(ci)) / 60000);
    return `${Math.floor(m/60)}시간 ${m%60}분`;
  };

  const totalDays = records.length;
  const totalMins = records.reduce((s, r) => {
    if (!r.clock_in || !r.clock_out) return s;
    return s + Math.round((new Date(r.clock_out) - new Date(r.clock_in)) / 60000);
  }, 0);

  const dayName = (dateStr) => {
    const days = ['일','월','화','수','목','금','토'];
    return days[new Date(dateStr).getDay()];
  };

  return (
    <div>
      {members.length > 1 && (
        <div className="card" style={{padding:'14px 18px', marginBottom:0}}>
          <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>근무자 선택</div>
          <div style={{display:'flex', gap:8}}>
            {members.map(m => (
              <button key={m.name} type="button"
                onClick={() => setSelMember(selMember?.name===m.name ? null : m)}
                style={{ flex:1, height:44, border:'2px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
                  borderColor: selMember?.name===m.name ? 'var(--accent)' : 'var(--border)',
                  background: selMember?.name===m.name ? '#fff3e0' : '#fafafa',
                  color: selMember?.name===m.name ? 'var(--accent)' : 'var(--text2)' }}>
                {m.display_name || m.name}
                <div style={{fontSize:10, fontWeight:400, marginTop:2}}>{m.job_title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{padding:'14px 18px'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <label style={{fontSize:13, fontWeight:700, color:'var(--text)'}}>조회 월</label>
          <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)}
            style={{height:36, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', outline:'none'}}/>
          <div style={{marginLeft:'auto', display:'flex', gap:16}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:2}}>출근일수</div>
              <div style={{fontSize:20, fontWeight:700, color:'var(--success)', fontFamily:'var(--mono)'}}>{totalDays}일</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        {loading ? <div className="empty"><span className="spinner"/></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>날짜</th><th>요일</th><th>출근</th><th>퇴근</th></tr>
              </thead>
              <tbody>
                {records.length === 0
                  ? <tr><td colSpan={4} className="empty">{!selMember ? '근무자를 선택해주세요' : `${selMonth} 출퇴근 기록이 없습니다`}</td></tr>
                  : records.map(r => {
                    const day = dayName(r.work_date);
                    const isSun = day === '일';
                    const isSat = day === '토';
                    return (
                      <tr key={r.id}>
                        <td className="mono">{r.work_date}</td>
                        <td style={{fontWeight:700, color: isSun?'var(--danger)':isSat?'var(--accent2)':'var(--text)'}}>{day}</td>
                        <td style={{fontWeight:700, color: r.clock_in  ? 'var(--success)' : 'var(--danger)'}}>
                          {r.clock_in  ? '✓ 체크완료' : '미체크'}
                        </td>
                        <td style={{fontWeight:700, color: r.clock_out ? 'var(--accent)'  : 'var(--danger)'}}>
                          {r.clock_out ? '✓ 체크완료' : '미체크'}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
