import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function ClockInOutPage({ profile }) {
  const [today,    setToday]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [history,  setHistory]  = useState([]);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: todayRec } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id).eq('work_date', todayStr()).maybeSingle();
    setToday(todayRec);
    const { data: hist } = await supabase.from('attendance')
      .select('*').eq('manager_id', profile.id)
      .order('work_date', { ascending: false }).limit(20);
    setHistory(hist || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClock = async (type) => {
    setSaving(true);
    const now = new Date().toISOString();
    if (type === 'in') {
      if (today) { toast('오늘은 이미 출근 처리됐습니다', 'err'); setSaving(false); return; }
      const { error } = await supabase.from('attendance').insert({
        manager_id: profile.id, manager_name: profile.name,
        store_name: profile.department, branch_name: profile.branch,
        work_date: todayStr(), clock_in: now,
      });
      if (error) toast(error.message, 'err');
      else toast('출근 체크 완료 ✅', 'ok');
    } else {
      if (!today) { toast('출근 체크를 먼저 해주세요', 'err'); setSaving(false); return; }
      if (today.clock_out) { toast('오늘은 이미 퇴근 처리됐습니다', 'err'); setSaving(false); return; }
      const { error } = await supabase.from('attendance').update({ clock_out: now }).eq('id', today.id);
      if (error) toast(error.message, 'err');
      else toast('퇴근 체크 완료 ✅', 'ok');
    }
    fetchData();
    setSaving(false);
  };

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

  if (loading) return <div className="empty"><span className="spinner"/></div>;

  return (
    <div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
          <div style={{fontSize:13, fontWeight:700, color:'var(--text)'}}>
            📍 {profile.department} · {profile.branch}
          </div>
          <div style={{marginLeft:'auto', fontFamily:'var(--mono)', fontSize:12, color:'var(--text3)'}}>
            {todayStr()} (오늘)
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20}}>
          {[
            { label:'출근 시각', value: today ? fmt(today.clock_in) : '-', color: today ? 'var(--success)' : 'var(--text3)' },
            { label:'퇴근 시각', value: today?.clock_out ? fmt(today.clock_out) : '-', color: today?.clock_out ? 'var(--accent)' : 'var(--text3)' },
            { label:'근무 시간', value: duration(today?.clock_in, today?.clock_out), color: 'var(--text)' },
          ].map(s => (
            <div key={s.label} style={{background:'var(--bg3)', borderRadius:'var(--radius)', padding:'14px 16px', textAlign:'center'}}>
              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:22, fontWeight:700, fontFamily:'var(--mono)', color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <button
            onClick={() => handleClock('in')} disabled={saving || !!today}
            style={{height:56, fontSize:16, fontWeight:700, borderRadius:'var(--radius)', border:'none', cursor: today ? 'not-allowed' : 'pointer',
              background: today ? '#e0e0e0' : 'var(--success)', color: today ? '#aaa' : '#fff'}}>
            {saving ? <span className="spinner"/> : today ? '✅ 출근 완료' : '🟢 출근'}
          </button>
          <button
            onClick={() => handleClock('out')} disabled={saving || !today || !!today?.clock_out}
            style={{height:56, fontSize:16, fontWeight:700, borderRadius:'var(--radius)', border:'none',
              cursor: (!today || today?.clock_out) ? 'not-allowed' : 'pointer',
              background: today?.clock_out ? '#e0e0e0' : (today ? 'var(--accent)' : '#e0e0e0'),
              color: (!today || today?.clock_out) ? '#aaa' : '#fff'}}>
            {saving ? <span className="spinner"/> : today?.clock_out ? '✅ 퇴근 완료' : '🔴 퇴근'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-label">최근 출퇴근 이력</div>
        <div className="twrap">
          <table>
            <thead><tr><th>날짜</th><th>출근</th><th>퇴근</th><th>근무시간</th></tr></thead>
            <tbody>
              {history.length === 0
                ? <tr><td colSpan={4} className="empty">이력이 없습니다</td></tr>
                : history.map(r => (
                  <tr key={r.id}>
                    <td className="mono">{r.work_date}</td>
                    <td style={{color:'var(--success)', fontWeight:600, fontFamily:'var(--mono)'}}>{fmt(r.clock_in)}</td>
                    <td style={{color:'var(--accent)', fontWeight:600, fontFamily:'var(--mono)'}}>{fmt(r.clock_out)}</td>
                    <td className="mono" style={{color:'var(--text2)'}}>{duration(r.clock_in, r.clock_out)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
