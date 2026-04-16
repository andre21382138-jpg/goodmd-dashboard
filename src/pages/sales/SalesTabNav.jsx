import React from 'react';

export default function SalesTabNav({ current, setPage }) {
  const tabs = [
    { key:'sales_view',          label:'← 목록으로' },
    { key:'sales_list',          icon:'🏬', label:'매장 매출' },
    { key:'biz_sales_view',      icon:'🤝', label:'특판 매출' },
    { key:'lecture_sales_view',  icon:'🎓', label:'강좌 매출' },
  ];
  return (
    <div style={{display:'flex', gap:6, marginBottom:20, borderBottom:'2px solid var(--border)', paddingBottom:0}}>
      {tabs.map(t => {
        if (t.key === 'sales_view') {
          return (
            <button key={t.key} onClick={() => setPage('sales_view')}
              style={{height:36, padding:'0 14px', border:'none', background:'none', fontSize:12,
                color:'var(--text3)', cursor:'pointer', fontFamily:'var(--sans)', fontWeight:600,
                marginRight:8, borderBottom:'2px solid transparent', marginBottom:-2}}>
              {t.label}
            </button>
          );
        }
        const isActive = current === t.key;
        return (
          <button key={t.key} onClick={() => setPage(t.key)}
            style={{height:36, padding:'0 16px', border:'none', background:'none', fontSize:13,
              fontWeight: isActive ? 700 : 500, cursor:'pointer', fontFamily:'var(--sans)',
              color: isActive ? 'var(--accent)' : 'var(--text2)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, transition:'all 120ms'}}>
            {t.icon} {t.label}
          </button>
        );
      })}
    </div>
  );
}
