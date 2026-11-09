import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob, formatPhone } from '../../lib/utils';
import { STORE_NAMES, STORE_MAP } from '../../lib/constants';

// 조치내용 → 처리상태 (반품 건은 저장 시 이미 '완료'로 들어옴)
const deriveStatus = (at) => at === '본사처리필요' ? '본사확인' : at ? '완료' : '접수';
const STATUS_OPTS = ['접수', '본사확인', '완료'];

const inputStyle = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 13, outline: 'none' };
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
  const [fSource, setFSource]   = useState('');   // '' | '반품' | '교환·증정'
  const [fOnlyHQ, setFOnlyHQ]   = useState(false);
  const branchOpts = useMemo(() => (fStore ? (STORE_MAP[fStore] || []) : []), [fStore]);

  const setDateRange = (type) => {
    const now = new Date(); const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (type === 'yesterday') { const y = new Date(now); y.setDate(now.getDate() - 1); setFFrom(fmt(y)); setFTo(fmt(y)); }
    else if (type === 'thismonth') { setFFrom(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`); setFTo(fmt(now)); }
    else if (type === 'lastmonth') { const first = new Date(now.getFullYear(), now.getMonth() - 1, 1); const last = new Date(now.getFullYear(), now.getMonth(), 0); setFFrom(fmt(first)); setFTo(fmt(last)); }
  };

  const [claims, setClaims]   = useState([]);
  const [loading, setLoading] = useState(false);

  // 목록 조회 (필터)
  const fetchClaims = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('store_claims').select('*');
    if (fStore)   q = q.eq('store_name', fStore);
    if (fBranch)  q = q.eq('branch_name', fBranch);
    if (fFrom)    q = q.gte('created_at', `${fFrom}T00:00:00`);
    if (fTo)      q = q.lte('created_at', `${fTo}T23:59:59`);
    if (fProduct.trim()) q = q.ilike('product_name', `%${fProduct.trim()}%`);
    if (fSource)  q = q.eq('source', fSource);
    if (fOnlyHQ)  q = q.eq('action_type', '본사처리필요');
    const { data, error } = await q.order('created_at', { ascending: false }).limit(500);
    if (error) toast('조회 실패: ' + error.message, 'err');
    setClaims(data || []);
    setLoading(false);
  }, [fStore, fBranch, fFrom, fTo, fProduct, fSource, fOnlyHQ]);
  useEffect(() => { fetchClaims(); /* eslint-disable-next-line */ }, []);  // 최초 1회

  // 재고 원복 (삭제 시 — 교환·증정 건의 stock_movements만 되돌림. 반품 건은 movements 비어있어 no-op)
  const reverseStock = async (movements, sName, bName) => {
    for (const m of (movements || [])) {
      if (!m.code || !m.delta) continue;
      const { data: row } = await supabase.from('store_stock').select('id, stock_qty')
        .eq('store_name', sName).eq('branch_name', bName).eq('product_code', m.code).maybeSingle();
      if (row) await supabase.from('store_stock').update({ stock_qty: (row.stock_qty || 0) - m.delta, updated_at: new Date().toISOString() }).eq('id', row.id);
    }
  };

  const removeClaim = async (c) => {
    const hasStock = Array.isArray(c.stock_movements) && c.stock_movements.length > 0;
    if (!window.confirm('이 클레임 접수건을 삭제하시겠습니까?' + (hasStock ? '\n(반영된 재고가 원복됩니다)' : '\n※ 반품으로 생성된 건이면 매출/적립금은 자동 원복되지 않습니다 — 반품접수에서 확인하세요.'))) return;
    await reverseStock(c.stock_movements, c.store_name, c.branch_name);
    const { error } = await supabase.from('store_claims').delete().eq('id', c.id);
    if (error) { toast('삭제 실패: ' + error.message, 'err'); return; }
    toast(hasStock ? '삭제 완료 (재고 원복)' : '삭제 완료', 'inf');
    fetchClaims();
  };

  // 처리상태 인라인 변경
  const changeStatus = async (c, newStatus) => {
    if (newStatus === c.status) return;
    const { error } = await supabase.from('store_claims').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { toast('상태 변경 실패: ' + error.message, 'err'); return; }
    setClaims(list => list.map(x => x.id === c.id ? { ...x, status: newStatus } : x));
    toast(`상태 변경 → ${newStatus}`, 'ok');
  };

  const statusColor = (s) => s === '완료' ? { bg: '#e8f5e9', c: '#2e7d32' } : s === '본사확인' ? { bg: '#e3f2fd', c: '#1565c0' } : { bg: '#eceff1', c: '#455a64' };
  const sourceColor = (s) => s === '반품' ? { bg: '#fff3e0', c: '#e65100' } : { bg: '#f3e5f5', c: '#6a1b9a' };
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
    ws.addRow(['접수일시', '점포명', '지점명', '유입', '근무자', '고객명', '고객연락처', '구매상품명', '클레임유형', '상세내용', '처리상태', '조치내용']);
    for (const c of claims) {
      ws.addRow([fmtDt(c.created_at), c.store_name, c.branch_name, c.source || '', c.worker_name || '', c.customer_name || '', c.customer_phone || '',
        c.product_name || '', c.claim_type || '', c.claim_detail || '', c.status || deriveStatus(c.action_type), actionText(c)]);
    }
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((col, i) => { col.width = [18, 12, 12, 10, 10, 10, 14, 24, 18, 28, 10, 34][i] || 12; });
    const buf = await wb.xlsx.writeBuffer();
    const now = new Date(); const pad = n => String(n).padStart(2, '0');
    dlBlob(buf, `고객클레임_${String(now.getFullYear()).slice(-2)}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.xlsx`);
    toast(`엑셀 다운로드 완료 (${claims.length}건)`, 'ok');
  };

  return (
    <div>
      {/* 안내 */}
      <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1565c0' }}>
        ℹ️ 클레임 <b>현황·처리내용 조회</b> 화면입니다. 신규 접수는 <b>매장 → 반품접수</b> 메뉴(회원반품/비회원반품 시 사유 입력, 또는 교환·증정 탭)에서 처리됩니다.
      </div>

      {/* 필터 + 목록 */}
      <div className="card">
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
          {['yesterday', 'thismonth', 'lastmonth'].map(t => (
            <button key={t} type="button" onClick={() => setDateRange(t)}
              style={{ height: 34, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {t === 'yesterday' ? '어제' : t === 'thismonth' ? '당월' : '전월'}
            </button>
          ))}
          <input value={fProduct} onChange={e => setFProduct(e.target.value)} placeholder="🔍 상품명 검색" style={{ ...inputStyle, width: 160, height: 34 }} />
          <select value={fSource} onChange={e => setFSource(e.target.value)} style={{ ...inputStyle, width: 120, height: 34 }}>
            <option value="">전체 유입</option>
            <option value="반품">반품</option>
            <option value="교환·증정">교환·증정</option>
          </select>
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
                  <th>유입</th><th>근무자</th><th>고객명</th><th>연락처</th><th>구매상품명</th><th>클레임유형</th><th>상세내용</th><th>상태</th><th>조치내용</th>
                  <th style={{ textAlign: 'center', width: 60 }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => {
                  const isHQneed = c.action_type === '본사처리필요';
                  const st = c.status || deriveStatus(c.action_type);
                  const sc = statusColor(st);
                  const src = c.source || (Array.isArray(c.stock_movements) && c.stock_movements.length ? '교환·증정' : '-');
                  const srcc = sourceColor(src);
                  return (
                    <tr key={c.id} style={isHQneed ? { background: '#fff5f5' } : {}}>
                      <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDt(c.created_at)}</td>
                      {isHQ && <><td><span className="badge badge-dept">{c.store_name}</span></td><td><span className="badge badge-store">{c.branch_name}</span></td></>}
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: srcc.bg, color: srcc.c, whiteSpace: 'nowrap' }}>{src}</span></td>
                      <td style={{ fontSize: 12 }}>{c.worker_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.customer_name || '-'}</td>
                      <td className="mono" style={{ fontSize: 11 }}>{c.customer_phone ? formatPhone(c.customer_phone) : '-'}</td>
                      <td style={{ fontSize: 12, maxWidth: 220 }}>{c.product_name || '-'}</td>
                      <td style={{ fontSize: 12 }}>{c.claim_type || '-'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 180 }}>{c.claim_detail || '-'}</td>
                      <td>
                        <select value={st} onChange={e => changeStatus(c, e.target.value)}
                          style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: `1px solid ${sc.c}33`, background: sc.bg, color: sc.c, cursor: 'pointer', outline: 'none' }}>
                          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ fontSize: 11, color: isHQneed ? 'var(--danger)' : 'var(--text2)', fontWeight: isHQneed ? 700 : 400, maxWidth: 240 }}>{actionText(c)}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => removeClaim(c)} style={{ height: 26, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 4, background: '#fff', color: 'var(--danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
