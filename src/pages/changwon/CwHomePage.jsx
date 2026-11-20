import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (s) => (s ? String(s).slice(5, 10).replace('-', '.') : '');
const prodName = (p) => p?.product_name || p?.erp_code || '-';

export default function CwHomePage() {
  const [inbound, setInbound]   = useState([]);
  const [outbound, setOutbound] = useState([]);
  const [loading, setLoading]   = useState(true);

  // 당월 1일 ~ 어제
  const { monthStart, yStr, label } = useMemo(() => {
    const d = new Date();
    const ms = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const ys = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
    return { monthStart: ms, yStr: ys, label: `당월 ${ms.slice(5).replace('-', '.')} ~ 어제 ${ys.slice(5).replace('-', '.')}` };
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: ins, error: e1 }, { data: outs, error: e2 }] = await Promise.all([
      supabase.from('cw_inbound')
        .select('id, qty, inbound_type, entry_date, product:cw_products(product_name, erp_code)')
        .gte('entry_date', monthStart).lte('entry_date', yStr)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('cw_outbound')
        .select('id, qty, bonus, disposal, entry_date, product:cw_products(product_name, erp_code), store:cw_stores(name)')
        .gte('entry_date', monthStart).lte('entry_date', yStr)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    if (e1 || e2) toast((e1 || e2).message, 'err');
    setInbound(ins || []);
    setOutbound(outs || []);
    setLoading(false);
  }, [monthStart, yStr]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const inTotal  = useMemo(() => inbound.reduce((a, r) => a + (r.qty || 0), 0), [inbound]);
  const outTotal = useMemo(() => outbound.reduce((a, r) => a + (r.qty || 0) + (r.bonus || 0) + (r.disposal || 0), 0), [outbound]);

  return (
    <div>
      <div className="fbar" style={{ marginBottom: 16 }}>
        <span className="fresult" style={{ fontSize: 14 }}>📅 {label}</span>
        <div className="fbar-right">
          <button className="btn btn-s" onClick={fetchAll}>↻ 새로고침</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 입고내역 */}
        <div className="card" style={{ flex: '1 1 340px', padding: 0, minWidth: 0 }}>
          <div className="card-label" style={{ padding: '16px 20px 10px', color: 'var(--success)' }}>
            📥 입고내역 <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{inbound.length}건 · 총 {inTotal.toLocaleString()}</span>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr><th style={{ width: 56 }}>날짜</th><th>제품</th><th>구분</th><th className="r">수량</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="empty"><span className="spinner" /></td></tr>
                ) : inbound.length === 0 ? (
                  <tr><td colSpan={4} className="empty">입고내역이 없습니다</td></tr>
                ) : inbound.map(r => (
                  <tr key={r.id}>
                    <td className="mono">{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight: 600 }}>{prodName(r.product)}</td>
                    <td style={{ fontSize: 11, color: 'var(--text2)' }}>{r.inbound_type}</td>
                    <td className="r" style={{ color: 'var(--success)' }}>+{(r.qty || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 출고내역 */}
        <div className="card" style={{ flex: '1 1 340px', padding: 0, minWidth: 0 }}>
          <div className="card-label" style={{ padding: '16px 20px 10px', color: 'var(--accent)' }}>
            📤 출고내역 <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{outbound.length}건 · 총 {outTotal.toLocaleString()}</span>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr><th style={{ width: 56 }}>날짜</th><th>제품</th><th>매장</th><th className="r">출고</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="empty"><span className="spinner" /></td></tr>
                ) : outbound.length === 0 ? (
                  <tr><td colSpan={4} className="empty">출고내역이 없습니다</td></tr>
                ) : outbound.map(r => (
                  <tr key={r.id}>
                    <td className="mono">{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight: 600 }}>{prodName(r.product)}</td>
                    <td><span className="badge badge-store">{r.store?.name || '-'}</span></td>
                    <td className="r" style={{ color: 'var(--accent)' }}>
                      {r.qty ? `-${r.qty.toLocaleString()}` : ''}
                      {(r.bonus || r.disposal) ? (
                        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>
                          {r.bonus ? `증${r.bonus}` : ''}{r.disposal ? ` 폐${r.disposal}` : ''}
                        </span>
                      ) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
