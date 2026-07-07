import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

// 매장 → 회원관리 → 수신 재동의 (매니저)
//  1) 카운터 비치용 재동의 QR (회원이 본인 폰으로 스캔 → 셀프 재동의)
//  2) 스마트폰 없는 회원용 대면 처리 (회원 검색 → 상태 확인 → [재동의])
export default function ConsentRenewMgrPage() {
  const rcUrl = `${window.location.origin}?rc=1`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(rcUrl)}`;

  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const hyphenate = (digits) => {
    const d = String(digits || '').replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return d.startsWith('02') ? `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}` : `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
    return d;
  };

  const consentStatus = (c) => {
    if (!c.sms_consent) return { label: '미동의', color: '#757575', can: true };
    if (!c.sms_consent_at) return { label: '유효', color: '#2e7d32', can: true };
    const exp = new Date(c.sms_consent_at); exp.setFullYear(exp.getFullYear() + 1);
    const expStr = exp.toISOString().slice(0, 10);
    return exp >= new Date()
      ? { label: `유효 (만료 ${expStr})`, color: '#2e7d32', can: true }
      : { label: `만료 (${expStr})`, color: '#c62828', can: true };
  };

  const search = async () => {
    const term = q.trim();
    if (!term) { toast('이름 또는 휴대폰 번호를 입력해주세요', 'err'); return; }
    setLoading(true); setSearched(true);
    const digits = term.replace(/\D/g, '');
    const filters = [`name.ilike.%${term}%`, `phone.ilike.%${term}%`];
    if (digits.length >= 4) filters.push(`phone.ilike.%${hyphenate(digits)}%`, `phone.ilike.%${digits}%`);
    const { data, error } = await supabase.from('customers')
      .select('id, name, phone, sms_consent, sms_consent_at, store_name, branch_name')
      .or(filters.join(','))
      .limit(40);
    if (error) toast(error.message, 'err');
    setRows(data || []);
    setLoading(false);
  };

  const renew = async (c) => {
    if (!window.confirm(`${c.name} (${c.phone})\n마케팅 수신 재동의를 처리하시겠습니까?`)) return;
    setSavingId(c.id);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from('customers')
      .update({ sms_consent: true, sms_consent_at: nowIso, sms_unsubscribed_at: null })
      .eq('id', c.id).select('id');
    setSavingId(null);
    if (error) { toast(error.message, 'err'); return; }
    // 동의 증빙 로그 (대면 처리)
    try {
      await supabase.from('consent_logs').insert({
        customer_id: c.id, phone: c.phone, consent_type: 'marketing',
        action: 'manual', channel: 'store',
        consent_text: '매장 대면 확인 후 마케팅 정보 수신 재동의',
      });
    } catch (_) { /* 로그 실패 무시 */ }
    toast(`${c.name}님 재동의 완료`, 'ok');
    setRows(prev => prev.map(r => r.id === c.id ? { ...r, sms_consent: true, sms_consent_at: nowIso } : r));
  };

  return (
    <div>
      {/* 안내 QR */}
      <div className="card" style={{ padding:'20px 24px', marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>🔁 마케팅 수신 재동의</div>
        <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.7, marginBottom:16 }}>
          만료·미동의 회원이 매장 방문 시, 아래 <b>QR을 본인 휴대폰으로 스캔</b>해서 직접 재동의할 수 있습니다.<br/>
          이 QR을 <b>인쇄해 카운터에 비치</b>하세요. (회원 본인 동의 + 시각이 기록되어 증빙이 됩니다)
        </div>
        <div style={{ display:'flex', gap:24, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <img src={qrSrc} alt="재동의 QR" width={220} height={220}
              style={{ border:'1px solid var(--border)', borderRadius:12, background:'#fff' }}/>
            <div style={{ marginTop:8 }}>
              <button className="btn btn-s" onClick={() => window.print()}>🖨️ 인쇄</button>
            </div>
          </div>
          <div style={{ flex:1, minWidth:220 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>회원 안내 순서</div>
            <ol style={{ fontSize:13, color:'var(--text2)', lineHeight:1.9, paddingLeft:18, margin:0 }}>
              <li>QR을 휴대폰 카메라로 스캔</li>
              <li>가입한 <b>휴대폰 번호 입력</b></li>
              <li>본인 정보 확인 후 <b>[재동의]</b> 터치</li>
            </ol>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:12, wordBreak:'break-all' }}>
              링크: {rcUrl}
            </div>
          </div>
        </div>
      </div>

      {/* 대면 처리 (스마트폰 없는 회원용) */}
      <div className="card" style={{ padding:'20px 24px' }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>대면 처리</div>
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12 }}>
          스마트폰이 없는 회원은, 구두 동의 확인 후 직접 검색해 처리하세요.
        </div>
        <div className="fbar" style={{ gap:8, marginBottom:12 }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="이름 또는 휴대폰 번호" style={{ height:38, padding:'0 12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, outline:'none', width:260 }} />
          <button className="btn btn-p" onClick={search} disabled={loading}>
            {loading ? <span className="spinner"/> : '🔍 검색'}
          </button>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
        : !searched ? <div className="empty">회원을 검색하세요</div>
        : rows.length === 0 ? <div className="empty">검색 결과가 없습니다</div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr><th>이름</th><th>휴대폰</th><th>가입매장</th><th>수신 상태</th><th style={{ textAlign:'center' }}>처리</th></tr>
              </thead>
              <tbody>
                {rows.map(c => {
                  const st = consentStatus(c);
                  const isValid = c.sms_consent && c.sms_consent_at && (() => { const e = new Date(c.sms_consent_at); e.setFullYear(e.getFullYear()+1); return e >= new Date(); })();
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight:600 }}>{c.name}</td>
                      <td className="mono" style={{ fontSize:12 }}>{c.phone}</td>
                      <td style={{ fontSize:11, color:'var(--text3)' }}>{c.store_name} {c.branch_name}</td>
                      <td><span style={{ fontSize:12, fontWeight:700, color: st.color }}>{st.label}</span></td>
                      <td style={{ textAlign:'center' }}>
                        <button
                          onClick={() => renew(c)} disabled={savingId === c.id}
                          style={{ height:30, padding:'0 12px', border:`1px solid ${isValid ? 'var(--border)' : '#2e7d32'}`, borderRadius:'var(--radius)', background: isValid ? '#fff' : '#e8f5e9', color: isValid ? 'var(--text2)' : '#2e7d32', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                          {savingId === c.id ? '처리중' : isValid ? '갱신' : '✅ 재동의'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
