import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const POLL_INTERVAL = 60000; // 1분 보조 폴링 (Realtime 보완용)

const COLOR = {
  blue:   { border:'#1565C0', light:'#e3f2fd' },
  green:  { border:'#2e7d32', light:'#e8f5e9' },
  red:    { border:'#c62828', light:'#ffebee' },
  orange: { border:'#ef6c00', light:'#fff3e0' },
  purple: { border:'#6a1b9a', light:'#f3e5f5' },
};

export default function NotificationCenter({ profile, setPage }) {
  const [notifs,        setNotifs]        = useState([]);
  const [dismissedKeys, setDismissedKeys] = useState(new Set());
  const [closedKeys,    setClosedKeys]    = useState(new Set());
  const [keepOpen,      setKeepOpen]      = useState({});
  const [bellOpen,      setBellOpen]      = useState(false);

  const isManager = profile?.job_title === '매니저';
  const isHQ      = profile?.job_title === '담당자';
  const isAdmin   = profile?.role === 'admin';
  const canHQ     = isAdmin || isHQ;

  const fetchDismissed = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('notification_dismissed')
      .select('notif_key').eq('user_id', profile.id);
    setDismissedKeys(new Set((data || []).map(d => d.notif_key)));
  }, [profile?.id]);

  const buildNotifs = useCallback(async () => {
    if (!profile?.id) return;
    const list = [];
    const now = new Date();
    const today = now.getDate();

    if (isManager) {
      // 1. 본사 발주 도착 (sent)
      const { data: sent } = await supabase.from('purchase_orders')
        .select('id, week_start, week_end, items:purchase_order_items(id, hq_qty)')
        .eq('store_name', profile.department).eq('branch_name', profile.branch)
        .eq('status', 'sent');
      for (const o of (sent||[])) {
        const totalQty = (o.items||[]).reduce((s,i)=>s+i.hq_qty,0);
        list.push({
          key: `po_sent_${o.id}`, color:'blue', icon:'📋',
          title:'본사 발주 도착',
          msg: `상품 ${o.items?.length||0}종 · ${totalQty}개 (${o.week_start}~${o.week_end})`,
          page:'purchase_check',
        });
      }
      // 2. 입고 확인 대기
      const { data: recv } = await supabase.from('purchase_orders')
        .select('id')
        .eq('store_name', profile.department).eq('branch_name', profile.branch)
        .in('status', ['requested','rerequested']);
      if (recv?.length > 0) {
        list.push({
          key: `po_receive_pending`, color:'green', icon:'📦',
          title:'입고 확인 대기',
          msg: `물품 도착 후 입고 확인이 필요한 발주 ${recv.length}건`,
          page:'purchase_check',
        });
      }
      // 3. 휴무계획 마감 임박 (매월 15~20일)
      if (today >= 15 && today <= 20) {
        const nextM = new Date(now.getFullYear(), now.getMonth()+1, 1);
        const nextMonStr = `${nextM.getFullYear()}-${String(nextM.getMonth()+1).padStart(2,'0')}`;
        const { data: lp } = await supabase.from('leave_plans')
          .select('id').eq('manager_id', profile.id).eq('target_month', nextMonStr).maybeSingle();
        if (!lp) {
          const daysLeft = 20 - today;
          list.push({
            key: `leave_due_${nextMonStr}`, color:'red', icon:'🔴',
            title:'휴무계획 마감 임박',
            msg: `${nextMonStr} 휴무계획 미제출 — ${daysLeft+1}일 남음`,
            page:'leave_plan',
          });
        }
      }
    }

    if (canHQ) {
      // 본사 택배발송 대기
      const { count: pendingDelivery } = await supabase.from('sales')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_type', 'hq')
        .eq('delivery_status', 'pending');
      if (pendingDelivery && pendingDelivery > 0) {
        list.push({
          key: `hq_delivery_pending`, color:'orange', icon:'📦',
          title:`택배 발송요청 ${pendingDelivery}건`,
          msg:'본사 발송 처리 대기 중',
          page:'hq_delivery_request',
        });
      }
      // 매장 새 재고요청
      const { data: stockReq } = await supabase.from('order_requests')
        .select('id, store_name, branch_name, product:products(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (stockReq?.length > 0) {
        const sampleNames = stockReq.slice(0, 3).map(r => `${r.store_name} ${r.branch_name}`).join(', ');
        list.push({
          key: `stock_request_pending`, color:'blue', icon:'📋',
          title:`새 재고요청 ${stockReq.length}건`,
          msg: stockReq.length <= 3 ? sampleNames : `${sampleNames} 외 ${stockReq.length - 3}건`,
          page:'stock_store',
        });
      }
      // 매장 발주요청
      const { data: req } = await supabase.from('purchase_orders')
        .select('id, store_name, branch_name, items:purchase_order_items(id)')
        .eq('status', 'requested');
      for (const o of (req||[])) {
        list.push({
          key: `po_requested_${o.id}`, color:'green', icon:'🟢',
          title:`${o.store_name} ${o.branch_name} 발주요청`,
          msg: `상품 ${o.items?.length||0}종 — 본사 발주 진행 가능`,
          page:'purchase_hq',
        });
      }
      // 매장 재요청
      const { data: rer } = await supabase.from('purchase_orders')
        .select('id, store_name, branch_name, items:purchase_order_items(id)')
        .eq('status', 'rerequested');
      for (const o of (rer||[])) {
        list.push({
          key: `po_rerequested_${o.id}`, color:'orange', icon:'🟧',
          title:`${o.store_name} ${o.branch_name} 재요청`,
          msg: `수량 협의 필요 — 매장 직접 연락`,
          page:'purchase_hq',
        });
      }
      // 매장 입고완료
      const { data: rcv } = await supabase.from('purchase_orders')
        .select('id, store_name, branch_name')
        .eq('status', 'received').limit(20);
      for (const o of (rcv||[])) {
        list.push({
          key: `po_received_${o.id}`, color:'purple', icon:'🟪',
          title:`${o.store_name} ${o.branch_name} 입고완료`,
          msg: '입고 확인 완료',
          page:'purchase_hq',
        });
      }
    }

    setNotifs(list);
  }, [profile, isManager, canHQ]);

  useEffect(() => {
    fetchDismissed(); buildNotifs();
    // 1분 보조 폴링
    const id = setInterval(() => { fetchDismissed(); buildNotifs(); }, POLL_INTERVAL);
    // Realtime 구독: purchase_orders, leave_plans 변경 즉시 반응
    const channel = supabase
      .channel('notif-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_plans' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_requests' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales' }, () => {
        buildNotifs();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => {
        buildNotifs();
      })
      .subscribe();
    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [fetchDismissed, buildNotifs]);

  const activeNotifs   = notifs.filter(n => !dismissedKeys.has(n.key) && !closedKeys.has(n.key));
  const allUnDismissed = notifs.filter(n => !dismissedKeys.has(n.key));

  const handleClose = async (n) => {
    setClosedKeys(prev => new Set([...prev, n.key]));
    if (keepOpen[n.key]) {
      try {
        await supabase.from('notification_dismissed').insert({
          user_id: profile.id, notif_key: n.key,
        });
        setDismissedKeys(prev => new Set([...prev, n.key]));
      } catch {}
    }
  };

  const handleConfirm = (n) => {
    if (setPage) setPage(n.page);
    handleClose(n);
    setBellOpen(false);
  };

  const handleClearAll = () => {
    setClosedKeys(prev => new Set([...prev, ...activeNotifs.map(n => n.key)]));
  };

  return (
    <>
      <style>{`
        @keyframes notif-slide-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .notif-card { animation: notif-slide-in 0.28s ease-out; }
      `}</style>

      {/* 우측 하단 팝업 (최대 3개) */}
      <div style={{position:'fixed', bottom:80, right:20, zIndex:9000, display:'flex', flexDirection:'column', gap:10, maxWidth:340, width:'calc(100vw - 40px)'}}>
        {activeNotifs.slice(0, 3).map(n => {
          const c = COLOR[n.color] || COLOR.blue;
          return (
            <div key={n.key} className="notif-card"
              style={{background:'#fff', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.18)', borderLeft:`4px solid ${c.border}`, padding:'12px 14px'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                <span style={{fontSize:15}}>{n.icon}</span>
                <strong style={{fontSize:13, flex:1, color:'var(--text)'}}>{n.title}</strong>
                <button onClick={() => handleClose(n)} aria-label="닫기"
                  style={{background:'none', border:'none', cursor:'pointer', color:'#999', fontSize:16, lineHeight:1, padding:0}}>✕</button>
              </div>
              <div style={{fontSize:12, color:'var(--text2)', marginBottom:10, paddingLeft:23}}>{n.msg}</div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', paddingLeft:23}}>
                <label style={{fontSize:11, color:'var(--text3)', cursor:'pointer', display:'flex', alignItems:'center', gap:5}}>
                  <input type="checkbox" checked={!!keepOpen[n.key]}
                    onChange={e => setKeepOpen(prev => ({...prev, [n.key]: e.target.checked}))}
                    style={{cursor:'pointer', margin:0}}/>
                  다시 보지 않기
                </label>
                <button onClick={() => handleConfirm(n)}
                  style={{padding:'5px 14px', background:c.border, color:'#fff', border:'none', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer'}}>
                  확인
                </button>
              </div>
            </div>
          );
        })}
        {activeNotifs.length > 3 && (
          <div style={{textAlign:'center', fontSize:11, color:'var(--text3)', background:'rgba(255,255,255,0.95)', padding:'4px', borderRadius:4}}>
            외 {activeNotifs.length - 3}건 — 🔔 클릭하여 전체 보기
          </div>
        )}
        {activeNotifs.length > 0 && (
          <button onClick={handleClearAll}
            style={{alignSelf:'flex-end', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, cursor:'pointer'}}>
            모두 닫기
          </button>
        )}
      </div>

      {/* 우측 하단 알림 종 */}
      <button onClick={() => setBellOpen(o => !o)} aria-label="알림"
        style={{position:'fixed', bottom:20, right:20, zIndex:9001,
          width:48, height:48, borderRadius:'50%', border:'none', cursor:'pointer',
          background:'#fff', boxShadow:'0 4px 16px rgba(0,0,0,0.18)',
          fontSize:20, lineHeight:1, padding:0}}>
        🔔
        {allUnDismissed.length > 0 && (
          <span style={{position:'absolute', top:-2, right:-2, background:'#c62828', color:'#fff', borderRadius:12, padding:'2px 6px', fontSize:10, fontWeight:700, minWidth:18, lineHeight:1.2}}>
            {allUnDismissed.length}
          </span>
        )}
      </button>

      {/* 알림 패널 */}
      {bellOpen && (
        <div style={{position:'fixed', bottom:80, right:20, zIndex:9002, background:'#fff',
          borderRadius:8, boxShadow:'0 8px 32px rgba(0,0,0,0.22)',
          width:360, maxHeight:480, display:'flex', flexDirection:'column',
          maxWidth:'calc(100vw - 40px)'}}>
          <div style={{padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <strong style={{fontSize:14}}>알림 ({allUnDismissed.length})</strong>
            <button onClick={() => setBellOpen(false)}
              style={{background:'none', border:'none', cursor:'pointer', color:'#999', fontSize:18, lineHeight:1, padding:0}}>✕</button>
          </div>
          <div style={{flex:1, overflowY:'auto'}}>
            {allUnDismissed.length === 0
              ? <div style={{padding:'40px 16px', textAlign:'center', color:'var(--text3)', fontSize:13}}>
                  새 알림이 없습니다
                </div>
              : allUnDismissed.map(n => {
                  const c = COLOR[n.color] || COLOR.blue;
                  return (
                    <div key={n.key} onClick={() => handleConfirm(n)}
                      style={{padding:'12px 16px', borderBottom:'1px solid #f0f0f0', cursor:'pointer', borderLeft:`4px solid ${c.border}`, transition:'background 0.15s'}}
                      onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                        <span style={{fontSize:14}}>{n.icon}</span>
                        <strong style={{fontSize:13, color:'var(--text)'}}>{n.title}</strong>
                      </div>
                      <div style={{fontSize:11, color:'var(--text2)', paddingLeft:22}}>{n.msg}</div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      )}
    </>
  );
}
