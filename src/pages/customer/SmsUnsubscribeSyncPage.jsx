import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

// 문자나라 엑셀(.xls; 실제 HTML 테이블)에서 전화번호 + 등록일시 추출
function parseMunjanaraXls(text) {
  // HTML 테이블 파싱 — DOMParser 사용
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const rows = doc.querySelectorAll('tr');
  const out = [];
  rows.forEach((tr, idx) => {
    if (idx === 0) return; // 헤더 스킵
    const tds = tr.querySelectorAll('td');
    if (tds.length < 4) return;
    const registeredAt = (tds[1]?.textContent || '').trim();
    const phone = (tds[2]?.textContent || '').replace(/\D/g, '');
    if (phone.length >= 10) {
      out.push({ phone, registeredAt });
    }
  });
  return out;
}

export default function SmsUnsubscribeSyncPage() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(null);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setParsed(null); setDone(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        let text;
        if (f.name.endsWith('.xls') || f.name.endsWith('.html') || f.name.endsWith('.htm')) {
          // 문자나라 xls는 EUC-KR 인코딩된 HTML
          const buf = reader.result;
          const decoder = new TextDecoder('euc-kr');
          text = decoder.decode(buf);
        } else {
          text = String(reader.result || '');
        }
        const entries = parseMunjanaraXls(text);
        if (entries.length === 0) {
          toast('파싱된 전화번호가 없습니다. 파일 형식 확인 필요', 'err');
          return;
        }
        // DB 매칭 — 전화번호 기준
        const phones = entries.map(e => e.phone);
        const { data: customers } = await supabase.from('customers')
          .select('id, name, phone, sms_consent')
          .in('phone', phones);
        const custMap = new Map();
        for (const c of (customers || [])) {
          custMap.set(String(c.phone || '').replace(/\D/g, ''), c);
        }
        const matched = [];
        const unmatched = [];
        for (const e of entries) {
          const c = custMap.get(e.phone);
          if (c) matched.push({ ...e, customer: c });
          else unmatched.push(e);
        }
        setParsed({ entries, matched, unmatched });
      } catch (e) {
        toast('파일 파싱 실패: ' + (e.message || e), 'err');
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleApply = async () => {
    if (!parsed || parsed.matched.length === 0) return;
    if (!window.confirm(`${parsed.matched.length}명을 수신거부 처리합니다.\n진행하시겠습니까?`)) return;
    setApplying(true);
    try {
      const targets = parsed.matched.filter(m => m.customer.sms_consent !== false);
      let processed = 0;
      for (const m of targets) {
        const unsubAt = m.registeredAt
          ? new Date(m.registeredAt.replace(' ', 'T')).toISOString()
          : new Date().toISOString();
        const { error } = await supabase.from('customers')
          .update({
            sms_consent: false,
            sms_unsubscribed_at: unsubAt,
          })
          .eq('id', m.customer.id);
        if (!error) processed++;
      }
      setDone({ processed, total: parsed.matched.length, alreadyBlocked: parsed.matched.length - targets.length });
      toast(`${processed}명 수신거부 처리 완료`, 'ok');
    } catch (e) {
      toast('처리 실패: ' + (e.message || e), 'err');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <div className="card" style={{padding:'20px 24px', marginBottom:16}}>
        <div style={{fontSize:18, fontWeight:700, marginBottom:8}}>📥 문자나라 수신거부 명단 동기화</div>
        <div style={{fontSize:12, color:'var(--text2)', lineHeight:1.7}}>
          문자나라 대시보드 → 수신거부관리 → 엑셀 다운로드 받은 파일(.xls)을 업로드하세요.<br/>
          전화번호 기준으로 회원과 매칭하여 일괄 거부 처리됩니다.
        </div>
      </div>

      <div className="card" style={{padding:'20px 24px', marginBottom:16}}>
        <label style={{display:'block', cursor:'pointer'}}>
          <input type="file" accept=".xls,.html,.htm"
            style={{display:'none'}}
            onChange={e => handleFile(e.target.files?.[0])}/>
          <div style={{padding:'40px 20px', border:'2px dashed var(--border)', borderRadius:8, textAlign:'center',
            background: file ? '#fff8e1' : '#fafafa'}}>
            {file ? (
              <>
                <div style={{fontSize:32, marginBottom:8}}>📄</div>
                <div style={{fontSize:14, fontWeight:600}}>{file.name}</div>
                <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>다른 파일 선택하려면 클릭</div>
              </>
            ) : (
              <>
                <div style={{fontSize:32, marginBottom:8}}>📤</div>
                <div style={{fontSize:14, fontWeight:600}}>파일 선택 또는 드래그</div>
                <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>.xls (문자나라 엑셀 형식)</div>
              </>
            )}
          </div>
        </label>
      </div>

      {parsed && (
        <div className="card" style={{padding:'20px 24px', marginBottom:16}}>
          <div style={{fontSize:14, fontWeight:700, marginBottom:12}}>📊 미리보기</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16}}>
            <div style={{padding:'14px 18px', border:'1px solid var(--border)', borderRadius:6}}>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:6}}>총 거부자 수</div>
              <div style={{fontSize:22, fontWeight:700}}>{parsed.entries.length}</div>
            </div>
            <div style={{padding:'14px 18px', border:'1px solid #a5d6a7', background:'#e8f5e9', borderRadius:6}}>
              <div style={{fontSize:11, color:'#2e7d32', marginBottom:6}}>회원 매칭</div>
              <div style={{fontSize:22, fontWeight:700, color:'#2e7d32'}}>{parsed.matched.length}</div>
            </div>
            <div style={{padding:'14px 18px', border:'1px solid var(--border)', background:'#fafafa', borderRadius:6}}>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:6}}>비회원</div>
              <div style={{fontSize:22, fontWeight:700, color:'var(--text3)'}}>{parsed.unmatched.length}</div>
            </div>
          </div>
          {parsed.matched.length > 0 && (
            <button className="btn-auth" onClick={handleApply} disabled={applying}
              style={{width:'auto', padding:'0 20px', height:38, marginTop:0}}>
              {applying ? '처리 중...' : `${parsed.matched.length}명 수신거부 처리`}
            </button>
          )}
        </div>
      )}

      {done && (
        <div className="card" style={{padding:'20px 24px', background:'#e8f5e9', border:'1px solid #a5d6a7'}}>
          <div style={{fontSize:14, fontWeight:700, color:'#2e7d32', marginBottom:8}}>✅ 처리 완료</div>
          <div style={{fontSize:12, color:'var(--text2)', lineHeight:1.7}}>
            · 처리된 회원: <b>{done.processed}명</b><br/>
            · 이미 거부 상태였던 회원: <b>{done.alreadyBlocked}명</b><br/>
            · 총 매칭: {done.total}명
          </div>
        </div>
      )}
    </div>
  );
}
