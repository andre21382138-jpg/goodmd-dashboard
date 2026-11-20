import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const EMPTY = { erp_code: '', product_name: '', out_code: '', out_name: '', opening_stock: 0 };

export default function CwProductsPage() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [modal, setModal]     = useState(null); // null | {id?, ...form}
  const [saving, setSaving]   = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('cw_products').select('*').order('sort_no', { ascending: true });
    if (error) toast(error.message, 'err');
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r =>
      `${r.erp_code || ''} ${r.product_name || ''} ${r.out_code || ''} ${r.out_name || ''}`.toLowerCase().includes(t));
  }, [rows, q]);

  const openAdd  = () => setModal({ ...EMPTY });
  const openEdit = (r) => setModal({ id: r.id, erp_code: r.erp_code || '', product_name: r.product_name || '',
    out_code: r.out_code || '', out_name: r.out_name || '', opening_stock: r.opening_stock ?? 0 });

  const save = async () => {
    if (saving) return;
    const m = modal;
    if (!m.erp_code.trim() && !m.product_name.trim()) { toast('제품코드 또는 상품명을 입력하세요', 'err'); return; }
    setSaving(true);
    const payload = {
      erp_code: m.erp_code.trim() || null,
      product_name: m.product_name.trim() || null,
      out_code: m.out_code.trim() || null,
      out_name: m.out_name.trim() || null,
      opening_stock: Number(m.opening_stock) || 0,
    };
    let error;
    if (m.id) {
      ({ error } = await supabase.from('cw_products').update(payload).eq('id', m.id));
    } else {
      const maxSort = rows.reduce((mx, r) => Math.max(mx, r.sort_no || 0), 0);
      ({ error } = await supabase.from('cw_products').insert({ ...payload, sort_no: maxSort + 1 }));
    }
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast(m.id ? '수정 완료' : '제품 추가 완료', 'ok');
    setModal(null);
    fetchRows();
  };

  const remove = async (r) => {
    if (!window.confirm(`[${r.product_name || r.erp_code}] 제품을 삭제하시겠습니까?\n이 제품의 입고·출고 기록도 함께 삭제됩니다.`)) return;
    const { error } = await supabase.from('cw_products').delete().eq('id', r.id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast('삭제 완료', 'ok');
    fetchRows();
  };

  return (
    <div>
      <div className="fbar">
        <input className="finput" placeholder="제품코드·상품명 검색" value={q} onChange={e => setQ(e.target.value)} />
        <div className="fbar-right">
          <span className="fresult">제품 <b>{filtered.length}</b></span>
          <button className="btn btn-p" onClick={openAdd}>➕ 제품 추가</button>
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
                <th>출고코드</th>
                <th>출고코드 상품명</th>
                <th className="r">기초재고</th>
                <th style={{ width: 110 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="empty"><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="empty">제품이 없습니다</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{r.sort_no}</td>
                  <td className="mono">{r.erp_code || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{r.product_name || <span style={{ color: 'var(--text3)' }}>(이름 없음)</span>}</td>
                  <td className="mono">{r.out_code || ''}</td>
                  <td style={{ color: 'var(--text2)' }}>{r.out_name || ''}</td>
                  <td className="r">{(r.opening_stock ?? 0).toLocaleString()}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-s" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => openEdit(r)}>수정</button>
                    <button className="btn-danger" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => remove(r)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={() => setModal(null)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: 'min(440px, 94vw)', padding: '22px 22px', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{modal.id ? '제품 수정' : '제품 추가'}</div>
            <div className="form-group">
              <label>제품코드 (ERP)</label>
              <input className="input" value={modal.erp_code} onChange={e => setModal({ ...modal, erp_code: e.target.value })} placeholder="예) 8809470003489_1" autoCapitalize="none" />
            </div>
            <div className="form-group">
              <label>상품명</label>
              <input className="input" value={modal.product_name} onChange={e => setModal({ ...modal, product_name: e.target.value })} placeholder="상품명" />
            </div>
            <div className="form-group">
              <label>출고코드 (참고, 선택)</label>
              <input className="input" value={modal.out_code} onChange={e => setModal({ ...modal, out_code: e.target.value })} placeholder="대체 출고코드" autoCapitalize="none" />
            </div>
            <div className="form-group">
              <label>출고코드 상품명 (선택)</label>
              <input className="input" value={modal.out_name} onChange={e => setModal({ ...modal, out_name: e.target.value })} placeholder="출고코드 상품명" />
            </div>
            <div className="form-group">
              <label>기초재고</label>
              <input className="input" type="number" value={modal.opening_stock} onChange={e => setModal({ ...modal, opening_stock: e.target.value })} />
              {modal.id && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>※ 기초재고 수정 시 재고현황의 현재고가 즉시 재계산됩니다.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-s" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setModal(null)}>취소</button>
              <button className="btn btn-p" style={{ flex: 2, justifyContent: 'center' }} onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
