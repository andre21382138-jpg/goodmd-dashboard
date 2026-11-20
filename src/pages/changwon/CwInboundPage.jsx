import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { CHANGWON_INBOUND_TYPES } from '../../lib/constants';

const label = (p) => `${p.product_name || '(이름없음)'} [${p.erp_code || '-'}]`;
const fmtDt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function CwInboundPage({ profile }) {
  const [products, setProducts] = useState([]);
  const [recent, setRecent]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [pq, setPq]       = useState('');        // 제품 검색
  const [pid, setPid]     = useState('');        // 선택된 제품 id
  const [type, setType]   = useState(CHANGWON_INBOUND_TYPES[0]);
  const [qty, setQty]     = useState('');
  const [memo, setMemo]   = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: ins }] = await Promise.all([
      supabase.from('cw_products').select('id, erp_code, product_name').eq('active', true).order('sort_no'),
      supabase.from('cw_inbound').select('id, qty, inbound_type, memo, created_at, product:cw_products(product_name, erp_code)')
        .order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts(prods || []);
    setRecent(ins || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const options = useMemo(() => {
    const t = pq.trim().toLowerCase();
    if (!t) return products;
    return products.filter(p => `${p.erp_code || ''} ${p.product_name || ''}`.toLowerCase().includes(t));
  }, [products, pq]);

  const save = async () => {
    if (saving) return;
    if (!pid) { toast('제품을 선택하세요', 'err'); return; }
    const n = Number(qty);
    if (!Number.isFinite(n) || n === 0) { toast('입고 수량을 입력하세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('cw_inbound').insert({
      product_id: Number(pid), qty: n, inbound_type: type, memo: memo.trim() || null, created_by: profile?.id || null,
    });
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast('입고 등록 완료', 'ok');
    setQty(''); setMemo('');
    fetchAll();
  };

  const remove = async (r) => {
    if (!window.confirm('이 입고 기록을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('cw_inbound').delete().eq('id', r.id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast('삭제 완료', 'ok');
    fetchAll();
  };

  return (
    <div>
      <div className="card">
        <div className="card-label">입고 등록</div>
        <div className="form-group">
          <label>제품 검색</label>
          <input className="input" placeholder="제품코드·상품명으로 좁히기" value={pq} onChange={e => setPq(e.target.value)} autoCapitalize="none" />
        </div>
        <div className="form-group">
          <label>제품 선택 ({options.length})</label>
          <select className="input" value={pid} onChange={e => setPid(e.target.value)}>
            <option value="">— 제품을 선택하세요 —</option>
            {options.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label>입고 구분</label>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              {CHANGWON_INBOUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 120px' }}>
            <label>입고 수량</label>
            <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-group">
          <label>메모 (선택)</label>
          <input className="input" value={memo} onChange={e => setMemo(e.target.value)} placeholder="유통기한·비고 등" />
        </div>
        <button className="btn btn-p" style={{ width: '100%', justifyContent: 'center', height: 42 }} onClick={save} disabled={saving}>
          {saving ? '저장 중…' : '📥 입고 등록'}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-label" style={{ padding: '16px 20px 10px' }}>최근 입고 내역</div>
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>일시</th>
                <th>제품</th>
                <th>구분</th>
                <th className="r">수량</th>
                <th>메모</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty"><span className="spinner" /></td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={6} className="empty">입고 내역이 없습니다</td></tr>
              ) : recent.map(r => (
                <tr key={r.id}>
                  <td className="mono">{fmtDt(r.created_at)}</td>
                  <td style={{ fontWeight: 600 }}>{r.product?.product_name || r.product?.erp_code || '-'}</td>
                  <td><span className="badge badge-dept">{r.inbound_type}</span></td>
                  <td className="r" style={{ color: 'var(--success)' }}>+{r.qty.toLocaleString()}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{r.memo || ''}</td>
                  <td><button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => remove(r)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
