import React from 'react';

export default function SalesViewHub({ setPage }) {
  const items = [
    { key:'sales_list',      icon:'🏬', label:'매장 매출',  desc:'매장별 판매 내역 조회' },
    { key:'biz_sales_view',  icon:'🤝', label:'특판 매출',  desc:'B2B 특판 업체 매출 조회' },
    { key:'lecture_sales_view', icon:'🎓', label:'강좌 매출', desc:'강좌 진행 매출 조회' },
  ];
  return (
    <div style={{display:'flex', gap:16, flexWrap:'wrap', marginTop:8}}>
      {items.map(item => (
        <button key={item.key} onClick={() => setPage(item.key)}
          style={{flex:'1 1 200px', minWidth:200, background:'#fff', border:'2px solid var(--border)',
            borderRadius:16, padding:'28px 24px', cursor:'pointer', textAlign:'left',
            transition:'all 150ms', outline:'none', fontFamily:'var(--sans)' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.boxShadow='0 4px 20px rgba(255,143,0,0.15)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';}}>
          <div style={{fontSize:32, marginBottom:12}}>{item.icon}</div>
          <div style={{fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:6}}>{item.label}</div>
          <div style={{fontSize:12, color:'var(--text3)'}}>{item.desc}</div>
        </button>
      ))}
    </div>
  );
}
