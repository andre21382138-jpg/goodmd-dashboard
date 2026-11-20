import React, { useState } from 'react';

const item = (active) => ({
  display:'flex', alignItems:'center', gap:8, width:'100%', padding:'11px 16px',
  background: active ? 'var(--bg3)' : '#fff', border:'none', cursor:'pointer',
  fontSize:13, fontWeight:600, color:'var(--text)', textAlign:'left', fontFamily:'var(--sans)',
});

// 헤더 우측 사용자 메뉴 — 계정정보 / 사용 안내 / 로그아웃
export default function UserMenu({ profile, isAdmin, onLogout, setPage, page }) {
  const [open, setOpen] = useState(false);
  const initial = (profile?.name || profile?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display:'inline-flex', alignItems:'center', gap:8, height:36, padding:'0 10px 0 6px', borderRadius:999, border:'1px solid var(--border2)', background:'#fff', cursor:'pointer', fontFamily:'var(--sans)' }}>
        <span style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', display:'grid', placeItems:'center', fontSize:12, fontWeight:800 }}>{initial}</span>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.name || '사용자'}</span>
        <span style={{ fontSize:9, color:'var(--text3)' }}>▼</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:300 }}/>
          <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:301, background:'#fff', border:'1px solid var(--border2)', borderRadius:12, boxShadow:'0 10px 34px rgba(16,18,23,0.16)', width:240, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                {isAdmin && <span className="admin-badge">ADMIN</span>}
                <strong style={{ fontSize:14 }}>{profile?.name || '사용자'}</strong>
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', wordBreak:'break-all' }}>{profile?.email}</div>
            </div>
            <button type="button" onClick={() => { setPage('help'); setOpen(false); }}
              style={item(page === 'help')}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = page==='help' ? 'var(--bg3)' : '#fff'}>
              <span>❓</span> 사용 안내
            </button>
            <button type="button" onClick={() => { setOpen(false); onLogout(); }}
              style={{ ...item(false), color:'var(--danger)', borderTop:'1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background='#fdeaea'}
              onMouseLeave={e => e.currentTarget.style.background='#fff'}>
              <span>🚪</span> 로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  );
}
