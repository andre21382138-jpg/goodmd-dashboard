import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob, formatPhone } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

const CLAIM_TYPES = ['품질불만(맛)', '품질불만(냄새)', '품질불만(캡슐터짐)', '품질불만(분말굳음)', '효능불만', '가격불만', '섭취후이상', '직접입력'];

// 조치내용 — purchased=구매상품 재고 증감, needEx=다른상품(교환) 선택, needGift=서비스증정 선택
const ACTIONS = [
  { key: '환불',                    purchased: +1, needEx: false, needGift: false },
  { key: '동일상품 교환',             purchased: 0,  needEx: false, needGift: false },
  { key: '동일상품 교환 + 서비스증정',  purchased: 0,  needEx: false, needGift: true  },
  { key: '다른상품 교환',             purchased: +1, needEx: true,  needGift: false },
  { key: '다른상품 교환 + 서비스증정',  purchased: +1, needEx: true,  needGift: true  },
  { key: '본사처리필요',              purchased: 0,  needEx: false, needGift: false },
];
const deriveStatus = (at) => at === '본사처리필요' ? '본사확인' : at ? '완료' : '접수';

const emptyForm = () => ({
  worker_name: '', customer_name: '', customer_phone: '', customer_id: null,
  product_name: '', product_code: '', claim_type: '', claim_type_custom: '',
  claim_detail: '', action_type: '',
  exchange_product_name: '', exchange_product_code: '', gift_product_name: '', gift_product_code: '', action_detail: '',
});

