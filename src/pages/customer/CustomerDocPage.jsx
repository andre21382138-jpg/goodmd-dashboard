import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, formatPhone } from '../../lib/utils';

export default function CustomerDocPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [joinedAt,    setJoinedAt]    = useState(today);
  const [custName,    setCustName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [birthday,    setBirthday]    = useState('');
  const [gender,      setGender]      = useState('');
  const [smsConsent,  setSmsConsent]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [recentList,  setRecent]      = useState([]);
  const [members,     setMembers]     = useState([]);
  const [selMember,   setSelMember]   = useState(null);

  useEffect(() => {
    supabase.from('store_members').select('name, display_name, job_title')
      .eq('store_account_id', profile.id).order('is_primary', { ascending: false })
      .then(({ data }) => { setMembers(data || []); if (data?.length === 1) setSelMember(data[0]); });
  }, [profile.id]);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase.from('customers')
      .select('*').eq('created_by', profile.id)
      .order('created_at', { ascending: false }).limit(20);
    setRecent(data || []);
  }, [profile.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selMember) { toast('담당 근무자를 선택해주세요', 'err'); return; }
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) { toast('연락처를 올바르게 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('customers').insert({
      joined_at: joinedAt, name: custName.trim(), phone,
      birthday: birthday || null, gender: gender || null,
      store_name: profile.department, branch_name: profile.branch,
      manager_name: selMember.name,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      created_by: profile.id,
    });
    if (error) { toast('저장 실패: ' + error.message, 'err'); }
    else { toast('회원 등록 완료', 'ok'); setCustName(''); setPhone(''); setBirthday(''); setGender(''); setSmsConsent(false); fetchRecent(); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 고객 정보를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('삭제 완료', 'inf'); fetchRecent(); }
  };

  const inputStyle = { width:'100%', height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', background:'#fff', fontSize:13, fontFamily:'var(--sans)', outline:'none' };
  const labelStyle = { display:'block', fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:5 };

  return (
    <div>
      {/* 근무자 선택 */}
      {members.length > 1 && (
        <div className="card" style={{padding:'14px 18px', marginBottom:0}}>
          <div style={{fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:10}}>담당 근무자 선택 <span style={{color:'var(--danger)', fontSize:12}}>*필수</span></div>
          <div style={{display:'flex', gap:8}}>
            {members.map(m => (
              <button key={m.name} type="button" onClick={() => setSelMember(selMember?.name===m.name ? null : m)}
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
      <div className="card">
        <div style={{background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:16, fontSize:12, color:'#6d4c41', lineHeight:1.8}}>
          ⚠️ 고객으로부터 <strong>서면 동의서를 수령한 후</strong> 등록하세요.<br/>
          마케팅 수신동의는 서류에 고객이 직접 서명한 경우에만 체크하세요.
        </div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}{selMember ? ` · ${selMember.display_name || selMember.name}` : ''}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>회원가입일</label>
              <input type="date" value={joinedAt} onChange={e => setJoinedAt(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>고객 이름</label>
              <input value={custName} onChange={e => setCustName(e.target.value)} style={inputStyle} placeholder="홍길동" required />
            </div>
            <div>
              <label style={labelStyle}>연락처</label>
              <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} style={inputStyle} placeholder="010-0000-0000" required />
            </div>
            <div>
              <label style={labelStyle}>생일 <span style={{color:'var(--text3)', fontWeight:400}}>(선택)</span></label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>성별 <span style={{color:'var(--text3)', fontWeight:400}}>(선택)</span></label>
              <select value={gender} onChange={e => setGender(e.target.value)} style={inputStyle}>
                <option value="">선택 안함</option>
                <option value="여성">여성</option>
                <option value="남성">남성</option>
              </select>
            </div>
          </div>

          {/* 마케팅 수신동의 */}
          <div style={{ background: smsConsent ? '#e8f5e9' : '#f8f8f8', border:`1px solid ${smsConsent ? '#a5d6a7' : 'var(--border)'}`, borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:16 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)}
                style={{ width:18, height:18, accentColor:'var(--success)', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color: smsConsent ? 'var(--success)' : 'var(--text)' }}>
                  📱 마케팅·정보 수신 동의
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, lineHeight:1.7 }}>
                  (주)한국생활건강으로부터 회원 전용 혜택, 할인·이벤트·프로모션·신상품 안내 등 유용한 정보를 문자메시지(SMS/MMS), 카카오톡 등을 통해 수신하는 것에 동의합니다.<br/>
                  · 동의하지 않으셔도 서비스 이용에 불이익이 없습니다.<br/>
                  · 동의 후에도 언제든지 철회하실 수 있습니다.
                </div>
              </div>
            </label>
          </div>

          <button className="btn btn-p" type="submit" disabled={saving} style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> : '✓ 서류 가입 등록'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-label">최근 등록 (20건)</div>
        <div className="twrap">
          <table>
            <thead>
              <tr><th>가입일</th><th>이름</th><th>연락처</th><th>생일</th><th>담당매니저</th><th style={{textAlign:'center'}}>수신동의</th><th>등록일시</th><th></th></tr>
            </thead>
            <tbody>
              {recentList.length === 0
                ? <tr><td colSpan={8} className="empty">등록된 회원이 없습니다</td></tr>
                : recentList.map(c => (
                  <tr key={c.id}>
                    <td className="mono">{c.joined_at}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="mono">{c.phone}</td>
                    <td className="mono" style={{fontSize:11}}>{c.birthday || '-'}</td>
                    <td style={{color:'var(--accent)', fontWeight:600}}>{c.manager_name || '-'}</td>
                    <td style={{textAlign:'center'}}>
                      {c.sms_consent
                        ? <span style={{color:'var(--success)', fontWeight:700, fontSize:12}}>✅ 동의</span>
                        : <span style={{color:'var(--text3)', fontSize:12}}>미동의</span>}
                    </td>
                    <td className="mono" style={{fontSize:11, color:'var(--text2)'}}>{new Date(c.created_at).toLocaleString('ko-KR')}</td>
                    <td><button className="btn-danger" onClick={() => handleDelete(c.id)}>삭제</button></td>
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
