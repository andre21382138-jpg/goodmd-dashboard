import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, formatPhone } from '../../lib/utils';

export default function CustomerInputPage({ profile }) {
  const today = new Date().toISOString().slice(0, 10);
  const [joinedAt,    setJoinedAt]    = useState(today);
  const [custName,    setCustName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [birthday,    setBirthday]    = useState('');
  const [managerName, setManagerName] = useState('');
  const [smsConsent,  setSmsConsent]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [recentList,  setRecent]      = useState([]);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase.from('customers')
      .select('*').eq('created_by', profile.id)
      .order('created_at', { ascending: false }).limit(20);
    setRecent(data || []);
  }, [profile.id]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) { toast('연락처를 올바르게 입력해주세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('customers').insert({
      joined_at: joinedAt,
      name: custName.trim(),
      phone: phone,
      birthday: birthday || null,
      store_name: profile.department,
      branch_name: profile.branch,
      manager_name: managerName.trim() || null,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      created_by: profile.id,
    });
    if (error) { toast('저장 실패: ' + error.message, 'err'); }
    else { toast('회원 등록 완료', 'ok'); setCustName(''); setPhone(''); setBirthday(''); setManagerName(''); setSmsConsent(false); fetchRecent(); }
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
      <div className="card">
        <div className="card-label">회원 등록</div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:16, fontFamily:'var(--mono)' }}>
          📍 {profile.department} · {profile.branch}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:14, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>회원가입일</label>
              <input type="date" value={joinedAt} onChange={e => setJoinedAt(e.target.value)}
                style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>고객 이름</label>
              <input value={custName} onChange={e => setCustName(e.target.value)}
                style={inputStyle} placeholder="홍길동" required />
            </div>
            <div>
              <label style={labelStyle}>연락처</label>
              <input value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                style={inputStyle} placeholder="010-0000-0000" required />
            </div>
            <div>
              <label style={labelStyle}>담당 매니저 이름</label>
              <input value={managerName} onChange={e => setManagerName(e.target.value)}
                style={inputStyle} placeholder="매니저 이름 입력" />
            </div>
            <div>
              <label style={labelStyle}>생일 <span style={{color:'var(--text3)',fontWeight:400}}>(선택)</span></label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                style={inputStyle} />
            </div>
          </div>

          {/* SMS 수신동의 */}
          <div style={{ background:'#f8f9fa', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:10 }}>📱 광고성 문자 수신 동의</div>
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)}
                style={{ width:17, height:17, marginTop:2, accentColor:'var(--accent)', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:600, color: smsConsent ? 'var(--accent)' : 'var(--text2)' }}>
                  광고성 정보 문자 수신에 동의합니다 (선택)
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, lineHeight:1.6 }}>
                  이벤트, 프로모션, 신상품 안내 등 마케팅 목적의 문자메시지 수신에 동의합니다.<br/>
                  동의 철회는 매장 담당자에게 요청하실 수 있습니다.
                </div>
              </div>
            </label>
            {smsConsent && (
              <div style={{ marginTop:10, background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#6d4c41' }}>
                ✅ 수신동의 일시가 자동으로 기록됩니다 ({new Date().toLocaleDateString('ko-KR')})
              </div>
            )}
          </div>

          <button className="btn btn-p" type="submit" disabled={saving} style={{ width:'100%', justifyContent:'center', height:40 }}>
            {saving ? <span className="spinner"/> : '✓ 회원 정보 저장'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-label">최근 입력 고객 (20건)</div>
        <div className="twrap">
          <table>
            <thead>
              <tr><th>가입일</th><th>이름</th><th>연락처</th><th>생일</th><th>담당 매니저</th><th>SMS동의</th><th>입력일시</th><th></th></tr>
            </thead>
            <tbody>
              {recentList.length === 0
                ? <tr><td colSpan={7} className="empty">입력된 고객이 없습니다</td></tr>
                : recentList.map(c => (
                  <tr key={c.id}>
                    <td className="mono">{c.joined_at}</td>
                    <td><strong>{c.name}</strong></td>
                    <td className="mono">{c.phone}</td>
                    <td className="mono" style={{fontSize:11}}>{c.birthday || '-'}</td>
                    <td style={{fontSize:12,color:'var(--accent)',fontWeight:600}}>{c.manager_name || '-'}</td>
                    <td>
                      {c.sms_consent
                        ? <span style={{color:'var(--success)', fontWeight:600, fontSize:12}}>✅ 동의</span>
                        : <span style={{color:'var(--text3)', fontSize:12}}>미동의</span>
                      }
                    </td>
                    <td className="mono" style={{fontSize:11,color:'var(--text2)'}}>{new Date(c.created_at).toLocaleString('ko-KR')}</td>
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
