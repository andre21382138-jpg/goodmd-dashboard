import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, formatPhone } from '../../lib/utils';
import { CLAIM_TYPES } from '../../lib/constants';

// 교환·증정 조치 (환불은 반품 탭에서 처리 → 여기서 제외)
// purchased=회수한 구매상품 재고 증감, needEx=다른상품(교환) 선택, needGift=서비스증정 선택
const ACTIONS = [
  { key: '동일상품 교환',              purchased: 0,  needEx: false, needGift: false },
  { key: '동일상품 교환 + 서비스증정',  purchased: 0,  needEx: false, needGift: true  },
  { key: '다른상품 교환',              purchased: +1, needEx: true,  needGift: false },
  { key: '다른상품 교환 + 서비스증정',  purchased: +1, needEx: true,  needGift: true  },
  { key: '서비스증정',                 purchased: 0,  needEx: false, needGift: true  },
  { key: '본사처리필요',               purchased: 0,  needEx: false, needGift: false },
];
const deriveStatus = (at) => at === '본사처리필요' ? '본사확인' : at ? '완료' : '접수';

const emptyForm = () => ({
  worker_name: '', customer_name: '', customer_phone: '', customer_id: null,
  product_name: '', product_code: '', claim_type: '', claim_type_custom: '',
  claim_detail: '', action_type: '',
  exchange_product_name: '', exchange_product_code: '', gift_product_name: '', gift_product_code: '', action_detail: '',
});

const inputStyle = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 };

