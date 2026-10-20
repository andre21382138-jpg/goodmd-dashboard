import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob, formatPhone } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

const CLAIM_TYPES = ['품질불만(맛)', '품질불만(냄새)', '품질불만(캡슐터짐)', '품질불만(분말굳음)', '효능불만', '가격불만', '섭취후이상', '직접입력'];
const STATUSES = ['접수', '처리중', '완료'];

const emptyForm = () => ({
  worker_name: '', customer_name: '', customer_phone: '', customer_id: null,
  product_name: '', product_code: '', claim_type: '', claim_type_custom: '',
  claim_detail: '', status: '접수', action_detail: '',
});

const inputStyle = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, outline: 'none' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 };

export default function ClaimIntakePage({ profile }) {
  const isStoreMgr = profile?.job_title === '매니저';
  const [hqStore, setHqStore]   = useState('');
  const [hqBranch, setHqBranch] = useState('');
  const storeName  = isStoreMgr ? profile.department : hqStore;
  const branchName = isStoreMgr ? profile.branch     : hqBranch;
  const branchOpts = useMemo(() => (hqStore ? (STORE_MAP[hqStore] || []) : []), [hqStore]);

  const [workers, setWorkers] = useState([]);
  const [form, setForm]       = useState(emptyForm());
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [claims, setClaims]   = useState([]);
  const [loading, setLoading] = useState(false);

  // 고객 조회 팝업
  const [custModal, setCustModal]   = useState(false);
  const [custQuery, setCustQuery]   = useState('');
  const [custResults, setCustResults] = useState([]);
  const [custSearching, setCustSearching] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // 해당 매장 근무자 목록
  const fetchWorkers = useCallback(async () => {
    if (!storeName || !branchName) { setWorkers([]); return; }
    const { data } = await supabase.from('store_members')
      .select('id, name, display_name, job_title, store:profiles!store_account_id(department, branch)');
    const list = (data || [])
      .filter(m => m.store?.department === storeName && m.store?.branch === branchName)
      .sort((a, b) => {
        const rank = t => t === '매니저' ? 0 : t === '부매니저' ? 1 : 2;
        return rank(a.job_title) - rank(b.job_title);
      });
    setWorkers(list);
  }, [storeName, branchName]);
  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  // 접수 목록 (해당 매장 최근 300건)
  const fetchClaims = useCallback(async () => {
    if (!storeName || !branchName) { setClaims([]); return; }
    setLoading(true);
    const { data, error } = await supabase.from('store_claims')
      .select('*')
      .eq('store_name', storeName).eq('branch_name', branchName)
      .order('created_at', { ascending: false }).limit(300);
    if (error) toast('목록 조회 실패: ' + error.message, 'err');
    setClaims(data || []);
    setLoading(false);
  }, [storeName, branchName]);
  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  // 고객 조회
  const openCustModal = () => { setCustModal(true); setCustQuery(''); setCustResults([]); };
  useEffect(() => {
    if (!custModal) return;
    const q = custQuery.trim();
    if (q.length < 2) { setCustResults([]); return; }
    setCustSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('customers')
        .select('id, name, phone, store_name, branch_name')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(30);
      if (cancelled) return;
      setCustResults(data || []);
      setCustSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [custQuery, custModal]);
  const pickCustomer = (c) => {
    setForm(f => ({ ...f, customer_name: c.name || '', customer_phone: c.phone || '', customer_id: c.id }));
    setCustModal(false);
  };

  // 바코드 → 상품 조회 (코드/ERP코드 각각 .eq 로 — 괄호 등 특수문자 안전)
  const lookupProduct = async (code) => {
    const c = String(code || '').trim();
    if (!c) return;
    let { data } = await supabase.from('products').select('name, code').eq('code', c).limit(1);
    if (!data || data.length === 0) ({ data } = await supabase.from('products').select('name, code').eq('erp_code', c).limit(1));
    const p = data?.[0];
    if (p) { setForm(f => ({ ...f, product_name: p.name, product_code: p.code || c })); toast(`상품 인식: ${p.name}`, 'ok'); }
    else   { setForm(f => ({ ...f, product_code: c })); toast('상품관리에 없는 코드 — 상품명은 직접 입력하세요', 'inf'); }
  };

  const resetForm = () => { setForm(emptyForm()); setEditId(null); };

  const save = async () => {
    if (!storeName || !branchName) { toast('점포·지점을 선택해주세요', 'err'); return; }
    if (!form.worker_name) { toast('근무자를 선택해주세요', 'err'); return; }
    const claimType = form.claim_type === '직접입력' ? form.claim_type_custom.trim() : form.claim_type;
    if (!claimType) { toast('클레임유형을 선택(또는 입력)해주세요', 'err'); return; }
    setSaving(true);
    const row = {
      store_name: storeName, branch_name: branchName,
      worker_name: form.worker_name,
      customer_name: form.customer_name.trim() || null,
      customer_phone: form.customer_phone.trim() || null,
      customer_id: form.customer_id,
      product_name: form.product_name.trim() || null,
      product_code: form.product_code.trim() || null,
      claim_type: claimType,
      claim_detail: form.claim_detail.trim() || null,
      status: form.status,
      action_detail: form.action_detail.trim() || null,
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from('store_claims').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editId));
    } else {
      ({ error } = await supabase.from('store_claims').insert({ ...row, created_by: profile?.id || null }));
    }
    setSaving(false);
    if (error) { toast('저장 실패: ' + error.message, 'err'); return; }
    toast(editId ? '수정 완료' : '클레임 접수 완료', 'ok');
    resetForm();
    fetchClaims();
  };

  const startEdit = (c) => {
    const known = CLAIM_TYPES.includes(c.claim_type);
    setForm({
      worker_name: c.worker_name || '', customer_name: c.customer_name || '', customer_phone: c.customer_phone || '',
      customer_id: c.customer_id || null, product_name: c.product_name || '', product_code: c.product_code || '',
      claim_type: known ? c.claim_type : '직접입력', claim_type_custom: known ? '' : (c.claim_type || ''),
      claim_detail: c.claim_detail || '', status: c.status || '접수', action_detail: c.action_detail || '',
    });
    setEditId(c.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeClaim = async (c) => {
    if (!window.confirm('이 클레임 접수건을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('store_claims').delete().eq('id', c.id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast('삭제 완료', 'inf');
    if (editId === c.id) resetForm();
    fetchClaims();
  };

  const statusColor = (s) => s === '완료' ? { bg: '#e8f5e9', c: '#2e7d32' } : s === '처리중' ? { bg: '#fff3e0', c: '#e65100' } : { bg: '#eceff1', c: '#455a64' };

  const fmtDt = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

  const handleExport = async () => {
    if (claims.length === 0) { toast('내보낼 내역이 없습니다', 'err'); return; }
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('고객 클레임');
    ws.addRow(['접수일시', '점포명', '지점명', '근무자', '고객명', '고객연락처', '구매상품명', '클레임유형', '상세내용', '처리상태', '조치내용']);
    for (const c of claims) {
      ws.addRow([fmtDt(c.created_at), c.store_name, c.branch_name, c.worker_name || '', c.customer_name || '', c.customer_phone || '',
        c.product_name || '', c.claim_type || '', c.claim_detail || '', c.status || '', c.action_detail || '']);
    }
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((col, i) => { col.width = [18, 12, 12, 10, 10, 14, 24, 18, 30, 10, 30][i] || 12; });
    const buf = await wb.xlsx.writeBuffer();
    const now = new Date(); const pad = n => String(n).padStart(2, '0');
    dlBlob(buf, `고객클레임_${storeName}${branchName}_${String(now.getFullYear()).slice(-2)}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.xlsx`);
    toast(`엑셀 다운로드 완료 (${claims.length}건)`, 'ok');
  };

  return (
    <div>
      {/* 점포 선택 (본사/관리자) */}
      {!isStoreMgr && (
        <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={hqStore} onChange={e => { setHqStore(e.target.value); setHqBranch(''); }} style={{ ...inputStyle, width: 180 }}>
            <option value="">점포 선택</option>
            {STORE_NAMES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={hqBranch} onChange={e => setHqBranch(e.target.value)} style={{ ...inputStyle, width: 180 }} disabled={!hqStore}>
            <option value="">지점 선택</option>
            {branchOpts.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      )}

      {/* 입력 폼 */}
      <div className="card">
        <div className="card-label">📣 고객 클레임 {editId ? '수정' : '접수'}
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text2)', fontWeight: 400 }}>📍 {storeName || '-'} {branchName || ''}</span>
          {editId && <button type="button" onClick={resetForm} style={{ marginLeft: 10, fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, background: '#fff', padding: '2px 8px', cursor: 'pointer' }}>+ 신규 입력으로</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {/* 근무자 */}
          <div>
            <label style={labelStyle}>근무자 *</label>
            <select value={form.worker_name} onChange={e => update('worker_name', e.target.value)} style={inputStyle}>
              <option value="">근무자 선택</option>
              {workers.map(w => <option key={w.id} value={w.display_name || w.name}>{(w.display_name || w.name)}{w.job_title ? ` (${w.job_title})` : ''}</option>)}
            </select>
          </div>
          {/* 클레임유형 */}
          <div>
            <label style={labelStyle}>클레임유형 *</label>
            <select value={form.claim_type} onChange={e => update('claim_type', e.target.value)} style={inputStyle}>
              <option value="">유형 선택</option>
              {CLAIM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            {form.claim_type === '직접입력' && (
              <input value={form.claim_type_custom} onChange={e => update('claim_type_custom', e.target.value)} placeholder="클레임유형 직접 입력" style={{ ...inputStyle, marginTop: 6 }} />
            )}
          </div>
          {/* 고객명 + 연락처 (조회) */}
          <div>
            <label style={labelStyle}>고객명</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} placeholder="고객명" style={inputStyle} />
              <button type="button" onClick={openCustModal} title="회원 조회" style={{ flexShrink: 0, width: 42, border: '1px solid var(--accent)', borderRadius: 'var(--radius)', background: '#fff3e0', color: 'var(--accent)', cursor: 'pointer', fontSize: 15 }}>🔍</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>고객연락처</label>
            <input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} placeholder="010-0000-0000" style={inputStyle} inputMode="numeric" />
          </div>
          {/* 구매상품 (바코드) */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>구매상품명 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(바코드 스캔 또는 직접 입력)</span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input placeholder="📷 바코드 스캔 후 Enter"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupProduct(e.currentTarget.value); e.currentTarget.value = ''; } }}
                style={{ ...inputStyle, width: 220, border: '2px solid var(--accent)' }} />
              <input value={form.product_name} onChange={e => update('product_name', e.target.value)} placeholder="구매상품명" style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
              {form.product_code && <span style={{ alignSelf: 'center', fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>코드: {form.product_code}</span>}
            </div>
          </div>
          {/* 상세내용 */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>상세내용</label>
            <textarea value={form.claim_detail} onChange={e => update('claim_detail', e.target.value)} rows={2} placeholder="클레임 상세 내용" style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
          </div>
          {/* 처리상태 + 조치내용 */}
          <div>
            <label style={labelStyle}>처리상태</label>
            <select value={form.status} onChange={e => update('status', e.target.value)} style={inputStyle}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>조치내용</label>
            <textarea value={form.action_detail} onChange={e => update('action_detail', e.target.value)} rows={2} placeholder="조치/처리 내용" style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-p" onClick={save} disabled={saving} style={{ height: 42, padding: '0 28px', fontSize: 14, fontWeight: 700 }}>
            {saving ? <span className="spinner" /> : (editId ? '✓ 수정 저장' : '✓ 접수 저장')}
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div className="card-label" style={{ margin: 0 }}>📋 접수 내역 ({claims.length}건)</div>
          <button type="button" onClick={handleExport} disabled={claims.length === 0}
            style={{ height: 30, padding: '0 12px', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', background: claims.length === 0 ? '#fafafa' : '#fff3e0', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: claims.length === 0 ? 'not-allowed' : 'pointer' }}>
            📥 엑셀 다운로드
          </button>
        </div>
        {loading ? <div className="empty"><span className="spinner" /></div>
          : claims.length === 0 ? <div className="empty">접수된 클레임이 없습니다</div>
          : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>접수일시</th><th>근무자</th><th>고객명</th><th>연락처</th>
                  <th>구매상품명</th><th>클레임유형</th><th>상세내용</th><th>처리상태</th><th>조치내용</th>
                  <th style={{ textAlign: 'center', width: 90 }}>수정/삭제</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => {
                  const sc = statusColor(c.status);
                  return (
                    <tr key={c.id}>
                      <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDt(c.created_at)}</td>
                      <td style={{ fontSize: 12 }}>{c.worker_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.customer_name || '-'}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{c.customer_phone ? formatPhone(c.customer_phone) : '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.product_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.claim_type || '-'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 220 }}>{c.claim_detail || '-'}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.c }}>{c.status}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 220 }}>{c.action_detail || '-'}</td>
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

      {/* 고객 조회 팝업 */}
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
                  <div key={c.id} onClick={() => pickCustomer(c)}
                    style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 13 }}
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
