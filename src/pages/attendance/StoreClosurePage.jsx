import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const DOW_KR = ['일','월','화','수','목','금','토'];

// 익월(YYYY-MM) 계산
function nextMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    str: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
    lastDay: new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(),
    firstDow: d.getDay(),
  };
}

export default function StoreClosurePage({ profile }) {
  const target = useMemo(() => nextMonth(), []);
  const [selected, setSelected] = useState(new Set()); // Set of 'YYYY-MM-DD'
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [savedRow, setSavedRow] = useState(null); // 기존 등록 row

  const fetchExisting = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('store_closures')
      .select('*')
      .eq('store_name', profile.department)
      .eq('branch_name', profile.branch)
      .eq('target_month', target.str)
      .maybeSingle();
    setSavedRow(data || null);
    setSelected(new Set(data?.dates || []));
    setLoading(false);
  }, [profile.department, profile.branch, target.str]);

  useEffect(() => { fetchExisting(); }, [fetchExisting]);

  const toggleDate = (day) => {
    const ds = `${target.str}-${String(day).padStart(2,'0')}`;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ds)) next.delete(ds);
      else next.add(ds);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const dates = [...selected].sort();
    const { error } = await supabase.from('store_closures').upsert({
      store_name:    profile.department,
      branch_name:   profile.branch,
      target_month:  target.str,
      dates,
      registered_by: profile.id,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'store_name,branch_name,target_month' });
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast(`${target.year}년 ${target.month}월 휴점일 ${dates.length}일 등록 완료`, 'ok');
    fetchExisting();
  };

  // 캘린더 셀 배열 — 빈 셀(이전달 영역) + 일자
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < target.firstDow; i++) arr.push(null);
    for (let d = 1; d <= target.lastDay; d++) arr.push(d);
    return arr;
  }, [target]);

  if (!profile?.department || !profile?.branch) {
    return <div className="empty">매장 정보가 없습니다. 본사·어드민 계정으로는 사용할 수 없는 메뉴입니다.</div>;
  }

  return (
    <div>
      <div className="card" style={{padding:'18px 20px'}}>
        <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:14, flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:1}}>대상 매장</div>
            <div style={{fontSize:16, fontWeight:700, color:'var(--text)'}}>
              {profile.department} <span style={{color:'var(--text3)'}}>·</span> {profile.branch}
            </div>
          </div>
          <div style={{borderLeft:'1px solid var(--border)', paddingLeft:14}}>
            <div style={{fontSize:11, color:'var(--text3)', fontWeight:600, letterSpacing:1}}>등록 대상 월</div>
            <div style={{fontSize:16, fontWeight:700, color:'var(--accent)'}}>
              📅 {target.year}년 {target.month}월
            </div>
          </div>
          <div style={{marginLeft:'auto', textAlign:'right'}}>
            <div style={{fontSize:11, color:'var(--text3)'}}>선택된 휴점일</div>
            <div style={{fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{selected.size}일</div>
          </div>
        </div>

        <div style={{background:'#fff8e1', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:12, color:'#6d4c41', marginBottom:14}}>
          💡 익월({target.year}년 {target.month}월) 휴점일을 선택 후 [✅ 확인] 버튼을 클릭해주세요. 휴점일은 출근체크 없이 자동으로 "휴점"으로 표시됩니다. 매니저·부매니저 누구나 등록·수정 가능합니다.
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div> : (
        <>
          {/* 캘린더 */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:6, marginBottom:14}}>
            {DOW_KR.map((d, i) => (
              <div key={d} style={{textAlign:'center', fontSize:12, fontWeight:700, padding:'6px 0',
                color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--accent2)' : 'var(--text2)'}}>
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`}/>;
              const ds = `${target.str}-${String(day).padStart(2,'0')}`;
              const sel = selected.has(ds);
              const dow = (target.firstDow + day - 1) % 7;
              return (
                <button key={day} type="button" onClick={() => toggleDate(day)}
                  style={{
                    height:60, border:'2px solid', borderRadius:'var(--radius)',
                    background: sel ? '#ffebee' : '#fff',
                    borderColor: sel ? 'var(--danger)' : 'var(--border)',
                    color: sel ? 'var(--danger)' : (dow === 0 ? 'var(--danger)' : dow === 6 ? 'var(--accent2)' : 'var(--text)'),
                    fontSize:14, fontWeight:700, cursor:'pointer', transition:'all 120ms',
                  }}>
                  {day}
                  {sel && <div style={{fontSize:10, fontWeight:700, marginTop:2}}>휴점</div>}
                </button>
              );
            })}
          </div>

          {/* 선택된 일자 요약 */}
          {selected.size > 0 && (
            <div style={{marginBottom:14, padding:'10px 14px', background:'#fafafa', border:'1px solid var(--border)', borderRadius:'var(--radius)'}}>
              <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:6}}>선택된 휴점일</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                {[...selected].sort().map(d => {
                  const day = Number(d.split('-')[2]);
                  return (
                    <span key={d} style={{background:'#ffebee', color:'var(--danger)', border:'1px solid #f48fb1',
                      borderRadius:3, padding:'1px 8px', fontSize:11, fontWeight:700}}>
                      {day}일
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            style={{width:'100%', height:46, border:'none', borderRadius:'var(--radius)', background:'var(--accent)',
              color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer'}}>
            {saving ? <span className="spinner"/> : `✅ ${target.year}년 ${target.month}월 휴점일 ${selected.size}일 등록/수정`}
          </button>

          {savedRow && (
            <div style={{textAlign:'center', marginTop:10, fontSize:11, color:'var(--text3)'}}>
              마지막 등록: {new Date(savedRow.updated_at || savedRow.registered_at).toLocaleString('ko-KR')}
              {' · 익월에 한해 자유롭게 수정 가능합니다'}
            </div>
          )}
        </>
        )}
      </div>
    </div>
  );
}
