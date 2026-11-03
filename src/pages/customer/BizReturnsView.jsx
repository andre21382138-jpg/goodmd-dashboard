import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

// 특판 매출 반품내역 — biz_sales 중 is_return=true 행을 날짜/업체별로 조회
export default function BizReturnsView({ profile }) {
  const isApprover = profile?.role === 'admin' || profile?.job_title === '담당자';

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo, setFTo] = useState(todayStr);
  const [fCompany, setFCompany] = useState('');
  const [companies, setCompanies] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('biz_companies').select('id, name').order('name').then(({ data }) => setCompanies(data || []));
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('biz_sales')
      .select('*, company:biz_companies(name), brand:brands(name), product:products(name, code)')
      .eq('is_return', true)
      .gte('sold_at', fFrom).lte('sold_at', fTo)
      .order('sold_at', { ascending: false });
    if (fCompany) q = q.eq('company_id', fCompany);
    const { data, error } = await q;
    if (error) toast(error.message, 'err');
    else setRows(data || []);
    setLoading(false);
  }, [fFrom, fTo, fCompany]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const cancelReturn = async (r) => {
    if (!window.confirm('이 반품 내역을 취소(삭제)하시겠습니까?\n매출 차감이 되돌려집니다.')) return;
    const { error } = await supabase.from('biz_sales').delete().eq('id', r.id);
    if (error) { toast(error.message, 'err'); return; }
    toast('반품 취소 완료', 'inf');
    fetchReturns();
  };

  // |수량|, |금액| 기준 합계 (반품은 음수 저장)
  const rowQty = (r) => Math.abs(Number(r.quantity) || 0);
  const rowAmt = (r) => Math.round((Number(r.supply_price) || 0) * rowQty(r));
  const totalQty = rows.reduce((s, r) => s + rowQty(r), 0);
  const totalAmt = rows.reduce((s, r) => s + rowAmt(r), 0);

  const selStyle = { height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} style={selStyle} title="반품일 시작" />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>~</span>
        <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} style={selStyle} title="반품일 종료" />
        <button className="btn btn-s" onClick={() => { setFFrom(todayStr); setFTo(todayStr); }}>오늘</button>
        <button className="btn btn-s" onClick={() => { setFFrom(monthStart); setFTo(todayStr); }}>이번달</button>
        <select value={fCompany} onChange={e => setFCompany(e.target.value)} style={selStyle}>
          <option value="">전체 업체</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {fCompany && <button className="btn-ghost" onClick={() => setFCompany('')}>✕</button>}
        <button className="btn btn-s" onClick={fetchReturns} disabled={loading}>
          {loading ? <span className="spinner" /> : '🔄 새로고침'}
        </button>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>반품 합계</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--mono)' }}>-{totalAmt.toLocaleString()}원</div>
        </div>
      </div>
      {loading ? <div className="empty"><span className="spinner" /></div> : rows.length === 0 ? (
        <div className="empty">반품 내역이 없습니다</div>
      ) : (
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th>반품일</th><th>업체</th><th>브랜드</th><th>상품명</th>
                <th className="r">반품수량</th><th className="r">단가</th><th className="r">반품금액</th>
                <th>메모</th>
                {isApprover && <th style={{ width: 90, textAlign: 'center' }}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ background: '#fff5f5' }}>
                  <td className="mono" style={{ fontSize: 12 }}>{r.sold_at}</td>
                  <td style={{ fontWeight: 600 }}>{r.company?.name || r.company_name || '-'}</td>
                  <td><span className="badge badge-dept">{r.brand?.name || r.brand_name || '-'}</span></td>
                  <td style={{ fontSize: 13 }}>{r.product?.name || r.product_name || '-'}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--danger)' }}>{rowQty(r)}</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)' }}>{Math.round(r.supply_price || 0).toLocaleString()}원</td>
                  <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--danger)' }}>-{rowAmt(r).toLocaleString()}원</td>
                  <td style={{ fontSize: 11, color: 'var(--text2)' }}>{r.memo || '-'}</td>
                  {isApprover && (
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-danger" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => cancelReturn(r)}>반품취소</button>
                    </td>
                  )}
                </tr>
              ))}
              <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border2)' }}>
                <td colSpan={4} style={{ padding: '10px 11px', fontWeight: 700 }}>합계</td>
                <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, padding: '10px 11px', color: 'var(--danger)' }}>{totalQty}</td>
                <td />
                <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--danger)', padding: '10px 11px' }}>-{totalAmt.toLocaleString()}원</td>
                <td />
                {isApprover && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
