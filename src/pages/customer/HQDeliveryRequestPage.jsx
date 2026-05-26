import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

function groupKey(s) {
  return `${s.sold_at}|${s.recipient_phone || ''}|${s.customer_id || ''}|${s.store_name}|${s.branch_name}`;
}

function groupSales(rows) {
  const map = new Map();
  for (const s of (rows || [])) {
    const k = groupKey(s);
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        sold_at: s.sold_at,
        store_name: s.store_name,
        branch_name: s.branch_name,
        recipient_name: s.recipient_name,
        recipient_phone: s.recipient_phone,
        recipient_address: s.recipient_address,
        delivery_notes: s.delivery_notes,
        dispatched_at: s.dispatched_at,
        items: [],
      });
    }
    map.get(k).items.push(s);
  }
  return [...map.values()].sort((a, b) =>
    (b.sold_at || '').localeCompare(a.sold_at || '')
  );
}

export default function HQDeliveryRequestPage({ profile }) {
  const [tab, setTab] = useState('pending');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const limit = tab === 'pending' ? 200 : 50;
    const { data, error } = await supabase.from('sales')
      .select(`id, sold_at, store_name, branch_name, quantity, price,
               recipient_name, recipient_phone, recipient_address, delivery_notes,
               dispatched_at, customer_id,
               product:products(name, code)`)
      .eq('delivery_type', 'hq')
      .eq('delivery_status', tab)
      .order(tab === 'pending' ? 'sold_at' : 'dispatched_at', { ascending: false })
      .limit(limit);
    if (error) toast(error.message, 'err');
    else setGroups(groupSales(data));
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDispatch = async (group) => {
    const ok = window.confirm(
      `${group.recipient_name}님 (${group.recipient_phone})\n` +
      `${group.items.length}개 상품을 발송처리하시겠습니까?\n\n` +
      `처리 후 매장 매출조회에서 "✅ 본사발송 완료"로 표시됩니다.`
    );
    if (!ok) return;
    setProcessing(group.key);
    try {
      const ids = group.items.map(it => it.id);
      const { error } = await supabase.from('sales').update({
        delivery_status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        dispatched_by: profile.id,
      }).in('id', ids);
      if (error) throw error;
      toast(`${ids.length}건 발송처리 완료`, 'ok');
      fetchData();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab==='pending'?'on':''}`} onClick={() => setTab('pending')}>
          📦 발송 대기
        </button>
        <button className={`tab ${tab==='dispatched'?'on':''}`} onClick={() => setTab('dispatched')}>
          ✅ 발송 완료
        </button>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
          <span className="fresult">
            {tab === 'pending'
              ? <>발송 대기 중인 본사 택배 요청 — <b>{groups.length}</b>건</>
              : <>발송 완료 — <b>{groups.length}</b>건 <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>(최근 50건만 표시)</span></>}
          </span>
          <button className="btn btn-s" onClick={fetchData} disabled={loading}>
            {loading ? <span className="spinner"/> : '🔄 새로고침'}
          </button>
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
          : groups.length === 0 ? <div className="empty">
              {tab === 'pending' ? '발송 대기 중인 요청이 없습니다' : '발송 완료 이력이 없습니다'}
            </div>
          : (
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            {groups.map(g => {
              const isProc = processing === g.key;
              return (
                <div key={g.key} style={{
                  border:'1px solid #ffcc80', borderRadius:'var(--radius)',
                  background:'#fffaf0', padding:'14px 18px'
                }}>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:15, fontWeight:700, color:'var(--text)'}}>
                      📦 {g.recipient_name} <span style={{fontFamily:'var(--mono)', fontSize:12, color:'var(--text2)', marginLeft:6}}>{g.recipient_phone}</span>
                    </div>
                    <div style={{fontSize:12, color:'var(--text2)', marginTop:3}}>📍 {g.recipient_address}</div>
                    {g.delivery_notes && (
                      <div style={{fontSize:11, color:'var(--text3)', marginTop:3}}>💬 {g.delivery_notes}</div>
                    )}
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--text3)', marginBottom:8}}>
                    <span className="badge badge-dept">{g.store_name}</span>
                    <span className="badge badge-store">{g.branch_name}</span>
                    <span className="mono">{g.sold_at}</span>
                    {tab === 'dispatched' && g.dispatched_at && (
                      <span style={{marginLeft:'auto', color:'var(--success)'}}>
                        ✅ 발송완료: {new Date(g.dispatched_at).toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>
                  <div style={{background:'#fff', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px', marginBottom: tab==='pending' ? 12 : 0}}>
                    {g.items.map(it => (
                      <div key={it.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:12, padding:'3px 0'}}>
                        <span style={{flex:1}}>{it.product?.name || '-'}</span>
                        <span className="mono" style={{color:'var(--text3)', fontSize:11}}>{it.product?.code || '-'}</span>
                        <span style={{fontFamily:'var(--mono)', fontWeight:700}}>×{it.quantity}</span>
                      </div>
                    ))}
                  </div>
                  {tab === 'pending' && (
                    <div style={{display:'flex', justifyContent:'flex-end'}}>
                      <button className="btn btn-p" onClick={() => handleDispatch(g)} disabled={isProc}
                        style={{padding:'0 18px', height:36, fontWeight:700, fontSize:13}}>
                        {isProc ? <span className="spinner"/> : '✓ 발송처리'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
