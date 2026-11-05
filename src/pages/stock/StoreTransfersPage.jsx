import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

// 본사 '재고이동 내역' — 매장 재고이동(store_transfers) 목록 + [취소] 버튼
// 취소는 cancel_store_transfer RPC(단일 트랜잭션)로 출발/도착 재고까지 원자적으로 되돌린다.
export default function StoreTransfersPage({ profile }) {
  const canManage = profile?.role === 'admin' || profile?.job_title === '담당자';

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]       = useState(daysAgoStr(30));
  const [to, setTo]           = useState(todayStr());
  const [fStatus, setFStatus] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [cancelingId, setCancelingId] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const fromISO = `${from}T00:00:00`;
    const toISO   = `${to}T23:59:59`;
    const { data } = await supabase.from('store_transfers')
      .select('*, product:products(name, code)')
      .gte('dispatched_at', fromISO).lte('dispatched_at', toISO)
      .order('dispatched_at', { ascending: false })
      .limit(500);
    setRows(data || []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (fStatus) r = r.filter(t => t.status === fStatus);
    if (fSearch.trim()) {
      const q = fSearch.trim().toLowerCase();
      r = r.filter(t =>
        `${t.from_store_name} ${t.from_branch_name} ${t.to_store_name} ${t.to_branch_name} ${t.product?.name || ''} ${t.product?.code || ''}`
          .toLowerCase().includes(q));
    }
    return r;
  }, [rows, fStatus, fSearch]);

  const handleCancel = async (t) => {
    if (!canManage) { toast('취소 권한이 없습니다', 'err'); return; }
    const recv = t.status === 'received';
    const msg = recv
      ? `이 이동은 이미 '입고완료' 상태입니다.\n\n${t.to_store_name} ${t.to_branch_name}의 입고 재고 ${t.received_qty ?? t.quantity}개를 빼고,\n${t.from_store_name} ${t.from_branch_name}로 되돌립니다.\n\n정말 취소할까요?`
      : `${t.from_store_name} ${t.from_branch_name} → ${t.to_store_name} ${t.to_branch_name}\n${t.product?.name || ''} ${t.quantity}개 이동을 취소합니다.\n(출발매장 재고 ${t.quantity}개 복구, 이동기록 삭제)\n\n진행할까요?`;
    if (!window.confirm(msg)) return;
    setCancelingId(t.id);
    try {
      const { error } = await supabase.rpc('cancel_store_transfer', { p_transfer_id: t.id });
      if (error) throw error;
      toast('이동이 취소되었습니다 (재고 복구 완료)', 'ok');
      fetchRows();
    } catch (err) {
      toast('취소 실패: ' + (err.message || err), 'err');
    } finally {
      setCancelingId(null);
    }
  };

  const statusBadge = (s) => {
    const map = {
      dispatched: { t: '🚚 이동중(미입고)', bg: '#e3f2fd', c: '#1565C0' },
      received:   { t: '✅ 입고완료',        bg: '#e8f5e9', c: '#2e7d32' },
    };
    const m = map[s] || { t: s || '-', bg: '#f0f0f0', c: '#666' };
    return <span style={{ padding: '2px 8px', borderRadius: 'var(--radius)', background: m.bg, color: m.c, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{m.t}</span>;
  };

  const td = { fontSize: 13, color: 'var(--text)' };

  return (
    <div>
      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="fbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input type="date" className="fsel" value={from} max={to} onChange={e => setFrom(e.target.value)} />
          <span style={{ color: 'var(--text3)' }}>~</span>
          <input type="date" className="fsel" value={to} min={from} max={todayStr()} onChange={e => setTo(e.target.value)} />
          <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">전체 상태</option>
            <option value="dispatched">이동중(미입고)</option>
            <option value="received">입고완료</option>
          </select>
          <input className="finput" placeholder="매장/상품 검색" value={fSearch} onChange={e => setFSearch(e.target.value)} style={{ minWidth: 160 }} />
          {(fStatus || fSearch) && <button className="btn-ghost" onClick={() => { setFStatus(''); setFSearch(''); }}>✕ 초기화</button>}
          <div className="fbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="fresult">이동 <b>{filtered.length}</b>건</span>
          </div>
        </div>

        {loading ? <div className="empty"><span className="spinner" /></div> : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>이동일</th><th>출발매장</th><th>도착매장</th><th>상품</th>
                  <th style={{ textAlign: 'right' }}>수량</th><th>상태</th><th style={{ width: 90 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={7} className="empty">이동 내역이 없습니다</td></tr>
                  : filtered.map(t => (
                    <tr key={t.id}>
                      <td style={td}>{String(t.dispatched_at || '').slice(0, 10)}</td>
                      <td><span className="badge badge-dept">{t.from_store_name}</span> <span className="badge badge-store">{t.from_branch_name}</span></td>
                      <td><span className="badge badge-dept">{t.to_store_name}</span> <span className="badge badge-store">{t.to_branch_name}</span></td>
                      <td style={{ ...td, fontWeight: 600 }}>{t.product?.name || `#${t.product_id}`}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                        {t.quantity}{t.status === 'received' && t.received_qty != null && t.received_qty !== t.quantity ? ` (입고 ${t.received_qty})` : ''}
                      </td>
                      <td>{statusBadge(t.status)}</td>
                      <td>
                        {canManage ? (
                          <button
                            onClick={() => handleCancel(t)}
                            disabled={cancelingId === t.id}
                            style={{ height: 28, padding: '0 10px', border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
                              background: '#fff', color: 'var(--danger)', fontSize: 12, fontWeight: 700,
                              cursor: cancelingId === t.id ? 'not-allowed' : 'pointer', opacity: cancelingId === t.id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                            {cancelingId === t.id ? '취소중…' : '취소'}
                          </button>
                        ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>-</span>}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
        · 취소 시 출발매장 재고가 복구되고 이동기록이 삭제됩니다. 입고완료 건은 도착매장 재고도 함께 차감됩니다.<br />
        · 모든 취소는 서버에서 한 번에(원자적으로) 처리되어 중간 실패로 재고가 틀어지지 않습니다.
      </div>
    </div>
  );
}
