import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import ProductPicker from './ProductPicker';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (s) => (s ? String(s).slice(0, 10).replace(/-/g, '.').slice(5) : '');

export default function CwOutboundPage({ profile }) {
  const [products, setProducts] = useState([]);
  const [stores, setStores]     = useState([]);
  const [recent, setRecent]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [date, setDate]         = useState(todayStr()); // 기록일(기본 오늘)
  const [pid, setPid]           = useState('');
  const [storeId, setStoreId]   = useState('');
  const [qty, setQty]           = useState('');
  const [bonus, setBonus]       = useState('');   // 증정(덤)
  const [disposal, setDisposal] = useState('');   // 폐기
  const [memo, setMemo]         = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: st }, { data: outs }] = await Promise.all([
      supabase.from('cw_products').select('id, erp_code, product_name').eq('active', true).order('sort_no'),
      supabase.from('cw_stores').select('id, name').eq('active', true).order('sort_no'),
      supabase.from('cw_outbound').select('id, qty, bonus, disposal, memo, entry_date, created_at, product:cw_products(product_name, erp_code), store:cw_stores(name)')
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts(prods || []);
    setStores(st || []);
    setRecent(outs || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    if (saving) return;
    if (!pid) { toast('제품을 선택하세요', 'err'); return; }
    if (!storeId) { toast('매장을 선택하세요', 'err'); return; }
    const q = Number(qty) || 0, b = Number(bonus) || 0, d = Number(disposal) || 0;
    if (q + b + d <= 0) { toast('출고·증정·폐기 중 하나 이상 입력하세요', 'err'); return; }
    if (!date) { toast('날짜를 선택하세요', 'err'); return; }
    setSaving(true);
    const { error } = await supabase.from('cw_outbound').insert({
      product_id: Number(pid), store_id: Number(storeId), qty: q, bonus: b, disposal: d,
      memo: memo.trim() || null, entry_date: date, created_by: profile?.id || null,
    });
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast('출고 등록 완료', 'ok');
    setPid(''); setQty(''); setBonus(''); setDisposal(''); setMemo('');
    fetchAll();
  };

  const remove = async (r) => {
    if (!window.confirm('이 출고 기록을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('cw_outbound').delete().eq('id', r.id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast('삭제 완료', 'ok');
    fetchAll();
  };

  return (
    <div>
      <div className="card">
        <div className="card-label">출고 등록</div>
        <div className="form-group">
          <label>날짜</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        <div className="form-group">
          <label>제품 검색</label>
          <ProductPicker products={products} value={pid} onChange={(id) => setPid(id)} />
        </div>
        <div className="form-group">
          <label>매장 선택</label>
          <select className="input" value={storeId} onChange={e => setStoreId(e.target.value)}>
            <option value="">— 매장을 선택하세요 —</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 90px' }}>
            <label>출고 수량</label>
            <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group" style={{ flex: '1 1 90px' }}>
            <label>증정</label>
            <input className="input" type="number" value={bonus} onChange={e => setBonus(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group" style={{ flex: '1 1 90px' }}>
            <label>폐기</label>
            <input className="input" type="number" value={disposal} onChange={e => setDisposal(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-group">
          <label>메모 (선택)</label>
          <input className="input" value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고" />
        </div>
        <button className="btn btn-p" style={{ width: '100%', justifyContent: 'center', height: 42 }} onClick={save} disabled={saving}>
          {saving ? '저장 중…' : '📤 출고 등록'}
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-label" style={{ padding: '16px 20px 10px' }}>최근 출고 내역</div>
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>날짜</th>
                <th>제품</th>
                <th>매장</th>
                <th className="r">출고</th>
                <th className="r">증정</th>
                <th className="r">폐기</th>
                <th>메모</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="empty"><span className="spinner" /></td></tr>
              ) : recent.length === 0 ? (
                <tr><td colSpan={8} className="empty">출고 내역이 없습니다</td></tr>
              ) : recent.map(r => (
                <tr key={r.id}>
                  <td className="mono">{fmtDate(r.entry_date)}</td>
                  <td style={{ fontWeight: 600 }}>{r.product?.product_name || r.product?.erp_code || '-'}</td>
                  <td><span className="badge badge-store">{r.store?.name || '-'}</span></td>
                  <td className="r" style={{ color: 'var(--accent)' }}>{r.qty ? `-${r.qty.toLocaleString()}` : ''}</td>
                  <td className="r" style={{ color: 'var(--text3)' }}>{r.bonus || ''}</td>
                  <td className="r" style={{ color: 'var(--danger)' }}>{r.disposal || ''}</td>
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
