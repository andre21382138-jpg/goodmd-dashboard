import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// 헤더 우측 네비게이션 — 사용자 관리(admin·HQ) / 공지 사항(admin·HQ·매니저)
// 사이드바 하단의 관리자·공지 섹션을 상단으로 이동한 것.
export default function HeaderNav({ profile, page, setPage, isAdmin, isHQ, isManager }) {
  const canUserMgmt = isAdmin || isHQ;
  const canNotice   = isAdmin || isHQ || isManager;
  const [hasNewNotice, setHasNewNotice] = useState(false);

  useEffect(() => {
    if (!profile?.id || !canNotice) return;
    const storageKey = `notice_last_read_${profile.id}`;
    supabase.from('notices').select('created_at').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const latestAt = data[0].created_at;
        const lastRead = localStorage.getItem(storageKey);
        setHasNewNotice(!lastRead || latestAt > lastRead);
      });
  }, [profile?.id, canNotice]);

  const openNotice = () => {
    localStorage.setItem(`notice_last_read_${profile?.id}`, new Date().toISOString());
    setHasNewNotice(false);
    setPage('notice');
  };

  const pill = (active) => ({
    position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
    border: active ? '1px solid #c7cbf7' : '1px solid var(--border2)',
    background: active ? '#eef0fe' : '#fff',
    color: active ? 'var(--accent)' : 'var(--text2)',
    fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, transition: 'all 120ms',
  });

  if (!canUserMgmt && !canNotice) return null;

  return (
    <>
      {canUserMgmt && (
        <button type="button" onClick={() => setPage('admin')} style={pill(page === 'admin')}
          onMouseEnter={e => { if (page !== 'admin') e.currentTarget.style.background = 'var(--bg3)'; }}
          onMouseLeave={e => { if (page !== 'admin') e.currentTarget.style.background = '#fff'; }}>
          <span style={{ fontSize: 14 }}>🔐</span> 사용자 관리
        </button>
      )}
      {canNotice && (
        <button type="button" onClick={openNotice} style={pill(page === 'notice')}
          onMouseEnter={e => { if (page !== 'notice') e.currentTarget.style.background = 'var(--bg3)'; }}
          onMouseLeave={e => { if (page !== 'notice') e.currentTarget.style.background = '#fff'; }}>
          <span style={{ fontSize: 14 }}>📢</span> 공지사항
          {hasNewNotice && (
            <span style={{ position: 'absolute', top: 5, right: 7, width: 7, height: 7, borderRadius: '50%', background: '#e53935', boxShadow: '0 0 0 2px #fff' }}/>
          )}
        </button>
      )}
    </>
  );
}
