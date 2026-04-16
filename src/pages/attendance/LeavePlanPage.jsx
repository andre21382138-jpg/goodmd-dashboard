import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function LeavePlanPage({ profile }) {
  const [saving,    setSaving]    = useState(false);
  const [myPlans,   setMyPlans]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selDates,  setSelDates]  = useState([]);
  const [memo,      setMemo]      = useState('');
  const [editingId, setEditingId] = useState(null);
  const [members,   setMembers]   = useState([]);
  const [selMember, setSelMember] = useState(null);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); if (data?.length === 1) setSelMember(data[0]); });
  }, [profile.id]);

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextYear  = nextMonth.getFullYear();
  const nextMon   = nextMonth.getMonth();
  const nextMonStr = `${nextYear}-${String(nextMon + 1).padStart(2,'0')}`;
  const daysInMonth = new Date(nextYear, nextMon + 1, 0).getDate();
  const firstDow = new Date(nextYear, nextMon, 1).getDay();

  const fetchPlans = useCallback(async () => {
    if (!selMember) return;
    setLoading(true);
    const { data } = await supabase.from('leave_plans')
      .select('*').eq('manager_id', profile.id).eq('manager_name', selMember.name)
      .order('created_at', { ascending: false });
    setMyPlans(data || []);
    setLoading(false);
  }, [profile.id, selMember]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const pendingNextMonth = myPlans.find(p => p.target_month === nextMonStr && p.status === 'pending');
  const confirmedNextMonth = myPlans.find(p => p.target_month === nextMonStr && p.status !== 'pending');

  const toggleDate = (dateStr) => {
    setSelDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const startEdit = (plan) => {
    setEditingId(plan.id);
    setSelDates(plan.dates || []);
    setMemo(plan.memo || '');
  };

  const cancelEdit = () => {
    setEditingId(null); setSelDates([]); setMemo('');
  };

  const handleSubmit = async () => {
    if (!selMember) { toast('근무자를 선택해주세요', 'err'); return; }
    if (selDates.length === 0) { toast('날짜를 하나 이상 선택해주세요', 'err'); return; }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from('leave_plans').update({
        dates: selDates, memo: memo.trim() || null,
      }).eq('id', editingId);
      if (error) toast(error.message, 'err');
      else { toast('휴무계획 수정 완료', 'ok'); cancelEdit(); fetchPlans(); }
    } else {
      if (pendingNextMonth || confirmedNextMonth) { toast('이미 해당 월 계획을 제출했습니다', 'err'); setSaving(false); return; }
      const { error } = await supabase.from('leave_plans').insert({
        manager_id: profile.id, manager_name: selMember.name,
        store_name: profile.department, branch_name: profile.branch,
        target_month: nextMonStr, dates: selDates, memo: memo.trim() || null,
      });
      if (error) toast(error.message, 'err');
      else { toast(`${nextMonStr} 휴무계획 제출 완료`, 'ok'); setSelDates([]); setMemo(''); fetchPlans(); }
    }
    setSaving(false);
  };

  const dayNames = ['일','월','화','수','목','금','토'];
  const isFormMode = editingId || (!pendingNextMonth && !confirmedNextMonth);

  return (
    <div>
      <div className="card" style={{padding:'14px 18px', marginBottom:0}}>
        <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>근무자 선택</div>
        <div style={{display:'flex', gap:8}}>
          {members.map(m => (
            <button key={m.name} type="button"
              onClick={() => { setSelMember(selMember?.name===m.name ? null : m); setSelDates([]); setMemo(''); setEditingId(null); }}
              style={{ flex:1, height:40, border:'2px solid', borderRadius:'var(--radius)', fontSize:13, fontWeight:700, cursor:'pointer',
                borderColor: selMember?.name===m.name ? 'var(--accent)' : 'var(--border)',
                background: selMember?.name===m.name ? '#fff3e0' : '#fafafa',
                color: selMember?.name===m.name ? 'var(--accent)' : 'var(--text2)',
              }}>
              {m.display_name || m.name}
              <div style={{fontSize:10, fontWeight:400, marginTop:2}}>{m.job_title}</div>
            </button>
          ))}
        </div>
      </div>

      {selMember && (
      <>
      <div className="card">
        <div className="card-label">
          {editingId ? '휴무계획 수정' : `${nextYear}년 ${nextMon + 1}월 휴무계획 신청`}
          <span style={{fontSize:11, fontWeight:400, color:'var(--text3)', marginLeft:8}}>(익월 기준 · {selMember.display_name || selMember.name})</span>
        </div>

        {!isFormMode ? (
          <div>
            <div style={{background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:12, fontSize:13, color:'var(--success)', fontWeight:600}}>
              ✅ {nextMonStr} 휴무계획을 제출했습니다.
            </div>
            {pendingNextMonth && (
              <button className="btn btn-s" onClick={() => startEdit(pendingNextMonth)}>
                ✏️ 수정하기
              </button>
            )}
            {confirmedNextMonth && (
              <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>
                확인 완료된 계획은 수정할 수 없습니다.
              </div>
            )}
          </div>
        ) : (
          <>
            {editingId && (
              <div style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'8px 12px', marginBottom:12, fontSize:12, color:'#E65100', fontWeight:600}}>
                ✏️ 수정 모드 — 날짜를 다시 선택하세요
              </div>
            )}
            <div style={{marginBottom:16}}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4}}>
                {dayNames.map((d,i) => (
                  <div key={d} style={{textAlign:'center', fontSize:11, fontWeight:600,
                    color: i===0?'#c62828':i===6?'#1565C0':'var(--text3)', padding:'4px 0'}}>
                    {d}
                  </div>
                ))}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2}}>
                {Array.from({length: firstDow}).map((_, i) => <div key={`e${i}`}/>)}
                {Array.from({length: daysInMonth}).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${nextYear}-${String(nextMon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dow = (firstDow + i) % 7;
                  const isSat = dow === 6;
                  const isSun = dow === 0;
                  const isSel = selDates.includes(dateStr);
                  return (
                    <button key={day} onClick={() => toggleDate(dateStr)}
                      style={{
                        height:38, borderRadius:'var(--radius)', fontSize:13, fontWeight: isSel ? 700 : 400,
                        cursor:'pointer',
                        background: isSel ? 'var(--accent)' : '#fff',
                        color: isSel ? '#fff' : isSun ? '#c62828' : isSat ? '#1565C0' : 'var(--text)',
                        border: isSel ? 'none' : '1px solid var(--border)',
                      }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {selDates.length > 0 && (
              <div style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:12}}>
                <div style={{fontSize:11, fontWeight:600, color:'#E65100', marginBottom:6}}>선택된 날짜 ({selDates.length}일)</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                  {selDates.map(d => (
                    <span key={d} style={{background:'var(--accent)', color:'#fff', borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:600}}>{d}</span>
                  ))}
                </div>
              </div>
            )}

            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모 (선택사항)"
              style={{width:'100%', height:72, padding:'8px 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, fontFamily:'var(--sans)', resize:'vertical', outline:'none', marginBottom:12}}/>

            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-p" onClick={handleSubmit} disabled={saving || selDates.length===0}
                style={{flex:1, justifyContent:'center', height:40}}>
                {saving ? <span className="spinner"/> : editingId ? '✓ 휴무계획 수정 완료' : `✓ ${nextMonStr} 휴무계획 제출`}
              </button>
              {editingId && (
                <button className="btn btn-s" onClick={cancelEdit} style={{height:40}}>취소</button>
              )}
            </div>
          </>
        )}
      </div>

      {!loading && myPlans.length > 0 && (
        <div className="card">
          <div className="card-label">제출 이력</div>
          <div className="twrap">
            <table>
              <thead><tr><th>신청월</th><th>선택 날짜</th><th>일수</th><th>메모</th><th>제출일</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {myPlans.map(p => (
                  <tr key={p.id}>
                    <td className="mono" style={{fontWeight:700}}>{p.target_month}</td>
                    <td><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{(p.dates||[]).map(d=><span key={d} style={{background:'#fff3e0',color:'var(--accent)',border:'1px solid #ffcc80',borderRadius:3,padding:'1px 6px',fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{d}</span>)}</div></td>
                    <td style={{textAlign:'center', fontWeight:700, color:'var(--accent)'}}>{(p.dates||[]).length}일</td>
                    <td style={{fontSize:11, color:'var(--text3)'}}>{p.memo||'-'}</td>
                    <td className="mono" style={{fontSize:11}}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>
                      <span style={{padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                        background: p.status==='approved'?'#e8f5e9':p.status==='rejected'?'#ffebee':'#fff3e0',
                        color: p.status==='approved'?'var(--success)':p.status==='rejected'?'var(--danger)':'#E65100'}}>
                        {p.status==='approved'?'확인':p.status==='rejected'?'반려':'대기'}
                      </span>
                    </td>
                    <td>
                      {p.status === 'pending' && (
                        <button className="btn btn-s" style={{fontSize:11, padding:'3px 8px'}}
                          onClick={() => startEdit(p)}>수정</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
