import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/utils';

// 팔레오 출석체크 적립금 이벤트 — 공개 페이지 (?att=매장ID)
//  회원이 매장 QR 스캔 → 이름/휴대폰 입력 → [확인] → 가입회원이면 1일 1회 100원 적립
export default function AttendancePage({ storeId }) {
  const [store, setStore]   = useState(null);
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { status:'ok'|'already', points, name }

  useEffect(() => {
    supabase.from('profiles').select('id, department, branch')
      .eq('id', storeId).eq('approved', true).maybeSingle()
      .then(({ data }) => setStore(data));
  }, [storeId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { alert('이름을 입력해주세요'); return; }
    if (phone.replace(/\D/g, '').length < 10) { alert('휴대폰번호를 올바르게 입력해주세요'); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc('attend_reward', { p_store: storeId, p_name: name.trim(), p_phone: phone });
    setSaving(false);
    if (error) { alert('오류가 발생했습니다. 다시 시도해주세요.'); return; }
    const status = data?.status;
    if (status === 'not_found') {
      alert('가입고객 정보가 없습니다. 다시 확인해주세요');
      return; // 입력화면 유지
    }
    setResult(data); // ok | already
  };

  const wrap = { minHeight:'100vh', background:'#fff8f0', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Malgun Gothic',sans-serif" };
  const card = { width:'100%', maxWidth:420, background:'#fff', borderRadius:16, boxShadow:'0 6px 30px rgba(0,0,0,0.10)', padding:'28px 24px', boxSizing:'border-box' };
  const input = { width:'100%', height:52, padding:'0 16px', border:'1.5px solid #e0e0e0', borderRadius:10, fontSize:17, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };

  if (result) {
    const ok = result.status === 'ok';
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:10 }}>{ok ? '🎉' : '📅'}</div>
          <div style={{ fontSize:24, fontWeight:800, color: ok ? '#2e7d32' : '#E65100', marginBottom:8 }}>
            {ok ? '100원이 적립되었습니다' : '오늘은 이미 적립되었습니다'}
          </div>
          <div style={{ fontSize:14, color:'#666', lineHeight:1.7 }}>
            {result.name ? <b>{result.name}</b> : null} 님{ok ? ' 방문 감사합니다!' : ' (출석 적립은 1일 1회)'}
            {ok && typeof result.points === 'number' && (
              <div style={{ marginTop:12, fontSize:15 }}>현재 적립금 <b style={{ color:'#E65100' }}>{Number(result.points).toLocaleString()}원</b></div>
            )}
          </div>
          <button type="button" onClick={() => { setResult(null); setName(''); setPhone(''); }}
            style={{ marginTop:24, width:'100%', height:50, border:'1.5px solid #E65100', borderRadius:10, background:'#fff', color:'#E65100', fontSize:15, fontWeight:700, cursor:'pointer' }}>
            다른 회원 적립하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <form style={card} onSubmit={submit}>
        <div style={{ textAlign:'center', marginBottom:22 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#E65100', letterSpacing:0.5 }}>팔레오 출석체크 적립금 이벤트</div>
          <div style={{ fontSize:26, fontWeight:800, margin:'8px 0 4px' }}>출석하고 <span style={{ color:'#E65100' }}>100원</span> 적립 🎁</div>
          {store && <div style={{ fontSize:14, color:'#888', fontWeight:600 }}>{store.department} {store.branch}</div>}
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:700, color:'#444', marginBottom:8 }}>이름</label>
          <input value={name} onChange={e => setName(e.target.value)} style={input} placeholder="홍길동" required />
        </div>
        <div style={{ marginBottom:22 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:700, color:'#444', marginBottom:8 }}>휴대폰번호</label>
          <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} style={input} placeholder="010-0000-0000" inputMode="numeric" required />
        </div>
        <button type="submit" disabled={saving}
          style={{ width:'100%', height:54, border:'none', borderRadius:10, background:'#E65100', color:'#fff', fontSize:17, fontWeight:800, cursor:'pointer' }}>
          {saving ? '처리 중…' : '확인'}
        </button>
        <div style={{ marginTop:16, fontSize:12, color:'#aaa', textAlign:'center', lineHeight:1.6 }}>
          ※ 가입회원만 적립되며, 하루 1회 100원 적립됩니다.
        </div>
      </form>
    </div>
  );
}
