import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function CwStockPage() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prods, error: e1 }, { data: ins, error: e2 }, { data: outs, error: e3 }] = await Promise.all([
      supabase.from('cw_products').select('id, erp_code, product_name, opening_stock, sort_no').eq('active', true).order('sort_no'),
      supabase.from('cw_inbound').select('product_id, qty'),
      supabase.from('cw_outbound').select('product_id, qty, bonus, disposal'),
    ]);
    if (e1 || e2 || e3) toast((e1 || e2 || e3).message, 'err');

    const inMap = {};
    (ins || []).forEach(r => { inMap[r.product_id] = (inMap[r.product_id] || 0) + (r.qty || 0); });
    const outMap = {};
    (outs || []).forEach(r => {
      const m = outMap[r.product_id] || { out: 0, bonus: 0, disposal: 0 };
      m.out += (r.qty || 0); m.bonus += (r.bonus || 0); m.disposal += (r.disposal || 0);
      outMap[r.product_id] = m;
    });

    const built = (prods || []).map(p => {
      const opening = p.opening_stock || 0;
      const inSum = inMap[p.id] || 0;
      const o = outMap[p.id] || { out: 0, bonus: 0, disposal: 0 };
      const current = opening + inSum - (o.out + o.bonus + o.disposal);
      return { ...p, opening, inSum, outSum: o.out, bonusSum: o.bonus, disposalSum: o.disposal, current };
    });
    setRows(built);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r => `${r.erp_code || ''} ${r.product_name || ''}`.toLowerCase().includes(t));
  }, [rows, q]);

  const totals = useMemo(() => filtered.reduce((a, r) => ({
    opening: a.opening + r.opening, inSum: a.inSum + r.inSum, outSum: a.outSum + r.outSum,
    bonusSum: a.bonusSum + r.bonusSum, disposalSum: a.disposalSum + r.disposalSum, current: a.current + r.current,
  }), { opening: 0, inSum: 0, outSum: 0, bonusSum: 0, disposalSum: 0, current: 0 }), [filtered]);

  const num = (n) => (n || 0).toLocaleString();

  return (
    <div>
      <div className="fbar">
        <input className="finput" placeholder="제품코드·상품명 검색" value={q} onChange={e => setQ(e.target.value)} />
        <div className="fbar-right">
          <span className="fresult">제품 <b>{filtered.length}</b></span>
          <button className="btn btn-s" onClick={fetchAll}>↻ 새로고침</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44 }}>NO</th>
                <th>제품코드</th>
                <th>상품명</th>
                <th className="r">기초</th>
                <th className="r">입고</th>
                <th className="r">출고</th>
                <th className="r">증정</th>
                <th className="r">폐기</th>
                <th className="r">현재고</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="empty"><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty">제품이 없습니다</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{r.sort_no}</td>
                  <td className="mono">{r.erp_code || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{r.product_name || <span style={{ color: 'var(--text3)' }}>(이름 없음)</span>}</td>
                  <td className="r" style={{ color: 'var(--text2)' }}>{num(r.opening)}</td>
                  <td className="r" style={{ color: 'var(--success)' }}>{r.inSum ? num(r.inSum) : ''}</td>
                  <td className="r" style={{ color: 'var(--accent)' }}>{r.outSum ? num(r.outSum) : ''}</td>
                  <td className="r" style={{ color: 'var(--text3)' }}>{r.bonusSum ? num(r.bonusSum) : ''}</td>
                  <td className="r" style={{ color: 'var(--danger)' }}>{r.disposalSum ? num(r.disposalSum) : ''}</td>
                  <td className="r" style={{ fontWeight: 700, color: r.current < 0 ? 'var(--danger)' : 'var(--text)' }}>{num(r.current)}</td>
                </tr>
              ))}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
                  <td colSpan={3} style={{ fontWeight: 700 }}>합계</td>
                  <td className="r" style={{ fontWeight: 700 }}>{num(totals.opening)}</td>
                  <td className="r" style={{ fontWeight: 700, color: 'var(--success)' }}>{num(totals.inSum)}</td>
                  <td className="r" style={{ fontWeight: 700, color: 'var(--accent)' }}>{num(totals.outSum)}</td>
                  <td className="r" style={{ fontWeight: 700 }}>{num(totals.bonusSum)}</td>
                  <td className="r" style={{ fontWeight: 700, color: 'var(--danger)' }}>{num(totals.disposalSum)}</td>
                  <td className="r" style={{ fontWeight: 800 }}>{num(totals.current)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
