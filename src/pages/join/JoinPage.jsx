import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/utils';

export default function JoinPage({ managerId }) {
  const urlParams = new URLSearchParams(window.location.search);
  const presetMemberName = urlParams.get('mn') ? decodeURIComponent(urlParams.get('mn')) : null;

  const [storeProfile, setStoreProfile] = useState(null);
  const [members,      setMembers]      = useState([]);
  const [selMember,    setSelMember]    = useState(null);
  const [loadingMgr,   setLoadingMgr]  = useState(true);
  const [name,         setName]        = useState('');
  const [phone,        setPhone]       = useState('');
  const [birthday,     setBirthday]    = useState('');
  const [gender,       setGender]      = useState('');
  const [smsConsent,   setSmsConsent]  = useState(false);
  const [saving,       setSaving]      = useState(false);
  const [done,         setDone]        = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id,name,department,branch')
      .eq('id', managerId).eq('approved',true).maybeSingle()
      .then(({ data }) => {
        setStoreProfile(data);
        if (data) {
          supabase.from('store_members').select('name,display_name,job_title')
            .eq('store_account_id', data.id).order('is_primary', { ascending: false })
            .then(({ data: mems }) => {
              setMembers(mems || []);
              if (presetMemberName) {
                const found = (mems || []).find(m => m.name === presetMemberName);
                if (found) setSelMember(found);
              }
            });
        }
        setLoadingMgr(false);
      });
  }, [managerId, presetMemberName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selMember) { alert('담당 매니저를 선택해주세요'); return; }
    const cleaned = phone.replace(/\D/g,'');
    if (cleaned.length < 10) { alert('연락처를 올바르게 입력해주세요'); return; }
    setSaving(true);

    let consentIp = null, consentUa = null;
    if (smsConsent) {
      try {
        const r = await fetch('/api/get-client-info');
        const d = await r.json();
        consentIp = d.ip; consentUa = d.ua;
      } catch (_) {}
    }

    const { error } = await supabase.from('customers').insert({
      joined_at: new Date().toISOString().slice(0,10),
      name: name.trim(), phone, birthday: birthday || null, gender: gender || null,
      store_name: storeProfile.department, branch_name: storeProfile.branch,
      manager_name: selMember.name,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      consent_ip: consentIp, consent_ua: consentUa,
    });
    if (error) { alert('오류가 발생했습니다. 다시 시도해주세요.'); setSaving(false); return; }
    setDone(true); setSaving(false);
  };

  if (loadingMgr) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#fff9f0'}}>
      <span className="spinner"/>
    </div>
  );

  if (!storeProfile) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#fff9f0',flexDirection:'column',gap:12}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:700,color:'#333'}}>유효하지 않은 링크입니다</div>
      <div style={{fontSize:13,color:'#888'}}>담당 매니저에게 문의해주세요</div>
    </div>
  );

  if (done) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#fff9f0',flexDirection:'column',gap:16,padding:24}}>
      <div style={{fontSize:56}}>🎉</div>
      <div style={{fontSize:20,fontWeight:700,color:'#333',textAlign:'center'}}>회원가입이 완료됐습니다!</div>
      <div style={{fontSize:14,color:'#666',textAlign:'center',lineHeight:1.8}}>
        <strong>{storeProfile.department} {storeProfile.branch}</strong><br/>
        담당: <strong>{selMember?.display_name || selMember?.name}</strong>
      </div>
      {smsConsent && (
        <div style={{background:'#fff3e0',border:'1px solid #ffcc80',borderRadius:10,padding:'10px 18px',fontSize:12,color:'#6d4c41',textAlign:'center'}}>
          📱 마케팅·정보 수신에 동의해주셔서 감사합니다
        </div>
      )}
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#fff9f0',display:'flex',alignItems:'center',justifyContent:'center',padding:20,overflowX:'hidden'}}>
      <div style={{width:'100%',maxWidth:420,background:'#fff',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.10)',overflow:'hidden',boxSizing:'border-box'}}>
        <div style={{background:'var(--sidebar)',padding:'28px 28px 20px',textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:8}}>🏬</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--sidebar-text)'}}>(주)한국생활건강</div>
          <div style={{fontSize:14,fontWeight:600,color:'rgba(0,0,0,0.6)',marginTop:4}}>회원 가입</div>
          <div style={{fontSize:11,color:'rgba(0,0,0,0.4)',marginTop:6}}>
            가입 매장: {storeProfile.department} · {storeProfile.branch}
          </div>
        </div>

        <div style={{padding:'28px 24px 32px', overflowX:'hidden'}}>
          <form onSubmit={handleSubmit}>
            {members.length > 1 && !presetMemberName && (
              <div style={{marginBottom:20}}>
                <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>
                  담당 매니저 선택 <span style={{color:'#e53935',fontWeight:400,fontSize:12}}>*필수</span>
                </label>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  {members.map(m => (
                    <button key={m.name} type="button"
                      onClick={() => setSelMember(selMember?.name===m.name ? null : m)}
                      style={{height:52, border:'2px solid', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer',
                        borderColor: selMember?.name===m.name ? 'var(--accent)' : '#e0e0e0',
                        background: selMember?.name===m.name ? '#fff8e1' : '#fafafa',
                        color: selMember?.name===m.name ? 'var(--accent)' : '#555'}}>
                      {m.display_name || m.name}
                      <div style={{fontSize:11, fontWeight:400, marginTop:2, color: selMember?.name===m.name ? 'var(--accent)' : '#999'}}>{m.job_title}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selMember && (
              <div style={{background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:8, padding:'8px 12px', marginBottom:16, fontSize:13, color:'#2e7d32', fontWeight:600}}>
                ✅ 담당: {selMember.display_name || selMember.name} ({selMember.job_title})
              </div>
            )}
            <div style={{marginBottom:18}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>이름</label>
              <input value={name} onChange={e => setName(e.target.value)}
                style={{width:'100%',height:50,padding:'0 16px',border:'1.5px solid #e0e0e0',borderRadius:10,fontSize:16,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                placeholder="홍길동" required />
            </div>
            <div style={{marginBottom:18}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>연락처</label>
              <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                style={{width:'100%',height:50,padding:'0 16px',border:'1.5px solid #e0e0e0',borderRadius:10,fontSize:16,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                placeholder="010-0000-0000" inputMode="numeric" required />
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>
                생일 <span style={{fontSize:11,fontWeight:400,color:'#999'}}>(선택 — 생일 혜택 제공용)</span>
              </label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                style={{width:'100%',maxWidth:'100%',height:50,padding:'0 40px 0 12px',border:'1.5px solid #e0e0e0',borderRadius:10,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box',color: birthday ? '#222' : '#aaa',display:'block',WebkitAppearance:'none',appearance:'none'}}/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:13,fontWeight:700,color:'#444',marginBottom:8}}>
                성별 <span style={{fontSize:11,fontWeight:400,color:'#999'}}>(선택)</span>
              </label>
              <div style={{display:'flex', gap:10}}>
                {['여성','남성'].map(g => (
                  <button key={g} type="button" onClick={() => setGender(gender===g ? '' : g)}
                    style={{flex:1, height:50, border:`1.5px solid ${gender===g?'var(--accent)':'#e0e0e0'}`,
                      borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer',
                      background: gender===g ? '#fff8e1' : '#fafafa',
                      color: gender===g ? 'var(--accent)' : '#888'}}>
                    {g === '여성' ? '👩 여성' : '👨 남성'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{background: smsConsent?'#fff8e1':'#f8f9fa', border:`1.5px solid ${smsConsent?'var(--accent)':'#e0e0e0'}`, borderRadius:12, padding:'16px', marginBottom:24, transition:'all 150ms'}}>
              <label style={{display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer'}}>
                <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)}
                  style={{width:20,height:20,marginTop:2,accentColor:'var(--accent)',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color: smsConsent?'var(--accent)':'#555',marginBottom:6}}>
                    마케팅·정보 수신 동의 <span style={{fontSize:11,fontWeight:400,color:'#999'}}>(선택)</span>
                  </div>
                  <div style={{fontSize:12,color:'#666',lineHeight:1.8}}>
                    (주)한국생활건강으로부터 회원 전용 혜택, 할인·이벤트·프로모션·신상품 안내 등 유용한 정보를 문자메시지(SMS/MMS), 카카오톡 등을 통해 수신하는 것에 동의합니다.
                  </div>
                  <div style={{marginTop:8,fontSize:11,color:'#aaa',lineHeight:1.7}}>
                    · 동의하지 않으셔도 서비스 이용에 불이익이 없습니다.<br/>
                    · 동의 후에도 언제든지 철회하실 수 있습니다.
                  </div>
                </div>
              </label>
            </div>

            <button type="submit" disabled={saving}
              style={{width:'100%',height:52,background:'var(--accent)',color:'#fff',border:'none',borderRadius:12,fontSize:16,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {saving ? <span className="spinner"/> : '✓ 회원 등록 완료'}
            </button>
          </form>
          <div style={{marginTop:14,fontSize:11,color:'#bbb',textAlign:'center',lineHeight:1.7}}>
            {selMember ? `담당: ${selMember.display_name || selMember.name}` : ''}<br/>
            입력하신 정보는 회원 관리 목적으로만 사용됩니다
          </div>
        </div>
      </div>
    </div>
  );
}
