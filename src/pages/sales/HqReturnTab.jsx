import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

// 매장 → 반품 접수 → [본사 반품]
//  파손·유통기한·본사요청 등 사유로 재고를 본사에 반품신청.
//  바코드 스캔(같은 상품 3번 = 3개) 또는 상품명 검색으로 담고, 사유 택일 후 [반품신청].
const REASONS = [
  { key: '파손',     label: '제품 파손' },
  { key: '유통기한', label: '유통기한 임박 / 만료' },
  { key: '본사요청', label: '본사 요청' },
  { key: '기타',     label: '기타' },
];

export default function HqReturnTab({ profile }) {
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore, setHqStore]   = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const branchOpts = useMemo(() => (hqStore ? (STORE_MAP[hqStore] || []) : []), [hqStore]);

  const [products, setProducts] = useState([]);
  const [items, setItems]   = useState([]); // {product_id, code, name, qty}
  const [search, setSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const [reason, setReason] = useState('');
  const [memo, setMemo]     = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const [myReturns, setMyReturns] = useState([]);
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => {
    supabase.from('products').select('id, name, code, is_sales_stopped').order('name')
      .then(({ data }) => setProducts(data || []));
  }, []);

  // 내 매장 반품 신청 내역
  const fetchMyReturns = useCallback(async () => {
    if (!storeName || !branchName) { setMyReturns([]); return; }
    const { data } = await supabase.from('store_returns')
      .select('*').eq('store_name', storeName).eq('branch_name', branchName)
      .order('created_at', { ascending: false }).limit(50);
    setMyReturns(data || []);
  }, [storeName, branchName]);
  useEffect(() => { fetchMyReturns(); }, [fetchMyReturns]);

  // 택배 출고 완료 → 반품완료 + 매장재고 차감
  const completeReturn = async (r) => {
    if (r.status === 'completed') return;
    if (!window.confirm(`${r.product_name} ${r.quantity}개\n택배 출고 완료로 처리하고 매장재고에서 차감하시겠습니까?`)) return;
    setCompletingId(r.id);
    try {
      if (r.product_code) {
        const { data: st } = await supabase.from('store_stock')
          .select('id, stock_qty')
          .eq('store_name', r.store_name).eq('branch_name', r.branch_name).eq('product_code', r.product_code)
          .maybeSingle();
        if (st) {
          await supabase.from('store_stock')
            .update({ stock_qty: Math.max(0, (st.stock_qty || 0) - (r.quantity || 0)), updated_at: new Date().toISOString() })
            .eq('id', st.id);
        }
      }
      const { error } = await supabase.from('store_returns')
        .update({ status: 'completed', completed_at: new Date().toISOString(), completed_by: profile?.id || null })
        .eq('id', r.id);
      if (error) throw error;
      toast('반품완료 — 매장재고에서 차감됐습니다', 'ok');
      fetchMyReturns();
    } catch (err) {
      toast('반품완료 처리 실패: ' + (err.message || err), 'err');
    }
    setCompletingId(null);
  };

  const addProduct = (p) => {
    setItems(prev => {
      const i = prev.findIndex(x => x.product_id === p.id);
      if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; }
      return [...prev, { product_id: p.id, code: p.code || '', name: p.name, qty: 1 }];
    });
  };

  // 바코드 스캔/직접입력 — Enter 시 코드 일치 상품을 담음(같은 상품 반복 = 수량 증가)
  const onScanEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = search.trim();
    if (!code) return;
    const matched = products.find(p => String(p.code || '').trim() === code);
    if (matched) {
      addProduct(matched);
      setSearch(''); setShowSug(false);
      inputRef.current?.focus();
    } else {
      // 코드 완전일치 없으면 이름/코드 부분일치 1건이면 담고, 아니면 안내
      const cands = suggestions;
      if (cands.length === 1) { addProduct(cands[0]); setSearch(''); setShowSug(false); }
      else toast(`상품을 찾지 못했습니다 — "${code}"`, 'err');
    }
  };

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, products]);

  const setQty = (pid, v) => setItems(prev => prev.map(x => x.product_id === pid ? { ...x, qty: Math.max(1, Number(v) || 1) } : x));
  const removeItem = (pid) => setItems(prev => prev.filter(x => x.product_id !== pid));

  const totalQty = items.reduce((s, x) => s + (Number(x.qty) || 0), 0);

  const submit = async () => {
    if (!storeName || !branchName) { toast('점포·지점을 선택해주세요', 'err'); return; }
    if (items.length === 0) { toast('반품할 상품을 스캔/추가해주세요', 'err'); return; }
    if (!reason) { toast('반품 사유를 선택해주세요', 'err'); return; }
    const reasonLabel = REASONS.find(r => r.key === reason)?.label || reason;
    if (!window.confirm(`${storeName} ${branchName}\n${items.length}개 품목 · 총 ${totalQty}개\n사유: ${reasonLabel}\n\n본사에 반품신청하시겠습니까?`)) return;
    setSaving(true);
    const now = new Date().toISOString();
    const rows = items.map(x => ({
      store_name: storeName, branch_name: branchName,
      product_id: x.product_id, product_code: x.code, product_name: x.name,
      quantity: Number(x.qty) || 1, reason, memo: memo.trim() || null,
      status: 'pending', created_by: profile?.id || null, created_at: now,
    }));
    const { error } = await supabase.from('store_returns').insert(rows);
    setSaving(false);
    if (error) { toast('반품신청 실패: ' + error.message, 'err'); return; }
    toast(`반품신청 완료 — ${items.length}품목 / ${totalQty}개`, 'ok');
    setItems([]); setReason(''); setMemo(''); setSearch('');
    inputRef.current?.focus();
    fetchMyReturns();
  };

  const inputStyle = { width: '100%', height: 42, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6d4c41', lineHeight: 1.8 }}>
        ↩️ 파손·유통기한 임박/만료 등으로 <strong>재고를 본사에 반품신청</strong>합니다.<br/>
        바코드 스캐너로 상품을 스캔하세요. <strong>같은 상품을 여러 번 스캔하면 수량이 늘어납니다.</strong>
      </div>

      {/* 본사 계정: 점포/지점 선택 */}
      {!isStoreMgr && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select className="fsel" value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }} style={{ ...inputStyle, height: 38, width: 180 }}>
            <option value="">점포 선택</option>
            {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="fsel" value={hqBranch} onChange={e => setHqBranch(e.target.value)} disabled={!hqStore} style={{ ...inputStyle, height: 38, width: 180 }}>
            <option value="">{hqStore ? '지점 선택' : '점포 먼저'}</option>
            {branchOpts.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontFamily: 'var(--mono)' }}>📍 {storeName || '(점포 미선택)'} {branchName || ''}</div>

        {/* 스캔/검색 */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <input ref={inputRef} value={search} autoFocus
            onChange={e => { setSearch(e.target.value); setShowSug(true); }}
            onKeyDown={onScanEnter}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 200)}
            style={inputStyle} placeholder="🔍 바코드 스캔 또는 상품명·코드 검색" autoComplete="off" />
          {showSug && suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto', marginTop: 2 }}>
              {suggestions.map(p => (
                <div key={p.id} onMouseDown={e => { e.preventDefault(); addProduct(p); setSearch(''); setShowSug(false); inputRef.current?.focus(); }}
                  style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0f0f0' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fffde7'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  {p.name}
                  {p.code && <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 8 }}>{p.code}</span>}
                  {p.is_sales_stopped && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', marginLeft: 6 }}>판매중지</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 담긴 품목 */}
        <div className="twrap" style={{ marginBottom: 14 }}>
          <table>
            <thead><tr><th>상품명</th><th style={{ width: 120 }}>코드</th><th className="r" style={{ width: 110 }}>수량</th><th style={{ width: 50 }}></th></tr></thead>
            <tbody>
              {items.length === 0
                ? <tr><td colSpan={4} className="empty">스캔/검색으로 반품 상품을 담아주세요</td></tr>
                : items.map(x => (
                  <tr key={x.product_id}>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{x.name}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{x.code || '-'}</td>
                    <td className="r">
                      <input type="number" min={1} value={x.qty} onChange={e => setQty(x.product_id, e.target.value)}
                        style={{ width: 70, height: 30, padding: '0 6px', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" onClick={() => removeItem(x.product_id)}
                        style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, background: '#fff', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* 반품 사유 (필수) */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>반품 사유 <span style={{ color: 'var(--danger)', fontSize: 12 }}>*필수</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REASONS.map(r => (
              <button key={r.key} type="button" onClick={() => setReason(r.key)}
                style={{ height: 40, padding: '0 16px', borderRadius: 'var(--radius)', border: '2px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  borderColor: reason === r.key ? 'var(--accent)' : 'var(--border)',
                  background: reason === r.key ? '#fff3e0' : '#fff',
                  color: reason === r.key ? 'var(--accent)' : 'var(--text2)' }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 메모(선택) */}
        <input value={memo} onChange={e => setMemo(e.target.value)} style={{ ...inputStyle, height: 38, marginBottom: 14 }} placeholder="메모 (선택 — 기타 사유 상세 등)" />

        <button type="button" onClick={submit} disabled={saving}
          style={{ width: '100%', height: 46, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? '처리 중…' : `↩️ 반품신청 (${items.length}품목 / ${totalQty}개)`}
        </button>
      </div>

      {/* 내 반품 신청 내역 */}
      <div className="card" style={{ padding: '16px 18px', marginTop: 14 }}>
        <div className="card-label">📋 반품 신청 내역</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>택배로 본사에 발송한 뒤 <b>[반품완료]</b>를 누르면 매장재고에서 차감됩니다.</div>
        {myReturns.length === 0 ? <div className="empty">신청 내역이 없습니다</div> : (
          <div className="twrap">
            <table>
              <thead><tr><th style={{ width: 70 }}>신청일</th><th>상품</th><th className="r" style={{ width: 50 }}>수량</th><th style={{ width: 110 }}>사유</th><th style={{ width: 90, textAlign: 'center' }}>상태</th><th style={{ width: 90, textAlign: 'center' }}></th></tr></thead>
              <tbody>
                {myReturns.map(r => (
                  <tr key={r.id} style={r.status === 'completed' ? { background: '#fafafa' } : {}}>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text2)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}</td>
                    <td style={{ fontSize: 12 }}>{r.product_name}</td>
                    <td className="r" style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{r.quantity}</td>
                    <td style={{ fontSize: 11 }}>{REASONS.find(x => x.key === r.reason)?.label || r.reason}</td>
                    <td style={{ textAlign: 'center' }}>
                      {r.status === 'completed' ? <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', fontSize: 11 }}>반품완료</span>
                        : r.status === 'confirmed' ? <span className="badge" style={{ background: '#e3f2fd', color: '#1565C0', border: '1px solid #90caf9', fontSize: 11 }}>본사확인</span>
                          : <span className="badge" style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', fontSize: 11 }}>신청</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {r.status !== 'completed' && (
                        <button type="button" onClick={() => completeReturn(r)} disabled={completingId === r.id}
                          style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, border: '1px solid #2e7d32', borderRadius: 4, background: '#e8f5e9', color: '#2e7d32', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {completingId === r.id ? '…' : '반품완료'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
