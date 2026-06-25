import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// 매장 QR 일괄 인쇄 — 본사(admin/담당자) 전용
// 승인된 매니저 계정을 매장(점포·지점) 단위로 1개씩 모아, 회원가입 QR을 한 번에 인쇄
export default function QrBatchPrintPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    supabase.from('profiles')
      .select('id, department, branch, name, job_title, approved')
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

  const origin = window.location.origin + window.location.pathname;
  const qrUrl = (id) => `${origin}?m=${id}`;
  const qrImg = (id, size = 300) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrUrl(id))}&margin=10`;

  const toggle = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const allOn = stores.length > 0 && stores.every(s => selected.has(s.id));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(stores.map(s => s.id)));

  const printSelected = () => {
    const targets = stores.filter(s => selected.has(s.id));
    if (targets.length === 0) return;
    const cards = targets.map(s => `
      <div class="qr-card">
        <div class="qr-store">${s.department} ${s.branch}</div>
        <div class="qr-sub">(주)한국생활건강 회원가입</div>
        <img src="${qrImg(s.id, 320)}" />
        <div class="qr-guide">📱 스캔 후 담당자 선택 → 가입</div>
        <div class="qr-url">${qrUrl(s.id)}</div>
      </div>`).join('');
    const w = window.open('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>매장 QR 일괄 인쇄 (${targets.length})</title>
      <style>
        @page { margin: 10mm; }
        body { font-family: 'Malgun Gothic', sans-serif; margin:0; }
        .grid { display:flex; flex-wrap:wrap; gap:6mm; }
        .qr-card { width:88mm; box-sizing:border-box; border:1px dashed #999; border-radius:6px;
          padding:7mm 4mm; text-align:center; page-break-inside:avoid; }
        .qr-store { font-size:17px; font-weight:800; margin-bottom:2mm; }
        .qr-sub { font-size:11px; color:#777; margin-bottom:4mm; }
        .qr-card img { width:58mm; height:58mm; }
        .qr-guide { font-size:12px; font-weight:700; color:#2e7d32; margin-top:3mm; }
        .qr-url { font-size:8px; color:#bbb; word-break:break-all; margin-top:2mm; }
      </style></head>
      <body><div class="grid">${cards}</div>
      <script>
        window.onload = function(){
          var imgs = Array.prototype.slice.call(document.images), n = 0;
          function done(){ if(++n >= imgs.length) setTimeout(function(){ window.print(); }, 300); }
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
            <div className="card-label" style={{ margin:0 }}>🖨️ 매장 QR 일괄 인쇄</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>
              매장(점포·지점)별 회원가입 QR을 한 번에 인쇄합니다. 출력 후 잘라서 각 매장에 배치하세요.
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
                  <img src={qrImg(s.id, 200)} alt="QR" style={{ width:150, height:150, border:'1px solid var(--border)', borderRadius:6 }}/>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
