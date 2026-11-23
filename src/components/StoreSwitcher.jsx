import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// 본사 담당자/관리자의 '매장 전환(보기)' — 헤더 우측에서 특정 매장 화면으로 전환/복귀
export default function StoreSwitcher({ realProfile, impersonated, onStartImpersonate, onStopImpersonate }) {
  const [open, setOpen]           = useState(false);
  const [storeList, setStoreList] = useState([]);
  const [q, setQ]                 = useState('');

  const openSwitch = async () => {
    setOpen(true); setQ('');
    const { data } = await supabase.from('profiles')
      .select('*')   // approved 등 전 컬럼 포함 (전환 프로필이 완전해야 승인 게이트 통과)
      .eq('job_title', '매니저').eq('approved', true).not('department', 'is', null)
      .order('department').order('branch');
    setStoreList(data || []);
  };

  const filtered = (storeList || []).filter(s => {
    const t = q.trim(); if (!t) return true;
    return `${s.department || ''} ${s.branch || ''} ${s.name || ''}`.toLowerCase().includes(t.toLowerCase());
  });
  // 계정 없이 전환 가능한 '테스트매장' 합성 프로필
  const testStoreProfile = { ...realProfile, id: realProfile?.id, name: '테스트매니저', display_name: '테스트매니저', department: '테스트매장', branch: '테스트점', job_title: '매니저', role: 'store', approved: true };
  const showTest = (() => { const t = q.trim().toLowerCase(); return !t || '테스트매장 테스트점 테스트매니저 test'.includes(t); })();

  const pick = (sp) => { onStartImpersonate(sp); setOpen(false); };

  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8, flexShrink:0 }}>
      {impersonated && (
        <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#eef0fe', border:'1px solid #c7cbf7', borderRadius:999, padding:'5px 12px', fontSize:12, fontWeight:700, color:'var(--accent)', whiteSpace:'nowrap' }}>
          🔁 {impersonated.department} {impersonated.branch} 전환 중
        </span>
      )}
      {impersonated && (
        <button type="button" onClick={onStopImpersonate} className="btn btn-s" style={{ height:34 }}>↩ 본사 복귀</button>
      )}
      <button type="button" onClick={openSwitch} className="btn btn-p" style={{ height:34 }}>🏪 매장 전환</button>

      {open && (
        <div style={{position:'fixed', inset:0, zIndex:600, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.45)'}} onClick={() => setOpen(false)}/>
          <div style={{position:'relative', background:'#fff', borderRadius:12, width:'min(460px, 94vw)', maxHeight:'82vh', overflow:'auto', padding:'20px 22px', boxShadow:'0 8px 40px rgba(0,0,0,0.25)', textAlign:'left'}}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:4}}>🏪 매장 전환 (보기)</div>
            <div style={{fontSize:12, color:'var(--text3)', marginBottom:12}}>선택한 매장 계정 화면으로 전환됩니다. 본사 복귀 전까지 유지됩니다.</div>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="점포·지점·이름 검색"
              className="input" style={{marginBottom:10}}/>
            <div style={{border:'1px solid var(--border)', borderRadius:8, maxHeight:360, overflowY:'auto'}}>
              {showTest && (
                <div onClick={() => pick(testStoreProfile)}
                  style={{padding:'10px 12px', borderBottom:'1px solid #f2f2f2', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:8, background:'#f1f8e9'}}
                  onMouseEnter={e => e.currentTarget.style.background='#dcedc8'} onMouseLeave={e => e.currentTarget.style.background='#f1f8e9'}>
                  <span>🧪</span><strong>테스트매장</strong><span style={{color:'#888'}}>테스트점</span>
                  <span style={{marginLeft:'auto', fontSize:11, color:'#7cb342', fontWeight:700}}>업데이트 테스트용</span>
                </div>
              )}
              {filtered.length === 0 && !showTest ? <div style={{padding:'16px', textAlign:'center', color:'var(--text3)', fontSize:13}}>매장이 없습니다</div>
                : filtered.map(s => (
                  <div key={s.id} onClick={() => pick(s)}
                    style={{padding:'10px 12px', borderBottom:'1px solid #f2f2f2', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:8}}
                    onMouseEnter={e => e.currentTarget.style.background='#f6f7fb'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                    <strong>{s.department}</strong><span style={{color:'#888'}}>{s.branch}</span>
                    {s.name && <span style={{marginLeft:'auto', fontSize:11, color:'#aaa'}}>{s.name}</span>}
                  </div>
                ))}
            </div>
            <div style={{textAlign:'right', marginTop:12}}>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-s">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
