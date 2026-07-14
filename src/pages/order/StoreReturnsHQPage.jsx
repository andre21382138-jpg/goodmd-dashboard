import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq } from '../../lib/utils';
import { STORE_NAMES } from '../../lib/constants';

// 본사 → 매장 반품신청 조회
//  각 매장이 [본사 반품]으로 신청한 내역(언제·어느 매장·어떤 품목·몇 개·무슨 사유)을
//  날짜/매장/품목으로 조회하고 [확인] 처리.
const REASON_LABEL = { '파손': '제품 파손', '유통기한': '유통기한 임박/만료', '본사요청': '본사 요청', '기타': '기타' };
const REASON_COLOR = { '파손': '#c62828', '유통기한': '#e65100', '본사요청': '#1565C0', '기타': '#455a64' };

export default function StoreReturnsHQPage({ profile }) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;

  const [fFrom, setFFrom]   = useState(monthStart);
  const [fTo, setFTo]       = useState(fmt(today));
  const [fStore, setFStore] = useState('');
  const [fProd, setFProd]   = useState('');
  const [fStatus, setFStatus] = useState('all'); // all | pending | confirmed
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('store_returns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (fFrom)   q = q.gte('created_at', `${fFrom}T00:00:00`);
    if (fTo)     q = q.lte('created_at', `${fTo}T23:59:59`);
    if (fStore)  q = q.eq('store_name', fStore);
    if (fStatus !== 'all') q = q.eq('status', fStatus);
    const { data, error } = await q;
    if (error) toast(error.message, 'err');
    else setRows(data || []);
    setLoading(false);
  }, [fFrom, fTo, fStore, fStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stores = useMemo(() => uniq(rows.map(r => r.store_name).filter(Boolean)), [rows]);

  // 품목 필터(클라이언트)
  const visible = useMemo(() => {
    const q = fProd.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.product_name || '').toLowerCase().includes(q) || String(r.product_code || '').toLowerCase().includes(q));
  }, [rows, fProd]);

  const totalQty = visible.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const pendingCnt = visible.filter(r => r.status === 'pending').length;

  const confirmOne = async (r) => {
    if (!window.confirm(`${r.store_name} ${r.branch_name}\n${r.product_name} ${r.quantity}개 (${REASON_LABEL[r.reason] || r.reason})\n\n확인 처리하시겠습니까?`)) return;
    setProcessing(r.id);
    const { error } = await supabase.from('store_returns')
      .update({ status: 'confirmed', confirmed_by: profile?.id || null, confirmed_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) toast(error.message, 'err');
    else { toast('확인 처리 완료', 'ok'); fetchData(); }
    setProcessing(null);
  };

  const dt = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <>
      <div className="card">
        <div className="card-label">↩️ 매장 반품신청 조회</div>
        <div className="fbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} />
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 매장</option>
            {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="fsel" value={fProd} onChange={e => setFProd(e.target.value)} placeholder="🔍 품목명·코드" style={{ minWidth: 160 }} />
          <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="all">전체 상태</option>
            <option value="pending">확인 대기</option>
            <option value="confirmed">확인 완료</option>
            <option value="completed">반품완료</option>
          </select>
          <div className="fbar-right">
            <span className="fresult">
              <b>{visible.length}</b>건 · 총 <b>{totalQty}</b>개
              {pendingCnt > 0 && <> · 대기 <b style={{ color: 'var(--accent)' }}>{pendingCnt}</b></>}
            </span>
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>{loading ? <span className="spinner" /> : '🔄 새로고침'}</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        {loading ? <div className="empty"><span className="spinner" /></div>
        : visible.length === 0 ? <div className="empty">조회된 반품신청이 없습니다</div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>신청일시</th>
                  <th>매장</th><th>지점</th>
                  <th>상품명</th>
                  <th style={{ width: 120 }}>코드</th>
                  <th className="r" style={{ width: 60 }}>수량</th>
                  <th style={{ width: 120 }}>사유</th>
                  <th>메모</th>
                  <th style={{ width: 110, textAlign: 'center' }}>상태</th>
                  <th style={{ width: 70, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const st = r.status;
                  return (
                    <tr key={r.id} style={st !== 'pending' ? { background: '#fafafa' } : {}}>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{dt(r.created_at)}</td>
                      <td><span className="badge badge-dept">{r.store_name}</span></td>
                      <td><span className="badge badge-store">{r.branch_name}</span></td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{r.product_name}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{r.product_code || '-'}</td>
                      <td className="r" style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{r.quantity}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, color: REASON_COLOR[r.reason] || 'var(--text2)' }}>{REASON_LABEL[r.reason] || r.reason}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text2)' }}>{r.memo || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {st === 'completed'
                          ? <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', fontSize: 11 }}>↩️ 반품완료</span>
                          : st === 'confirmed'
                          ? <span className="badge" style={{ background: '#e3f2fd', color: '#1565C0', border: '1px solid #90caf9', fontSize: 11 }}>✓ 확인완료</span>
                          : <span className="badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', fontSize: 11 }}>대기</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {st === 'pending' && (
                          <button type="button" onClick={() => confirmOne(r)} disabled={processing === r.id}
                            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700, border: '1px solid #2e7d32', borderRadius: 4, background: '#e8f5e9', color: '#2e7d32', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {processing === r.id ? '…' : '확인'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
