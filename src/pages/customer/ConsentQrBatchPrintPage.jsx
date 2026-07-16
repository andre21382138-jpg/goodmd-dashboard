import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// 마케팅 수신 재동의 QR 일괄 인쇄 — 본사(admin/담당자) 전용
//  재동의 QR(?rc=1)은 매장 공통이지만, 매장명을 넣어 A4 한 장당 한 매장씩 출력한다.
export default function ConsentQrBatchPrintPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    supabase.from('profiles')
      .select('id, department, branch, job_title, approved')
      .eq('approved', true).eq('job_title', '매니저')
      .order('department').order('branch')
      .then(({ data }) => {
        const map = new Map(); // 점포|지점 단위 1개
        for (const p of (data || [])) {
          if (!p.department || !p.branch) continue;
          const key = `${p.department}|${p.branch}`;
          if (!map.has(key)) map.set(key, p);
        }
        const list = [...map.values()];
        setStores(list);
        setSelected(new Set(list.map(s => s.id)));
        setLoading(false);
      });
  }, []);

  const rcUrl = `${window.location.origin}?rc=1`; // 재동의는 매장 공통 URL
  const qrImg = (size = 300) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(rcUrl)}&margin=10`;

  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = stores.length > 0 && stores.every(s => selected.has(s.id));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(stores.map(s => s.id)));

  const printSelected = () => {
    const targets = stores.filter(s => selected.has(s.id));
    if (targets.length === 0) return;
    const img = qrImg(700);
    const pages = targets.map(s => `
      <div class="page">
        <div class="qr-title">🔁 마케팅 정보 수신 재동의</div>
        <div class="qr-store">${s.department} ${s.branch}</div>
        <img src="${img}" />
        <div class="qr-guide">📱 QR을 휴대폰으로 스캔하세요</div>
        <ol class="qr-steps">
          <li>QR 스캔 → 가입한 <b>휴대폰 번호 입력</b></li>
          <li>본인 정보 확인 후 <b>[재동의]</b> 터치</li>
        </ol>
        <div class="qr-note">※ 마케팅 수신동의가 만료·미동의된 회원은 재동의 후 다시 혜택·이벤트 안내를 받으실 수 있습니다.</div>
        <div class="qr-url">${rcUrl}</div>
      </div>`).join('');
    const w = window.open('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>매장 재동의 QR 인쇄 (${targets.length})</title>
      <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: 'Malgun Gothic', sans-serif; margin:0; }
        .toolbar { position:sticky; top:0; background:#fff8f0; border-bottom:1px solid #ffcc80;
          padding:10px 16px; display:flex; align-items:center; gap:12px; z-index:10; }
        .toolbar button { height:36px; padding:0 18px; border:none; border-radius:6px; background:#E65100;
          color:#fff; font-size:14px; font-weight:700; cursor:pointer; }
        .toolbar span { font-size:13px; color:#6d4c41; }
        /* 매장 1개 = A4 1페이지 (A4 = 210 x 297mm) */
        .page { box-sizing:border-box; width:100%; min-height:265mm;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          text-align:center; page-break-after:always; }
        .page:last-child { page-break-after:auto; }
        .qr-title { font-size:22px; font-weight:800; color:#6a1b9a; margin-bottom:6px; }
        .qr-store { font-size:30px; font-weight:800; margin-bottom:20px; }
        .page img { width:110mm; height:110mm; }
        .qr-guide { font-size:20px; font-weight:700; color:#2e7d32; margin-top:18px; }
        .qr-steps { text-align:left; font-size:16px; line-height:2; margin:14px auto 0; max-width:130mm; }
        .qr-note { font-size:12px; color:#888; margin-top:18px; max-width:130mm; line-height:1.6; }
        .qr-url { font-size:9px; color:#bbb; word-break:break-all; margin-top:10px; }
        @media screen { .page { border-bottom:2px dashed #ddd; } }
        @media print { .toolbar { display:none !important; } }
      </style></head>
      <body>
        <div class="toolbar">
          <button onclick="window.print()">🖨️ 인쇄하기</button>
          <span id="st">QR 이미지 불러오는 중…</span>
        </div>
        ${pages}
      <script>
        window.onload = function(){
          var imgs = Array.prototype.slice.call(document.images), n = 0;
          var st = document.getElementById('st');
          function done(){ if(++n >= imgs.length){ if(st) st.textContent = '준비 완료 — [인쇄하기] 또는 Ctrl+P'; setTimeout(function(){ window.print(); }, 300); } }
          if(imgs.length === 0){ window.print(); return; }
          imgs.forEach(function(im){ if(im.complete) done(); else { im.onload = done; im.onerror = done; } });
        };
      <\/script>
      </body></html>`);
  };

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div className="card-label" style={{ margin:0 }}>🔁 재동의 QR 일괄 인쇄</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>
              매장별 <b>마케팅 수신 재동의</b> QR을 A4 한 장에 한 매장씩 인쇄합니다. 출력해 각 매장 카운터에 비치하세요.
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="fresult">전체 <b>{stores.length}</b>개 · 선택 <b style={{ color:'var(--accent)' }}>{selected.size}</b></span>
            <button className="btn btn-s" onClick={toggleAll}>{allOn ? '✕ 전체 해제' : '☑ 전체 선택'}</button>
            <button className="btn btn-p" onClick={printSelected} disabled={selected.size === 0}>
              🖨️ 선택 {selected.size}개 인쇄
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding:'16px 20px' }}>
        {loading ? <div className="empty"><span className="spinner"/></div>
        : stores.length === 0 ? <div className="empty">승인된 매장(매니저) 계정이 없습니다</div>
        : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:14 }}>
            {stores.map(s => {
              const on = selected.has(s.id);
              return (
                <div key={s.id} onClick={() => toggle(s.id)}
                  style={{ border:`2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, borderRadius:'var(--radius)',
                    padding:'14px 12px', textAlign:'center', cursor:'pointer', background: on ? '#fff8f0' : '#fff' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center', marginBottom:8 }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(s.id)} onClick={e => e.stopPropagation()} style={{ cursor:'pointer' }}/>
                    <span style={{ fontSize:13, fontWeight:700 }}>{s.department} {s.branch}</span>
                  </div>
                  <img src={qrImg(200)} alt="재동의 QR" style={{ width:150, height:150, border:'1px solid var(--border)', borderRadius:6 }}/>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