export default function ExchangeGiftTab({ profile, storeName, branchName }) {
  const canWork = !!storeName && !!branchName;

  const [form, setForm]     = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [workers, setWorkers] = useState([]);

  // 조치상품 선택 팝업
  const [actModal, setActModal] = useState(null); // { action, prev }
  const [tEx, setTEx]     = useState({ name: '', code: '' });
  const [tGift, setTGift] = useState({ name: '', code: '' });
  // 구매상품 선택 팝업
  const [prodModal, setProdModal] = useState(false);
  const [tProd, setTProd] = useState({ name: '', code: '' });
  // 회원 조회 팝업
  const [custModal, setCustModal]   = useState(false);
  const [custQuery, setCustQuery]   = useState('');
  const [custResults, setCustResults] = useState([]);
  const [custSearching, setCustSearching] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const curAction = ACTIONS.find(a => a.key === form.action_type);

  // 근무자
  const fetchWorkers = useCallback(async () => {
    if (!storeName || !branchName) { setWorkers([]); return; }
    const { data } = await supabase.from('store_members')
      .select('id, name, display_name, job_title, store:profiles!store_account_id(department, branch)');
    const list = (data || [])
      .filter(m => m.store?.department === storeName && m.store?.branch === branchName)
      .sort((a, b) => { const r = t => t === '매니저' ? 0 : t === '부매니저' ? 1 : 2; return r(a.job_title) - r(b.job_title); });
    setWorkers(list);
  }, [storeName, branchName]);
  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  // 회원 조회
  const openCustModal = () => { setCustModal(true); setCustQuery(''); setCustResults([]); };
  useEffect(() => {
    if (!custModal) return;
    const q = custQuery.trim();
    if (q.length < 2) { setCustResults([]); return; }
    setCustSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('customers')
        .select('id, name, phone, store_name, branch_name').or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(30);
      if (cancelled) return;
      setCustResults(data || []); setCustSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [custQuery, custModal]);
  const pickCustomer = (c) => { setForm(f => ({ ...f, customer_name: c.name || '', customer_phone: c.phone || '', customer_id: c.id })); setCustModal(false); };

  // 상품 바코드 조회
  const findProduct = async (code) => {
    const c = String(code || '').trim(); if (!c) return null;
    let { data } = await supabase.from('products').select('name, code').eq('code', c).limit(1);
    if (!data || data.length === 0) ({ data } = await supabase.from('products').select('name, code').eq('erp_code', c).limit(1));
    return data?.[0] ? { name: data[0].name, code: data[0].code || c } : { name: '', code: c, notFound: true };
  };
  const openProdModal = () => { setTProd({ name: form.product_name, code: form.product_code }); setProdModal(true); };
  const confirmProdModal = () => { setForm(f => ({ ...f, product_name: tProd.name.trim(), product_code: tProd.code.trim() })); setProdModal(false); };

  // 조치내용 선택 → 상품필요 시 팝업
  const onActionChange = (val) => {
    const a = ACTIONS.find(x => x.key === val);
    const prev = form.action_type;
    setForm(f => ({
      ...f, action_type: val,
      exchange_product_name: a?.needEx ? f.exchange_product_name : '', exchange_product_code: a?.needEx ? f.exchange_product_code : '',
      gift_product_name: a?.needGift ? f.gift_product_name : '', gift_product_code: a?.needGift ? f.gift_product_code : '',
    }));
    if (a && (a.needEx || a.needGift)) {
      setTEx({ name: a.needEx ? form.exchange_product_name : '', code: a.needEx ? form.exchange_product_code : '' });
      setTGift({ name: a.needGift ? form.gift_product_name : '', code: a.needGift ? form.gift_product_code : '' });
      setActModal({ action: val, prev });
    }
  };
  const confirmActModal = () => {
    const a = ACTIONS.find(x => x.key === actModal.action);
    if (a.needEx && !tEx.code) { toast('교환할 다른상품을 바코드로 스캔해주세요', 'err'); return; }
    if (a.needGift && !tGift.code) { toast('서비스증정 상품을 바코드로 스캔해주세요', 'err'); return; }
    setForm(f => ({
      ...f,
      exchange_product_name: a.needEx ? tEx.name : '', exchange_product_code: a.needEx ? tEx.code : '',
      gift_product_name: a.needGift ? tGift.name : '', gift_product_code: a.needGift ? tGift.code : '',
    }));
    setActModal(null);
  };
  const cancelActModal = () => {
    setForm(f => ({ ...f, action_type: actModal.prev,
      exchange_product_name: '', exchange_product_code: '', gift_product_name: '', gift_product_code: '' }));
    setActModal(null);
  };
  const scanInto = async (code, setter) => {
    const p = await findProduct(code); if (!p) return;
    setter({ name: p.name, code: p.code });
    if (p.notFound) toast('상품관리에 없는 코드입니다', 'err'); else toast(`인식: ${p.name}`, 'ok');
  };

  // 재고 이동
  const buildMovements = (f) => {
    const a = ACTIONS.find(x => x.key === f.action_type); const mv = [];
    if (!a) return mv;
    if (a.purchased && f.product_code) mv.push({ code: f.product_code.trim(), name: f.product_name, delta: a.purchased });
    if (a.needEx && f.exchange_product_code) mv.push({ code: f.exchange_product_code.trim(), name: f.exchange_product_name, delta: -1 });
    if (a.needGift && f.gift_product_code) mv.push({ code: f.gift_product_code.trim(), name: f.gift_product_name, delta: -1 });
    return mv;
  };
  const applyStock = async (movements, sName, bName) => {
    for (const m of (movements || [])) {
      if (!m.code || !m.delta) continue;
      const { data: row } = await supabase.from('store_stock').select('id, stock_qty')
        .eq('store_name', sName).eq('branch_name', bName).eq('product_code', m.code).maybeSingle();
      if (row) await supabase.from('store_stock').update({ stock_qty: (row.stock_qty || 0) + m.delta, updated_at: new Date().toISOString() }).eq('id', row.id);
      else await supabase.from('store_stock').insert({ store_name: sName, branch_name: bName, product_code: m.code, product_name: m.name || null, stock_qty: m.delta, updated_at: new Date().toISOString() });
    }
  };

  const resetForm = () => setForm(emptyForm());

  const save = async () => {
    if (!canWork) { toast('점포·지점을 먼저 선택해주세요', 'err'); return; }
    if (!form.worker_name) { toast('근무자를 선택해주세요', 'err'); return; }
    const claimType = form.claim_type === '직접입력' ? form.claim_type_custom.trim() : form.claim_type;
    if (!claimType) { toast('클레임유형을 선택(또는 입력)해주세요', 'err'); return; }
    if (!form.action_type) { toast('조치내용을 선택해주세요', 'err'); return; }
    const a = curAction;
    if (a) {
      if (a.purchased !== 0 && !form.product_code.trim()) { toast('구매상품을 바코드로 지정해야 재고(+)가 반영됩니다', 'err'); return; }
      if (a.needEx && !form.exchange_product_code.trim()) { toast('교환할 다른상품을 선택해주세요', 'err'); return; }
      if (a.needGift && !form.gift_product_code.trim()) { toast('서비스증정 상품을 선택해주세요', 'err'); return; }
    }
    setSaving(true);
    const movements = buildMovements(form);
    const row = {
      store_name: storeName, branch_name: branchName, worker_name: form.worker_name,
      customer_name: form.customer_name.trim() || null, customer_phone: form.customer_phone.trim() || null, customer_id: form.customer_id,
      product_name: form.product_name.trim() || null, product_code: form.product_code.trim() || null,
      claim_type: claimType, claim_detail: form.claim_detail.trim() || null, status: deriveStatus(form.action_type),
      action_type: form.action_type || null,
      exchange_product_name: form.exchange_product_name.trim() || null, exchange_product_code: form.exchange_product_code.trim() || null,
      gift_product_name: form.gift_product_name.trim() || null, gift_product_code: form.gift_product_code.trim() || null,
      action_detail: form.action_detail.trim() || null, stock_movements: movements, source: '교환·증정',
    };
    try {
      const { error } = await supabase.from('store_claims').insert({ ...row, created_by: profile?.id || null });
      if (error) throw error;
      await applyStock(movements, storeName, branchName);
      toast('교환·증정 접수 완료', 'ok');
      resetForm();
    } catch (err) { toast('저장 실패: ' + (err.message || err), 'err'); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <div className="card-label">🔄 교환·증정 접수
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>📍 {storeName || '-'} {branchName || ''}</span>
      </div>
      <div style={{ background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6a1b9a' }}>
        💡 교환·서비스증정·본사처리 접수 — 저장 시 매장재고가 자동 반영되고 <b>클레임 현황</b>에 기록됩니다.
        <b> 환불(반품)은 [회원반품]/[비회원반품] 탭에서</b> 처리하세요(매출·적립금까지 반영).
      </div>

      {!canWork && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>※ 점포·지점을 선택하면 접수가 가능합니다</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, opacity: canWork ? 1 : 0.5, pointerEvents: canWork ? 'auto' : 'none' }}>
        <div>
          <label style={labelStyle}>근무자 *</label>
          <select value={form.worker_name} onChange={e => update('worker_name', e.target.value)} style={inputStyle}>
            <option value="">근무자 선택</option>
            {workers.map(w => <option key={w.id} value={w.display_name || w.name}>{(w.display_name || w.name)}{w.job_title ? ` (${w.job_title})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>클레임유형 *</label>
          <select value={form.claim_type} onChange={e => update('claim_type', e.target.value)} style={inputStyle}>
            <option value="">유형 선택</option>{CLAIM_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          {form.claim_type === '직접입력' && <input value={form.claim_type_custom} onChange={e => update('claim_type_custom', e.target.value)} placeholder="클레임유형 직접 입력" style={{ ...inputStyle, marginTop: 6 }} />}
        </div>
        <div>
          <label style={labelStyle}>고객명</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="고객명 (비회원은 직접 입력)" style={inputStyle} />
            <button type="button" onClick={openCustModal} title="회원 조회" style={{ flexShrink: 0, width: 42, border: '1px solid var(--accent)', borderRadius: 'var(--radius)', background: '#fff3e0', color: 'var(--accent)', cursor: 'pointer', fontSize: 15 }}>🔍</button>
          </div>
        </div>
        <div>
          <label style={labelStyle}>고객연락처</label>
          <input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="010-0000-0000" style={inputStyle} inputMode="numeric" />
        </div>

        {/* 구매상품명 (팝업 선택) */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>구매상품명 (회수상품)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={openProdModal} style={{ height: 38, padding: '0 14px', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', background: '#fff3e0', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📷 구매상품 선택하기</button>
            {form.product_name
              ? <span style={{ fontSize: 13 }}><b>{form.product_name}</b>{form.product_code && <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', marginLeft: 6 }}>코드: {form.product_code}</span>}</span>
              : <span style={{ fontSize: 12, color: 'var(--text3)' }}>선택된 상품 없음</span>}
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>상세내용</label>
          <textarea value={form.claim_detail} onChange={e => update('claim_detail', e.target.value)} rows={2} placeholder="클레임 상세 내용" style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
        </div>

        {/* 조치내용 */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>조치내용 *</label>
          <select value={form.action_type} onChange={e => onActionChange(e.target.value)} style={{ ...inputStyle, maxWidth: 360 }}>
            <option value="">조치 선택</option>{ACTIONS.map(a => <option key={a.key}>{a.key}</option>)}
          </select>
          {(form.exchange_product_name || form.gift_product_name) && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text2)' }}>
              {form.exchange_product_name && <span style={{ marginRight: 10 }}>🔄 교환: <b>{form.exchange_product_name}</b></span>}
              {form.gift_product_name && <span>🎁 증정: <b>{form.gift_product_name}</b></span>}
              <button type="button" onClick={() => onActionChange(form.action_type)} style={{ marginLeft: 8, fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, background: '#fff', padding: '1px 8px', cursor: 'pointer' }}>상품 다시 선택</button>
            </div>
          )}
          {curAction && (curAction.purchased !== 0 || curAction.needEx || curAction.needGift) && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#6a1b9a', background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
              💡 저장 시 재고 반영:{curAction.purchased > 0 && ` 회수상품 +${curAction.purchased}`}{curAction.needEx && ' · 교환상품 −1'}{curAction.needGift && ' · 증정상품 −1'}
            </div>
          )}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>조치 비고 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(선택)</span></label>
          <textarea value={form.action_detail} onChange={e => update('action_detail', e.target.value)} rows={2} placeholder="추가 메모 (선택)" style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn btn-p" onClick={save} disabled={saving || !canWork} style={{ height: 42, padding: '0 28px', fontSize: 14, fontWeight: 700 }}>
          {saving ? <span className="spinner" /> : '✓ 접수 저장'}
        </button>
      </div>

      {/* 구매상품 선택 팝업 */}
      {prodModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setProdModal(false)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: 'min(460px, 94vw)', padding: '22px 24px', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📷 구매상품 선택</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>바코드로 스캔하거나 상품명을 직접 입력하세요</div>
            <label style={labelStyle}>바코드 스캔</label>
            <input autoFocus placeholder="📷 바코드 스캔 후 Enter"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scanInto(e.currentTarget.value, setTProd); e.currentTarget.value = ''; } }}
              style={{ ...inputStyle, border: '2px solid var(--accent)', marginBottom: 12 }} />
            <label style={labelStyle}>구매상품명</label>
            <input value={tProd.name} onChange={e => setTProd(t => ({ ...t, name: e.target.value }))} placeholder="상품명 (직접 입력 가능)" style={inputStyle} />
            {tProd.code && <div style={{ marginTop: 6, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>코드: {tProd.code}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setProdModal(false)} style={{ height: 40, padding: '0 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={confirmProdModal} style={{ height: 40, padding: '0 24px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 조치상품 선택 팝업 */}
      {actModal && (() => {
        const a = ACTIONS.find(x => x.key === actModal.action);
        const pickerBlock = (title, t, setter) => (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{title}</label>
            <input autoFocus placeholder="📷 바코드 스캔 후 Enter"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scanInto(e.currentTarget.value, setter); e.currentTarget.value = ''; } }}
              style={{ ...inputStyle, border: '2px solid #6a1b9a' }} />
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {t.code ? <><b>{t.name || '(이름없음)'}</b> <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', marginLeft: 6 }}>코드: {t.code}</span></>
                      : <span style={{ color: 'var(--text3)' }}>스캔된 상품 없음</span>}
            </div>
          </div>
        );
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={cancelActModal} />
            <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: 'min(460px, 94vw)', padding: '22px 24px', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🛠️ 조치 상품 선택</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{a.key} — 바코드로 상품을 스캔하세요</div>
              {a.needEx   && pickerBlock('🔄 교환할 다른상품 (재고 −1)', tEx, setTEx)}
              {a.needGift && pickerBlock('🎁 서비스증정 상품 (재고 −1)', tGift, setTGift)}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cancelActModal} style={{ height: 40, padding: '0 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button type="button" onClick={confirmActModal} style={{ height: 40, padding: '0 24px', border: 'none', borderRadius: 'var(--radius)', background: '#6a1b9a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>확인</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 회원 조회 팝업 */}
      {custModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={() => setCustModal(false)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: 'min(480px, 94vw)', maxHeight: '80vh', overflow: 'auto', padding: '20px 22px', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🔍 회원 조회</div>
            <input autoFocus value={custQuery} onChange={e => setCustQuery(e.target.value)} placeholder="이름 또는 연락처 (2자 이상)" style={{ ...inputStyle, marginBottom: 10 }} />
            {custSearching ? <div className="empty"><span className="spinner" /></div>
              : custQuery.trim().length < 2 ? <div style={{ fontSize: 12, color: 'var(--text3)', padding: '10px 2px' }}>이름 또는 연락처를 2자 이상 입력하세요</div>
              : custResults.length === 0 ? <div className="empty">검색 결과가 없습니다</div>
              : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 360, overflowY: 'auto' }}>
                {custResults.map(c => (
                  <div key={c.id} onClick={() => pickCustomer(c)} style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fffde7'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <b>{c.name}</b> <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', marginLeft: 6 }}>{formatPhone(c.phone)}</span>
                    {(c.store_name || c.branch_name) && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{c.store_name} {c.branch_name}</span>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <button type="button" onClick={() => setCustModal(false)} style={{ height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, cursor: 'pointer' }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
