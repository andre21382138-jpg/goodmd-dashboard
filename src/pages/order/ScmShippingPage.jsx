import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq, dlBlob } from '../../lib/utils';
import { ORDER_CONSTANTS } from '../../lib/constants';
import { DELIVERY_HEADERS } from '../customer/HQDeliveryRequestPage';

// SCM 발송요청 — 본사가 [발송요청]한 매장 발주(order_requests.status='scm_requested')를
//   1) 선택 → 엑셀 다운로드(31컬럼, SIDR 매칭)
//   2) 송장 엑셀 업로드 → SIDR 매칭으로 tracking_number 등록 (상태 유지)
//   3) 송장 등록건 선택 → [발송처리] → status='shipped' (본사/매장 발송현황 노출)
export default function ScmShippingPage({ profile }) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [fFrom, setFFrom] = useState(fmt(monthAgo));
  const [fTo,   setFTo]   = useState(fmt(today));
  const [fStatus, setFStatus] = useState('scm_requested'); // scm_requested | shipped | all
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shipping, setShipping] = useState(false);
  const uploadRef = React.useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('order_requests')
      .select('id, batch_id, store_name, branch_name, quantity, memo, status, request_date, created_at, scm_requested_at, tracking_number, shipped_at, brand:brands(name), product:products(name, code, erp_code)')
      .order('scm_requested_at', { ascending: false, nullsFirst: false })
      .limit(1000);
    if (fFrom) q = q.gte('created_at', `${fFrom}T00:00:00`);
    if (fTo)   q = q.lte('created_at', `${fTo}T23:59:59`);
    if (fStatus === 'all') q = q.in('status', ['scm_requested', 'shipped']);
    else q = q.eq('status', fStatus);
    const { data, error } = await q;
    if (error) toast(error.message, 'err');
    else setRows(data || []);
    setSelectedIds(new Set());
    setLoading(false);
  }, [fFrom, fTo, fStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stores = useMemo(() => uniq(rows.map(r => r.store_name)), [rows]);
  const [fStore, setFStore] = useState('');
  const filtered = useMemo(() => fStore ? rows.filter(r => r.store_name === fStore) : rows, [rows, fStore]);

  const toggleOne = (id) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const allChecked = filtered.length > 0 && filtered.every(r => selectedIds.has(r.id));
  const toggleAll = () => setSelectedIds(allChecked ? new Set() : new Set(filtered.map(r => r.id)));

  // 1) 선택건 → 31컬럼 매장발주 양식 다운로드 (row[23] = SIDR:<id>)
  const exportSelected = async () => {
    if (selectedIds.size === 0) { toast('다운로드할 건을 선택해주세요', 'err'); return; }
    setExporting(true);
    try {
      const items = rows.filter(r => selectedIds.has(r.id));
      const storeNames = uniq(items.map(it => it.store_name));
      const { data: addrs } = await supabase.from('store_addresses').select('*').in('store_name', storeNames);
      const addrMap = new Map();
      for (const a of (addrs || [])) addrMap.set(`${a.store_name}|${a.branch_name}`, a);

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('발송요청');
      ws.addRow(DELIVERY_HEADERS);
      const now = new Date();
      const ymd    = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const yymmdd = `${String(now.getFullYear()).slice(-2)}.${pad(now.getMonth()+1)}.${pad(now.getDate())}`;
      let seq = 0;
      for (const r of items) {
        seq += 1;
        // 주문번호는 발주건 고정값(요청일+요청ID) — 매번 다운로드해도 동일
        const reqYmd = String(r.request_date || r.created_at || '').slice(0,10).replace(/-/g,'') || ymd;
        const orderNo = `${reqYmd}-${String(r.id).padStart(6,'0')}`;
        const storeFull = `${r.store_name || ''}${r.branch_name || ''}`;
        const addr = addrMap.get(`${r.store_name}|${r.branch_name}`) || {};
        ws.addRow([
          now, '', orderNo, ORDER_CONSTANTS.CHANNEL, storeFull, storeFull, 0, 1, '', '',
          r.product?.name || '', storeFull, addr.postal_code || '', addr.address || '',
          addr.recipient_phone || '', '', r.memo || '', '', storeFull,
          ORDER_CONSTANTS.ORDERER_PHONE, ORDER_CONSTANTS.ORDERER_PHONE, '', '',
          `SIDR:${r.id}`, '', '', '', '', '', r.product?.erp_code || '', r.quantity || 0,
        ]);
      }
      ws.getColumn(1).numFmt = 'yyyy-mm-dd';
      ws.columns.forEach(col => {
        let max = 8;
        col.eachCell({ includeEmpty:false }, cell => {
          const v = cell.value == null ? '' : String(cell.value);
          if (v.length > max) max = Math.min(40, v.length + 2);
        });
        col.width = Math.max(max, 8);
      });
      const buf = await wb.xlsx.writeBuffer();
      dlBlob(buf, `발송요청_${yymmdd}_${seq}건.xlsx`);
      toast(`엑셀 다운로드 완료 (${seq}건)`, 'ok');
    } catch (err) {
      toast('다운로드 실패: ' + (err.message || err), 'err');
    }
    setExporting(false);
  };

  // 2) 송장 업로드 — row[23] SIDR:<id> + row[1] 송장번호 → tracking_number 등록(상태 유지)
  const handleUploadClick = () => uploadRef.current?.click();
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let totalRows = 0;
      const updates = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        if (!r || !Array.isArray(r) || r.length === 0) continue;
        const m = String(r[23] || '').trim().match(/SIDR:(\d+)/);
        if (!m) continue;
        totalRows++;
        const trk = String(r[1] || '').trim();
        if (!trk) continue;
        updates.push({ id: Number(m[1]), tracking: trk });
      }
      if (totalRows === 0) { toast('업로드 가능한 행이 없습니다 (SIDR 누락)', 'err'); setUploading(false); return; }
      if (updates.length === 0) { toast(`송장번호 입력된 행이 없습니다 (전체 ${totalRows}건)`, 'err'); setUploading(false); return; }
      const nowIso = new Date().toISOString();
      let ok = 0, fail = 0, lastErr = null;
      for (const u of updates) {
        const { error } = await supabase.from('order_requests')
          .update({ tracking_number: u.tracking, updated_at: nowIso }).eq('id', u.id);
        if (error) { fail++; lastErr = error; } else ok++;
      }
      const parts = [`송장 ${ok}건 등록`];
      if (fail > 0) parts.push(`실패 ${fail}건`);
      const noTrk = totalRows - updates.length;
      if (noTrk > 0) parts.push(`미입력 ${noTrk}건 제외`);
      toast(parts.join(' / '), fail > 0 ? 'err' : 'ok');
      if (fail > 0 && lastErr) toast(`실패 사유: ${lastErr.message || lastErr}`, 'err');
      fetchData();
    } catch (err) {
      toast('업로드 실패: ' + (err.message || err), 'err');
    }
    setUploading(false);
  };

  // 3) 발송처리 — 선택건 중 송장 등록된 것만 shipped 전환
  const processShipping = async () => {
    const items = rows.filter(r => selectedIds.has(r.id) && r.status === 'scm_requested');
    if (items.length === 0) { toast('발송처리할 건을 선택해주세요', 'err'); return; }
    const noTrk = items.filter(r => !r.tracking_number);
    if (noTrk.length > 0) {
      toast(`송장번호 없는 ${noTrk.length}건이 있습니다 — 송장 업로드 후 발송처리하세요`, 'err'); return;
    }
    if (!window.confirm(`${items.length}건을 발송처리하시겠습니까?\n본사·매장 발송현황에 '발송완료'로 표시됩니다.`)) return;
    setShipping(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('order_requests').update({
        status: 'shipped', shipped_at: nowIso, shipped_by: profile?.id || null, updated_at: nowIso,
      }).in('id', items.map(it => it.id));
      if (error) throw error;
      toast(`${items.length}건 발송처리 완료`, 'ok');
      fetchData();
    } catch (err) {
      toast('발송처리 실패: ' + (err.message || err), 'err');
    }
    setShipping(false);
  };

  const statusBadge = (s, hasTrk) => {
    if (s === 'shipped') return <span className="badge" style={{background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', fontSize:11}}>발송완료</span>;
    if (s === 'scm_requested') return hasTrk
      ? <span className="badge" style={{background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', fontSize:11}}>송장등록·발송대기</span>
      : <span className="badge" style={{background:'#e3f2fd', color:'#1565C0', border:'1px solid #90caf9', fontSize:11}}>발송요청</span>;
    return <span className="badge" style={{fontSize:11}}>{s}</span>;
  };

  const selCount = selectedIds.size;
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-';

  return (
    <div>
      <div className="card">
        <div className="card-label">🚚 매장 발주요청 처리</div>
        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} />
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 매장</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="scm_requested">발송요청 대기</option>
            <option value="shipped">발송완료</option>
            <option value="all">전체</option>
          </select>
          <div className="fbar-right" style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <span className="fresult">
              <b>{filtered.length}</b>건{selCount > 0 && <> · <b style={{color:'#6a1b9a'}}>선택 {selCount}건</b></>}
            </span>
            <button type="button" onClick={exportSelected} disabled={exporting || selCount === 0}
              style={{height:32, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background: selCount>0?'#fff3e0':'#f5f5f5', color: selCount>0?'var(--accent)':'var(--text3)', fontSize:12, fontWeight:700, cursor: selCount>0?'pointer':'not-allowed'}}>
              {exporting ? <span className="spinner"/> : `📥 엑셀 다운로드${selCount>0?` (${selCount})`:''}`}
            </button>
            <input ref={uploadRef} type="file" accept=".xls,.xlsx" onChange={handleUploadFile} style={{display:'none'}}/>
            <button type="button" onClick={handleUploadClick} disabled={uploading}
              style={{height:32, padding:'0 12px', border:'1px solid #2e7d32', borderRadius:'var(--radius)', background:'#e8f5e9', color:'#2e7d32', fontSize:12, fontWeight:700, cursor:'pointer'}}>
              {uploading ? <span className="spinner"/> : '📤 송장 업로드'}
            </button>
            <button type="button" onClick={processShipping} disabled={shipping || selCount === 0}
              style={{height:32, padding:'0 12px', border:'1px solid #6a1b9a', borderRadius:'var(--radius)', background: selCount>0?'#f3e5f5':'#f5f5f5', color: selCount>0?'#6a1b9a':'var(--text3)', fontSize:12, fontWeight:700, cursor: selCount>0?'pointer':'not-allowed'}}>
              {shipping ? <span className="spinner"/> : '🚚 발송처리'}
            </button>
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        {loading ? <div className="empty"><span className="spinner"/></div>
        : filtered.length === 0 ? <div className="empty">해당하는 발송요청이 없습니다</div>
        : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:36, textAlign:'center'}}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{cursor:'pointer'}}/>
                  </th>
                  <th style={{width:120}}>요청시각</th><th>매장</th><th>지점</th><th>상품명</th>
                  <th className="r" style={{width:70}}>수량</th>
                  <th>송장번호</th>
                  <th style={{textAlign:'center', width:130}}>상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={selectedIds.has(r.id) ? {background:'#f3e5f5'} : {}}>
                    <td style={{textAlign:'center'}}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{cursor:'pointer'}}/>
                    </td>
                    <td className="mono" style={{fontSize:11, whiteSpace:'nowrap'}}>{fmtTime(r.created_at)}</td>
                    <td><span className="badge badge-dept">{r.store_name}</span></td>
                    <td><span className="badge badge-store">{r.branch_name}</span></td>
                    <td style={{fontSize:12, fontWeight:600}}>
                      {r.product?.name || '-'}
                      {r.product?.code && <span style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:6}}>{r.product.code}</span>}
                    </td>
                    <td className="r" style={{fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{r.quantity}</td>
                    <td style={{fontSize:11, fontFamily:'var(--mono)'}}>{r.tracking_number || <span style={{color:'var(--text3)'}}>-</span>}</td>
                    <td style={{textAlign:'center'}}>{statusBadge(r.status, !!r.tracking_number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{fontSize:11, color:'var(--text3)', marginTop:10}}>
          ① 선택 → 엑셀 다운로드 → ② 송장 입력 후 업로드 → ③ 송장 등록건 선택 → 발송처리
        </div>
      </div>
    </div>
  );
}
