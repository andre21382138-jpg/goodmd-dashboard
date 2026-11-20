import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

export default function CwStockPage() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [adj, setAdj]         = useState(null); // {id, name, current, opening, val}
  const [saving, setSaving]   = useState(false);

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
      outMap[r.product_id] = (outMap[r.product_id] || 0) + (r.qty || 0) + (r.bonus || 0) + (r.disposal || 0);
    });

    const built = (prods || []).map(p => {
      const current = (p.opening_stock || 0) + (inMap[p.id] || 0) - (outMap[p.id] || 0);
      return { ...p, current };
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

  const totalCurrent = useMemo(() => filtered.reduce((a, r) => a + r.current, 0), [filtered]);
  const num = (n) => (n || 0).toLocaleString();

  // 현재고 직접 보정 — 입출고 이력은 두고 기초재고를 (입력값−현재고)만큼 조정
  const saveAdj = async () => {
    if (saving || !adj) return;
    const next = Number(adj.val);
    if (!Number.isFinite(next)) { toast('숫자를 입력하세요', 'err'); return; }
    const delta = next - adj.current;
    setSaving(true);
    const { error } = await supabase.from('cw_products')
      .update({ opening_stock: (adj.opening || 0) + delta }).eq('id', adj.id);
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast('현재고 수정 완료', 'ok');
    setAdj(null);
    fetchAll();
  };

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
          <table style={{ width: 'auto', minWidth: 360, maxWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>NO</th>
                <th>제품코드</th>
                <th>상품명</th>
                <th className="r" style={{ paddingLeft: 40 }}>현재고</th>
                <th style={{ width: 60 }}>수정</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="empty"><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="empty">제품이 없습니다</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{r.sort_no}</td>
                  <td className="mono">{r.erp_code || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{r.product_name || <span style={{ color: 'var(--text3)' }}>(이름 없음)</span>}</td>
                  <td className="r" style={{ fontWeight: 700, fontSize: 14, color: r.current < 0 ? 'var(--danger)' : 'var(--text)' }}>{num(r.current)}</td>
                  <td>
                    <button className="btn btn-s" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => setAdj({ id: r.id, name: r.product_name || r.erp_code, current: r.current, opening: r.opening_stock || 0, val: String(r.current) })}>
                      수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
                  <td colSpan={3} style={{ fontWeight: 700 }}>합계</td>
                  <td className="r" style={{ fontWeight: 800, fontSize: 14 }}>{num(totalCurrent)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {adj && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={() => setAdj(null)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: 'min(380px, 94vw)', padding: '22px 22px', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>현재고 수정</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{adj.name}</div>
            <div className="form-group">
              <label>현재고</label>
              <input className="input" type="number" autoFocus value={adj.val}
                onChange={e => setAdj({ ...adj, val: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') saveAdj(); }} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                기존 {num(adj.current)} → 입력값으로 보정됩니다. 입고·출고 내역은 그대로 유지됩니다.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-s" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAdj(null)}>취소</button>
              <button className="btn btn-p" style={{ flex: 2, justifyContent: 'center' }} onClick={saveAdj} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
