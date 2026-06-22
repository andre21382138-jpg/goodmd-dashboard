import React, { useState } from 'react';
import StockRequestsAdminView from './StockRequestsAdminView';

// 본사 발주요청 — 사이드바 단일 메뉴
//  탭1 요청접수: 매장이 넣은 발주요청(pending) 매장별 검토·수량수정·삭제 → [발송요청]→SCM
//  탭2 발송현황: SCM 발송요청/발송완료/입고완료 추적
export default function OrderRequestHQPage({ profile }) {
  const [tab, setTab] = useState('pending'); // 'pending' | 'completed'
  return (
    <div>
      <div className="tabbar" style={{ display:'flex', gap:4, marginBottom:14 }}>
        <button className={`tab ${tab==='pending'?'on':''}`} onClick={() => setTab('pending')}>📥 요청접수</button>
        <button className={`tab ${tab==='completed'?'on':''}`} onClick={() => setTab('completed')}>🚚 발송현황</button>
      </div>
      {tab === 'pending'   && <StockRequestsAdminView mode="pending"   profile={profile}/>}
      {tab === 'completed' && <StockRequestsAdminView mode="completed" profile={profile}/>}
    </div>
  );
}
