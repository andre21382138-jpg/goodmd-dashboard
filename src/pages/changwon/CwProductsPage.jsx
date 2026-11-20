import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';

const EMPTY = { erp_code: '', product_name: '', out_code: '', out_name: '' };

export default function CwProductsPage() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');
  const [modal, setModal]     = useState(null); // null | {id?, ...form}
  const [saving, setSaving]   = useState(false);
  const [importing, setImporting] = useState(false);

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
    out_code: r.out_code || '', out_name: r.out_name || '' });

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

  // 본사 상품관리(products) 판매중 상품과 제품현황을 '동일'하게 동기화
  //  ① 매칭 상품명을 본사 기준으로 통일  ② 본사 판매중에 없는 창원 전용 상품 삭제
  //     (단, 현재고≠0 또는 입출고 이력이 있으면 보존)  ③ 누락된 본사 상품 추가
  const syncFromHq = async () => {
    if (importing) return;
    if (!window.confirm('제품현황을 본사 판매중 상품과 동일하게 맞춥니다.\n\n· 상품명을 본사 기준으로 통일\n· 본사 판매중에 없는 창원 전용 상품은 삭제\n  (현재고·입출고 이력이 있는 상품은 안전하게 남깁니다)\n· 누락된 본사 상품 추가\n\n계속할까요?')) return;
    setImporting(true);
    const norm = (s) => (s || '').trim();
    const base = (s) => norm(s).split('_')[0];

    // 1) 본사 판매중
    const { data: hq, error } = await supabase.from('products')
      .select('name, code, erp_code').eq('is_sales_stopped', false);
    if (error) { toast('본사 상품 조회 실패: ' + error.message, 'err'); setImporting(false); return; }
    // 안전가드: 본사 조회 0건이면(권한 문제 등) 전부 삭제 사고 방지 — 중단
    if (!hq || hq.length === 0) { toast('본사 상품을 불러오지 못했습니다(0건). 안전을 위해 중단합니다.', 'err'); setImporting(false); return; }

    // 2) 창원 제품 전체 + 3) 입출고 이력 보유 id
    const [{ data: cw }, { data: inb }, { data: outb }] = await Promise.all([
      supabase.from('cw_products').select('id, erp_code, product_name, opening_stock, sort_no'),
      supabase.from('cw_inbound').select('product_id'),
      supabase.from('cw_outbound').select('product_id'),
    ]);
    const hasHistory = new Set([...(inb || []), ...(outb || [])].map(r => r.product_id));

    // 본사 상품 키 인덱스 (erp_code / base / code)
    const hqByKey = new Map();
    const hqId = (p) => norm(p.erp_code) || norm(p.code);
    for (const p of hq) {
      [norm(p.erp_code), base(p.erp_code), norm(p.code), base(p.code)].forEach(k => { if (k && !hqByKey.has(k)) hqByKey.set(k, p); });
    }
    const matchHq = (row) => {
      const e = norm(row.erp_code);
      return hqByKey.get(e) || hqByKey.get(base(e)) || null;
    };

    const renameUpdates = [];
    const deleteIds = [];
    const matchedHq = new Set();
    let kept = 0;
    for (const row of (cw || [])) {
      const m = matchHq(row);
      if (m) {
        matchedHq.add(hqId(m));
        if (norm(row.product_name) !== norm(m.name)) renameUpdates.push({ id: row.id, name: m.name });
      } else {
        const protectedRow = (row.opening_stock || 0) !== 0 || hasHistory.has(row.id);
        if (protectedRow) kept++; else deleteIds.push(row.id);
      }
    }

    // 누락된 본사 상품 추가
    let maxSort = (cw || []).reduce((mx, r) => Math.max(mx, r.sort_no || 0), 0);
    const seen = new Set();
    const inserts = [];
    for (const p of hq) {
      const id = hqId(p);
      if (!id || matchedHq.has(id) || seen.has(id)) continue;
      seen.add(id);
      maxSort += 1;
      inserts.push({ erp_code: norm(p.erp_code) || norm(p.code) || null, product_name: p.name || null, sort_no: maxSort });
    }

    // 실행
    try {
      for (const u of renameUpdates) {
        const { error: eu } = await supabase.from('cw_products').update({ product_name: u.name }).eq('id', u.id);
        if (eu) throw eu;
      }
      if (deleteIds.length) {
        const { error: ed } = await supabase.from('cw_products').delete().in('id', deleteIds);
        if (ed) throw ed;
      }
      if (inserts.length) {
        const { error: ei } = await supabase.from('cw_products').insert(inserts);
        if (ei) throw ei;
      }
    } catch (err) {
      setImporting(false);
      toast('동기화 중 오류: ' + (err.message || err), 'err');
      fetchRows();
      return;
    }
    setImporting(false);
    toast(`동기화 완료 — 추가 ${inserts.length} · 이름통일 ${renameUpdates.length} · 삭제 ${deleteIds.length} · 보존 ${kept}`, 'ok');
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
        <input className="finput" placeholder="ERP코드·상품명 검색" value={q} onChange={e => setQ(e.target.value)} />
        <div className="fbar-right">
          <span className="fresult">제품 <b>{filtered.length}</b></span>
          <button className="btn btn-s" onClick={syncFromHq} disabled={importing}>
            {importing ? '동기화 중…' : '🔄 본사와 동기화'}
          </button>
          <button className="btn btn-p" onClick={openAdd}>➕ 제품 추가</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="twrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44 }}>NO</th>
                <th>ERP코드</th>
                <th>상품명</th>
                <th>출고코드</th>
                <th>출고코드 상품명</th>
                <th style={{ width: 110 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty"><span className="spinner" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty">제품이 없습니다</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{r.sort_no}</td>
                  <td className="mono">{r.erp_code || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{r.product_name || <span style={{ color: 'var(--text3)' }}>(이름 없음)</span>}</td>
                  <td className="mono">{r.out_code || ''}</td>
                  <td style={{ color: 'var(--text2)' }}>{r.out_name || ''}</td>
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
              <label>ERP코드</label>
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