const inputStyle = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, outline: 'none' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function ClaimIntakePage({ profile }) {
  const isStoreMgr = profile?.job_title === '매니저';
  const isHQ = !isStoreMgr;  // 본사/관리자 — 전 매장 조회

  // 필터
  const [fStore, setFStore]     = useState(isStoreMgr ? profile.department : '');
  const [fBranch, setFBranch]   = useState(isStoreMgr ? profile.branch : '');
  const [fFrom, setFFrom]       = useState(daysAgo(30));
  const [fTo, setFTo]           = useState(todayStr());
  const [fProduct, setFProduct] = useState('');
  const [fOnlyHQ, setFOnlyHQ]   = useState(false);
  const branchOpts = useMemo(() => (fStore ? (STORE_MAP[fStore] || []) : []), [fStore]);

  const [claims, setClaims]   = useState([]);
  const [loading, setLoading] = useState(false);

  // 입력/수정 (매니저=자기매장, 본사=수정 시 해당 클레임 매장 컨텍스트)
  const [form, setForm]       = useState(emptyForm());
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving]   = useState(false);
  const inputStore  = editRow ? editRow.store_name  : (isStoreMgr ? profile.department : '');
  const inputBranch = editRow ? editRow.branch_name : (isStoreMgr ? profile.branch : '');
  const showForm = isStoreMgr || !!editRow;

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
    if (!inputStore || !inputBranch) { setWorkers([]); return; }
    const { data } = await supabase.from('store_members')
      .select('id, name, display_name, job_title, store:profiles!store_account_id(department, branch)');
    const list = (data || [])
      .filter(m => m.store?.department === inputStore && m.store?.branch === inputBranch)
      .sort((a, b) => { const r = t => t === '매니저' ? 0 : t === '부매니저' ? 1 : 2; return r(a.job_title) - r(b.job_title); });
    setWorkers(list);
  }, [inputStore, inputBranch]);
  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  // 목록 조회 (필터)
  const fetchClaims = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('store_claims').select('*');
    if (fStore)   q = q.eq('store_name', fStore);
    if (fBranch)  q = q.eq('branch_name', fBranch);
    if (fFrom)    q = q.gte('created_at', `${fFrom}T00:00:00`);
    if (fTo)      q = q.lte('created_at', `${fTo}T23:59:59`);
    if (fProduct.trim()) q = q.ilike('product_name', `%${fProduct.trim()}%`);
    if (fOnlyHQ)  q = q.eq('action_type', '본사처리필요');
    const { data, error } = await q.order('created_at', { ascending: false }).limit(500);
    if (error) toast('조회 실패: ' + error.message, 'err');
    setClaims(data || []);
    setLoading(false);
  }, [fStore, fBranch, fFrom, fTo, fProduct, fOnlyHQ]);
  useEffect(() => { fetchClaims(); /* eslint-disable-next-line */ }, []);  // 최초 1회

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
    // 상품 미지정 → 이전 조치내용으로 되돌림
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
  const reverseStock = (movements, s, b) => applyStock((movements || []).map(m => ({ ...m, delta: -m.delta })), s, b);

  const resetForm = () => { setForm(emptyForm()); setEditRow(null); };

  const save = async () => {
    if (!inputStore || !inputBranch) { toast('점포 정보가 없습니다', 'err'); return; }
    if (!form.worker_name) { toast('근무자를 선택해주세요', 'err'); return; }
    const claimType = form.claim_type === '직접입력' ? form.claim_type_custom.trim() : form.claim_type;
    if (!claimType) { toast('클레임유형을 선택(또는 입력)해주세요', 'err'); return; }
    const a = curAction;
    if (a) {
      if (a.purchased !== 0 && !form.product_code.trim()) { toast('구매상품을 바코드로 지정해야 재고(+)가 반영됩니다', 'err'); return; }
      if (a.needEx && !form.exchange_product_code.trim()) { toast('교환할 다른상품을 선택해주세요', 'err'); return; }
      if (a.needGift && !form.gift_product_code.trim()) { toast('서비스증정 상품을 선택해주세요', 'err'); return; }
    }
    setSaving(true);
    const movements = buildMovements(form);
    const row = {
      store_name: inputStore, branch_name: inputBranch, worker_name: form.worker_name,
      customer_name: form.customer_name.trim() || null, customer_phone: form.customer_phone.trim() || null, customer_id: form.customer_id,
      product_name: form.product_name.trim() || null, product_code: form.product_code.trim() || null,
      claim_type: claimType, claim_detail: form.claim_detail.trim() || null, status: deriveStatus(form.action_type),
      action_type: form.action_type || null,
      exchange_product_name: form.exchange_product_name.trim() || null, exchange_product_code: form.exchange_product_code.trim() || null,
      gift_product_name: form.gift_product_name.trim() || null, gift_product_code: form.gift_product_code.trim() || null,
      action_detail: form.action_detail.trim() || null, stock_movements: movements,
    };
    try {
      if (editRow) {
        await reverseStock(editRow.stock_movements, editRow.store_name, editRow.branch_name);
        const { error } = await supabase.from('store_claims').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editRow.id);
        if (error) throw error;
        await applyStock(movements, inputStore, inputBranch);
      } else {
        const { error } = await supabase.from('store_claims').insert({ ...row, created_by: profile?.id || null });
        if (error) throw error;
        await applyStock(movements, inputStore, inputBranch);
      }
      toast(editRow ? '수정 완료' : '클레임 접수 완료', 'ok');
      resetForm(); fetchClaims();
    } catch (err) { toast('저장 실패: ' + (err.message || err), 'err'); }
    finally { setSaving(false); }
  };

  const startEdit = (c) => {
    const known = CLAIM_TYPES.includes(c.claim_type);
    setForm({
      worker_name: c.worker_name || '', customer_name: c.customer_name || '', customer_phone: c.customer_phone || '', customer_id: c.customer_id || null,
      product_name: c.product_name || '', product_code: c.product_code || '',
      claim_type: known ? c.claim_type : '직접입력', claim_type_custom: known ? '' : (c.claim_type || ''),
      claim_detail: c.claim_detail || '', action_type: c.action_type || '',
      exchange_product_name: c.exchange_product_name || '', exchange_product_code: c.exchange_product_code || '',
      gift_product_name: c.gift_product_name || '', gift_product_code: c.gift_product_code || '', action_detail: c.action_detail || '',
    });
    setEditRow(c);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeClaim = async (c) => {
    if (!window.confirm('이 클레임 접수건을 삭제하시겠습니까?\n(반영된 재고가 있으면 원복됩니다)')) return;
    await reverseStock(c.stock_movements, c.store_name, c.branch_name);
    const { error } = await supabase.from('store_claims').delete().eq('id', c.id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast('삭제 완료 (재고 원복)', 'inf');
    if (editRow?.id === c.id) resetForm();
    fetchClaims();
  };

  const statusColor = (s) => s === '완료' ? { bg: '#e8f5e9', c: '#2e7d32' } : s === '본사확인' ? { bg: '#e3f2fd', c: '#1565c0' } : { bg: '#eceff1', c: '#455a64' };
  const fmtDt = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
  const actionText = (c) => {
    if (!c.action_type) return c.action_detail || '-';
    let t = c.action_type; const ex = [];
    if (c.exchange_product_name) ex.push(`교환:${c.exchange_product_name}`);
    if (c.gift_product_name) ex.push(`증정:${c.gift_product_name}`);
    if (ex.length) t += ` (${ex.join(' / ')})`;
    if (c.action_detail) t += ` · ${c.action_detail}`;
    return t;
  };

  const handleExport = async () => {
    if (claims.length === 0) { toast('내보낼 내역이 없습니다', 'err'); return; }
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('고객 클레임');
    ws.addRow(['접수일시', '점포명', '지점명', '근무자', '고객명', '고객연락처', '구매상품명', '클레임유형', '상세내용', '처리상태', '조치내용']);
    for (const c of claims) {
      ws.addRow([fmtDt(c.created_at), c.store_name, c.branch_name, c.worker_name || '', c.customer_name || '', c.customer_phone || '',
        c.product_name || '', c.claim_type || '', c.claim_detail || '', c.status || deriveStatus(c.action_type), actionText(c)]);
    }
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((col, i) => { col.width = [18, 12, 12, 10, 10, 14, 24, 18, 28, 10, 34][i] || 12; });
    const buf = await wb.xlsx.writeBuffer();
    const now = new Date(); const pad = n => String(n).padStart(2, '0');
    dlBlob(buf, `고객클레임_${String(now.getFullYear()).slice(-2)}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.xlsx`);
    toast(`엑셀 다운로드 완료 (${claims.length}건)`, 'ok');
  };

  return (
    <div>
      {/* 입력 폼 (매니저 / 본사 수정 시) */}
      {showForm && (
        <div className="card">
          <div className="card-label">📣 고객 클레임 {editRow ? '수정' : '접수'}
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>📍 {inputStore || '-'} {inputBranch || ''}</span>
            {editRow && <button type="button" onClick={resetForm} style={{ marginLeft: 10, fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, background: '#fff', padding: '2px 8px', cursor: 'pointer' }}>✕ 수정 취소</button>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
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
              <label style={labelStyle}>구매상품명</label>
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
              <label style={labelStyle}>조치내용</label>
              <select value={form.action_type} onChange={e => onActionChange(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
                <option value="">선택 안 함 (접수만)</option>{ACTIONS.map(a => <option key={a.key}>{a.key}</option>)}
              </select>
              {/* 선택된 조치상품 요약 */}
              {(form.exchange_product_name || form.gift_product_name) && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text2)' }}>
                  {form.exchange_product_name && <span style={{ marginRight: 10 }}>🔄 교환: <b>{form.exchange_product_name}</b></span>}
                  {form.gift_product_name && <span>🎁 증정: <b>{form.gift_product_name}</b></span>}
                  <button type="button" onClick={() => onActionChange(form.action_type)} style={{ marginLeft: 8, fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, background: '#fff', padding: '1px 8px', cursor: 'pointer' }}>상품 다시 선택</button>
                </div>
              )}
              {curAction && (curAction.purchased !== 0 || curAction.needEx || curAction.needGift) && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#6a1b9a', background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
                  💡 저장 시 재고 반영:{curAction.purchased > 0 && ` 구매상품 +${curAction.purchased}`}{curAction.needEx && ' · 교환상품 −1'}{curAction.needGift && ' · 증정상품 −1'}
                </div>
              )}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>조치 비고 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(선택)</span></label>
              <textarea value={form.action_detail} onChange={e => update('action_detail', e.target.value)} rows={2} placeholder="추가 메모 (선택)" style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-p" onClick={save} disabled={saving} style={{ height: 42, padding: '0 28px', fontSize: 14, fontWeight: 700 }}>
              {saving ? <span className="spinner" /> : (editRow ? '✓ 수정 저장' : '✓ 접수 저장')}
            </button>
          </div>
        </div>
      )}

      {/* 필터 + 목록 */}
      <div className="card" style={{ marginTop: showForm ? 14 : 0 }}>
        <div className="fbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {isHQ && (
            <>
              <select value={fStore} onChange={e => { setFStore(e.target.value); setFBranch(''); }} style={{ ...inputStyle, width: 150, height: 34 }}>
                <option value="">전체 점포</option>{STORE_NAMES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={fBranch} onChange={e => setFBranch(e.target.value)} style={{ ...inputStyle, width: 140, height: 34 }} disabled={!fStore}>
                <option value="">전체 지점</option>{branchOpts.map(b => <option key={b}>{b}</option>)}
              </select>
            </>
          )}
          <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} style={{ ...inputStyle, width: 150, height: 34 }} />
          <span>~</span>
          <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} style={{ ...inputStyle, width: 150, height: 34 }} />
          <input value={fProduct} onChange={e => setFProduct(e.target.value)} placeholder="🔍 상품명 검색" style={{ ...inputStyle, width: 160, height: 34 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--danger)', cursor: 'pointer' }}>
            <input type="checkbox" checked={fOnlyHQ} onChange={e => setFOnlyHQ(e.target.checked)} style={{ cursor: 'pointer' }} /> 본사처리필요만
          </label>
          <button className="btn btn-p" onClick={fetchClaims} disabled={loading} style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 700 }}>
            {loading ? <span className="spinner" /> : '🔍 조회'}
          </button>
          <button type="button" onClick={handleExport} disabled={claims.length === 0}
            style={{ marginLeft: 'auto', height: 34, padding: '0 12px', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', background: claims.length === 0 ? '#fafafa' : '#fff3e0', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: claims.length === 0 ? 'not-allowed' : 'pointer' }}>
            📥 엑셀 다운로드
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>총 <b>{claims.length}</b>건
          {claims.filter(c => c.action_type === '본사처리필요').length > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700, marginLeft: 8 }}>· 본사처리필요 {claims.filter(c => c.action_type === '본사처리필요').length}건</span>}
        </div>

        {loading ? <div className="empty"><span className="spinner" /></div>
          : claims.length === 0 ? <div className="empty">조회된 클레임이 없습니다</div>
          : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>접수일시</th>
                  {isHQ && <><th>점포</th><th>지점</th></>}
                  <th>근무자</th><th>고객명</th><th>연락처</th><th>구매상품명</th><th>클레임유형</th><th>상세내용</th><th>상태</th><th>조치내용</th>
                  <th style={{ textAlign: 'center', width: 90 }}>수정/삭제</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => {
                  const isHQneed = c.action_type === '본사처리필요';
                  const st = c.status || deriveStatus(c.action_type);
                  const sc = statusColor(st);
                  return (
                    <tr key={c.id} style={isHQneed ? { background: '#fff5f5' } : {}}>
                      <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDt(c.created_at)}</td>
                      {isHQ && <><td><span className="badge badge-dept">{c.store_name}</span></td><td><span className="badge badge-store">{c.branch_name}</span></td></>}
                      <td style={{ fontSize: 12 }}>{c.worker_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.customer_name || '-'}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{c.customer_phone ? formatPhone(c.customer_phone) : '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.product_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.claim_type || '-'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 180 }}>{c.claim_detail || '-'}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.c, whiteSpace: 'nowrap' }}>{st}</span></td>
                      <td style={{ fontSize: 11, color: isHQneed ? 'var(--danger)' : 'var(--text2)', fontWeight: isHQneed ? 700 : 400, maxWidth: 240 }}>{actionText(c)}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => startEdit(c)} style={{ height: 26, padding: '0 8px', border: '1px solid var(--accent)', borderRadius: 4, background: '#fff3e0', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>수정</button>
                        <button type="button" onClick={() => removeClaim(c)} style={{ marginLeft: 4, height: 26, padding: '0 6px', border: '1px solid var(--border)', borderRadius: 4, background: '#fff', color: 'var(--danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
