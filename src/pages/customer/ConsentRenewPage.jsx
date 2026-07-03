import React, { useState } from 'react';

// 공개(비로그인) 마케팅 수신 재동의 페이지 — 회원이 매장 QR을 본인 폰으로 스캔해서 접속.
// ?rc=1 로 진입. 전화번호 입력 → 본인 확인 → [동의].
export default function ConsentRenewPage() {
  const [phone,   setPhone]   = useState('');
  const [step,    setStep]    = useState('input'); // 'input' | 'confirm' | 'done'
  const [member,  setMember]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [result,  setResult]  = useState(null);

  const fmtPhone = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  };

  const api = async (action) => {
    const res = await fetch('/api/consent-renew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, action }),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  };

  const lookup = async () => {
    setErr('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setErr('휴대폰 번호를 정확히 입력해주세요'); return; }
    setLoading(true);
    const { ok, data } = await api('lookup');
    setLoading(false);
    if (!ok) { setErr(data.error || '조회 실패'); return; }
    if (!data.found) { setErr('일치하는 회원 정보가 없습니다.\n번호를 확인하거나 매장 직원에게 문의해주세요.'); return; }
    setMember(data);
    setStep('confirm');
  };

  const apply = async () => {
    setErr('');
    setLoading(true);
    const { ok, data } = await api('apply');
    setLoading(false);
    if (!ok || !data.ok) { setErr(data.error || '처리에 실패했습니다. 다시 시도해주세요.'); return; }
    setResult(data);
    setStep('done');
  };

  const wrap = { minHeight:'100vh', background:'#f5f6f8', display:'flex', flexDirection:'column', alignItems:'center', padding:'32px 18px', fontFamily:'-apple-system,BlinkMacSystemFont,"Malgun Gothic",sans-serif' };
  const card = { width:'100%', maxWidth:400, background:'#fff', borderRadius:16, boxShadow:'0 4px 24px rgba(0,0,0,0.08)', padding:'28px 22px' };
  const btn = (bg) => ({ width:'100%', height:50, border:'none', borderRadius:12, background:bg, color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', marginTop:8 });

  return (
    <div style={wrap}>
      <div style={{ fontSize:22, fontWeight:800, color:'#e65100', marginBottom:4 }}>팔레오</div>
      <div style={{ fontSize:13, color:'#888', marginBottom:22 }}>마케팅 정보 수신 재동의</div>

      <div style={card}>
        {step === 'input' && (
          <>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>본인 확인</div>
            <div style={{ fontSize:13, color:'#666', lineHeight:1.6, marginBottom:18 }}>
              가입하신 <b>휴대폰 번호</b>를 입력해주세요.
            </div>
            <input
              type="tel" inputMode="numeric" value={phone}
              onChange={e => setPhone(fmtPhone(e.target.value))}
              placeholder="010-0000-0000"
              style={{ width:'100%', height:52, padding:'0 14px', border:'1px solid #ddd', borderRadius:12, fontSize:18, letterSpacing:1, outline:'none', textAlign:'center', boxSizing:'border-box' }}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              autoFocus
            />
            {err && <div style={{ color:'#c62828', fontSize:13, marginTop:12, whiteSpace:'pre-line' }}>{err}</div>}
            <button style={btn('#e65100')} onClick={lookup} disabled={loading}>
              {loading ? '확인 중...' : '확인'}
            </button>
          </>
        )}

        {step === 'confirm' && member && (
          <>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>회원 정보 확인</div>
            <div style={{ background:'#faf7f2', border:'1px solid #f0e6d6', borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
              <div style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>{member.maskedName} 님</div>
              <div style={{ fontSize:14, color:'#666', fontFamily:'monospace' }}>{member.maskedPhone}</div>
              <div style={{ marginTop:10, fontSize:13 }}>
                현재 마케팅 수신 상태:{' '}
                <b style={{ color: member.status === '유효' ? '#2e7d32' : member.status === '만료' ? '#c62828' : '#757575' }}>
                  {member.status}{member.status === '유효' && member.expireDate ? ` (만료 ${member.expireDate})` : ''}
                </b>
              </div>
            </div>
            <div style={{ fontSize:13, color:'#555', lineHeight:1.7, background:'#f8f9fa', borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
              아래 동의 시 <b>마케팅 정보 수신에 재동의</b>하며, 동의일로부터 <b>1년간</b> 유지됩니다.
              <br/>· 매장 프로모션·신제품 안내 · 적립금 지급/사용 · 회원 전용 혜택 우선 안내
            </div>
            {err && <div style={{ color:'#c62828', fontSize:13, marginTop:8 }}>{err}</div>}
            <button style={btn('#2e7d32')} onClick={apply} disabled={loading}>
              {loading ? '처리 중...' : '✅ 마케팅 수신 재동의'}
            </button>
            <button style={{ ...btn('#fff'), color:'#888', border:'1px solid #ddd', marginTop:8 }}
              onClick={() => { setStep('input'); setMember(null); setErr(''); }}>
              번호 다시 입력
            </button>
          </>
        )}

        {step === 'done' && result && (
          <div style={{ textAlign:'center', padding:'10px 0' }}>
            <div style={{ fontSize:48, marginBottom:8 }}>✅</div>
            <div style={{ fontSize:19, fontWeight:800, marginBottom:6 }}>재동의 완료</div>
            <div style={{ fontSize:15, color:'#333', marginBottom:4 }}>{result.maskedName} 님</div>
            <div style={{ fontSize:14, color:'#2e7d32', fontWeight:700 }}>
              마케팅 수신동의가 갱신되었습니다.
            </div>
            <div style={{ fontSize:13, color:'#888', marginTop:8 }}>만료일: {result.expireDate}</div>
            <div style={{ fontSize:12, color:'#aaa', marginTop:22 }}>이 창은 닫으셔도 됩니다.</div>
          </div>
        )}
      </div>

      <div style={{ fontSize:11, color:'#bbb', marginTop:20, textAlign:'center', lineHeight:1.6 }}>
        (주)한국생활건강 · 수신거부 080-809-2009<br/>
        본인 확인을 위해 입력하신 번호는 재동의 처리에만 사용됩니다.
      </div>
    </div>
  );
}
