import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq, dlBlob } from '../../lib/utils';
import { ORDER_CONSTANTS } from '../../lib/constants';
import { DELIVERY_HEADERS } from '../customer/HQDeliveryRequestPage';

// 본사 — 매장에서 들어온 재고요청 조회 (order_requests 테이블)
// mode: 'pending' (매장재고요청 탭) | 'completed' (매장발주완료 탭)
export default function StockRequestsAdminView({ mode = 'pending', profile }) {
  const isPendingMode = mode === 'pending';
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const todayStr = fmt(today);
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth()+1)}-01`;

  const [fFrom, setFFrom] = useState(monthStart);
  const [fTo,   setFTo]   = useState(todayStr);
  const [fStore,setFStore]= useState('');
  // pending 모드: pending만 기본, completed 모드: ordered/received 표시
  const [fStatus, setFStatus] = useState(isPendingMode ? 'pending' : 'all_completed');
  const [rows,  setRows]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null); // 그룹 펼침 키
  const [editingQty, setEditingQty]   = useState({}); // { [id]: '입력중인 값' }
  const [savingQty,  setSavingQty]    = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting,  setExporting]    = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('order_requests')
      .select('id, store_name, branch_name, quantity, memo, status, request_date, created_at, brand:brands(name), product:products(name, code, erp_code)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (fFrom)   q = q.gte('created_at', `${fFrom}T00:00:00`);
    if (fTo)     q = q.lte('created_at', `${fTo}T23:59:59`);
    if (fStore)  q = q.eq('store_name', fStore);
    // status 분기
    if (isPendingMode) {
      // 매장재고요청 탭은 pending(또는 fulfilled - 별도 처리)만 보여줌
      if (fStatus !== 'all') q = q.eq('status', fStatus);
    } else {
      // 매장발주완료 탭은 ordered/received만 보여줌
      if (fStatus === 'ordered' || fStatus === 'received') q = q.eq('status', fStatus);
      else q = q.in('status', ['ordered', 'received']);
    }
    const { data, error } = await q;
    if (error) toast(error.message, 'err');
    else setRows(data || []);
    setLoading(false);
  }, [fFrom, fTo, fStore, fStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stores = useMemo(() => uniq(rows.map(r => r.store_name)), [rows]);

  // 매장+지점 단위로 그룹화 — 같은 매장 내에서는 요청일시 desc
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = `${r.store_name || ''}|${r.branch_name || ''}`;
      if (!map.has(key)) map.set(key, { key, store_name: r.store_name, branch_name: r.branch_name, items: [] });
      map.get(key).items.push(r);
    }
    // 그룹 정렬: 가장 최근 요청이 있는 그룹부터
    const list = Array.from(map.values());
    for (const g of list) {
      g.items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      g.totalQty = g.items.reduce((s, x) => s + (Number(x.quantity)||0), 0);
      g.pendingCount = g.items.filter(x => x.status === 'pending').length;
      g.latestAt = g.items[0]?.created_at || '';
    }
    list.sort((a, b) => (b.latestAt || '').localeCompare(a.latestAt || ''));
    return list;
  }, [rows]);

  const saveQty = async (r) => {
    const raw = editingQty[r.id];
    const next = Number(raw);
    if (raw === '' || !Number.isFinite(next) || next < 0) {
      toast('수량은 0 이상의 숫자로 입력해주세요', 'err'); return;
    }
    if (next === Number(r.quantity)) {
      setEditingQty(p => { const n = {...p}; delete n[r.id]; return n; });
      return;
    }
    // 0으로 저장 시: 재고 없음으로 처리 의도 명확화 (매장에는 '0개로 처리됨' 이력 남음)
    if (next === 0) {
      if (!window.confirm(`수량 0으로 저장하시겠습니까?\n매장에는 '본사 재고 없음 / 발주 불가'로 표시됩니다.`)) return;
    }
    setSavingQty(p => ({ ...p, [r.id]: true }));
    const { error } = await supabase.from('order_requests').update({
      quantity: next, updated_at: new Date().toISOString(),
    }).eq('id', r.id);
    if (error) toast(error.message, 'err');
    else {
      toast(`수량 ${r.quantity} → ${next} 변경 완료`, 'ok');
      setEditingQty(p => { const n = {...p}; delete n[r.id]; return n; });
      fetchData();
    }
    setSavingQty(p => { const n = {...p}; delete n[r.id]; return n; });
  };

  // 선택된 pending 항목을 ordered로 일괄 전환 = 본사 발주진행
  const processOrder = async () => {
    if (selectedIds.size === 0) { toast('발주진행할 요청을 선택해주세요', 'err'); return; }
    const items = rows.filter(r => selectedIds.has(r.id) && r.status === 'pending');
    if (items.length === 0) { toast('선택된 항목 중 pending 상태가 없습니다', 'err'); return; }
    if (!window.confirm(`${items.length}건을 발주진행 처리하시겠습니까?\n\n매장에서는 '발주진행중'으로 표시됩니다.`)) return;
    setExporting(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('order_requests').update({
        status: 'ordered',
        ordered_at: nowIso,
        ordered_by: profile?.id || null,
        updated_at: nowIso,
      }).in('id', items.map(it => it.id));
      if (error) throw error;
      toast(`${items.length}건 발주진행 처리 완료`, 'ok');
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    }
    setExporting(false);
  };

  const deleteRequest = async (r) => {
    if (!window.confirm(`이 재고요청을 삭제하시겠습니까?\n\n매장: ${r.store_name} ${r.branch_name}\n상품: ${r.product?.name || '-'}\n수량: ${r.quantity}\n\n매장에는 이 요청 이력이 사라집니다.`)) return;
    setProcessing(r.id);
    const { error } = await supabase.from('order_requests').delete().eq('id', r.id);
    if (error) toast(error.message, 'err');
    else { toast('재고요청 삭제 완료', 'inf'); fetchData(); }
    setProcessing(null);
  };

  // 선택 토글
  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleGroup = (g) => {
    const ids = g.items.map(it => it.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allOn = ids.every(id => next.has(id));
      if (allOn) ids.forEach(id => next.delete(id));
      else       ids.forEach(id => next.add(id));
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(rows.map(r => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  // 31컬럼 매장발주 양식으로 엑셀 다운로드
  const exportSelected = async () => {
    if (selectedIds.size === 0) { toast('다운로드할 요청을 선택해주세요', 'err'); return; }
    setExporting(true);
    try {
      const items = rows.filter(r => selectedIds.has(r.id));
      // 매장 주소 일괄 조회
      const storeNames  = uniq(items.map(it => it.store_name));
      const { data: addrs } = await supabase.from('store_addresses').select('*')
        .in('store_name', storeNames);
      const addrMap = new Map();
      for (const a of (addrs || [])) addrMap.set(`${a.store_name}|${a.branch_name}`, a);

      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('매장재고요청');
      ws.addRow(DELIVERY_HEADERS);

      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      const ymd    = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const yymmdd = `${String(now.getFullYear()).slice(-2)}.${pad(now.getMonth()+1)}.${pad(now.getDate())}`;

      let seq = 0;
      for (const r of items) {
        seq += 1;
        const orderNo = `${ymd}-${String(seq).padStart(4,'0')}`;
        const storeFull = `${r.store_name || ''}${r.branch_name || ''}`;
        const addr = addrMap.get(`${r.store_name}|${r.branch_name}`) || {};
        ws.addRow([
          now,                                       // 0  발송일
          '',                                        // 1  송장번호
          orderNo,                                   // 2  주문번호
          ORDER_CONSTANTS.CHANNEL,                   // 3  채널
          storeFull,                                 // 4  매장명
          storeFull,                                 // 5  수취인명 (매장이 수취인)
          0,                                         // 6  결제금액
          1,                                         // 7  주문수량
          '',                                        // 8  상품명
          '',                                        // 9  옵션
          r.product?.name || '',                     // 10 품명
          storeFull,                                 // 11 수취인명
          addr.postal_code || '',                    // 12 우편번호
          addr.address || '',                        // 13 주소
          addr.recipient_phone || '',                // 14 수취인 전화1
          '',                                        // 15 수취인 전화2
          r.memo || '',                              // 16 배송메세지
          '',                                        // 17 상품번호
          storeFull,                                 // 18 주문자명 (본사가 매장명으로)
          ORDER_CONSTANTS.ORDERER_PHONE,             // 19 주문자 연락처1
          ORDER_CONSTANTS.ORDERER_PHONE,             // 20 주문자 연락처2
          '',                                        // 21 수수료
          '',                                        // 22 수수료액
          `SIDR:${r.id}`,                            // 23 공란 — order_requests.id (재고요청 prefix)
          '',                                        // 24 사방넷
          '',                                        // 25 주문일
          '',                                        // 26 주문자 ID
          '',                                        // 27 물류바코드
          '',                                        // 28 송장전송일
          r.product?.erp_code || '',                 // 29 ERP코드
          r.quantity || 0,                           // 30 수량
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
      dlBlob(buf, `매장재고요청_${yymmdd}_전송건.xlsx`);
      toast(`엑셀 다운로드 완료 (${seq}건)`, 'ok');
    } catch (err) {
      toast('다운로드 실패: ' + (err.message || err), 'err');
    }
    setExporting(false);
  };

  const markFulfilled = async (id) => {
    if (!window.confirm('이 요청을 처리완료로 표시하시겠습니까?')) return;
    setProcessing(id);
    const { error } = await supabase.from('order_requests').update({
      status: 'fulfilled', updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast(error.message, 'err');
    else { toast('처리완료로 변경', 'ok'); fetchData(); }
    setProcessing(null);
  };

  const totalQty = rows.reduce((s, r) => s + (Number(r.quantity)||0), 0);
  const pendingCount = rows.filter(r => r.status === 'pending').length;

  return (
    <>
      <div className="card">
        <div className="card-label">📋 매장 재고요청 조회</div>
        <div className="fbar" style={{flexWrap:'wrap', gap:8}}>
          <input type="date" className="fsel" value={fFrom} onChange={e => setFFrom(e.target.value)} />
          <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
          <input type="date" className="fsel" value={fTo} onChange={e => setFTo(e.target.value)} />
          <select className="fsel" value={fStore} onChange={e => setFStore(e.target.value)}>
            <option value="">전체 매장</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {isPendingMode ? (
            <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="pending">대기</option>
              <option value="fulfilled">자체 처리완료</option>
              <option value="all">전체</option>
            </select>
          ) : (
            <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="all_completed">전체 (발주중+입고완료)</option>
              <option value="ordered">발주진행중</option>
              <option value="received">입고완료</option>
            </select>
          )}
          <div className="fbar-right">
            <span className="fresult">
              <b>{rows.length}</b>건 · 총 수량 <b>{totalQty}</b>개
              {fStatus === 'all' && <> · 대기 <b style={{color:'var(--accent)'}}>{pendingCount}</b>건</>}
              {selectedIds.size > 0 && <> · <b style={{color:'#6a1b9a'}}>선택 {selectedIds.size}건</b></>}
            </span>
            {rows.length > 0 && (
              selectedIds.size === rows.length
                ? <button className="btn btn-s" onClick={clearSelection}>✕ 선택 해제</button>
                : <button className="btn btn-s" onClick={selectAll}>☑ 전체 선택</button>
            )}
            {isPendingMode && (
              <button type="button" onClick={processOrder} disabled={exporting || selectedIds.size === 0}
                title="선택된 요청을 발주진행 처리 — 매장에는 '발주진행중'으로 표시되고 매장발주완료 탭으로 이동"
                style={{height:30, padding:'0 12px', border:'1px solid #6a1b9a', borderRadius:'var(--radius)', background: selectedIds.size > 0 ? '#f3e5f5' : '#f5f5f5', color: selectedIds.size > 0 ? '#6a1b9a' : 'var(--text3)', fontSize:12, fontWeight:700, cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed'}}>
                📦 발주진행{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </button>
            )}
            <button type="button" onClick={exportSelected} disabled={exporting || selectedIds.size === 0}
              title="선택된 재고요청을 매장발주 31컬럼 양식(.xlsx)으로 다운로드"
              style={{height:30, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background: selectedIds.size > 0 ? '#fff3e0' : '#f5f5f5', color: selectedIds.size > 0 ? 'var(--accent)' : 'var(--text3)', fontSize:12, fontWeight:700, cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed'}}>
              {exporting ? <span className="spinner"/> : `📥 엑셀 다운로드${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </button>
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        {loading ? <div className="empty"><span className="spinner"/></div>
        : rows.length === 0 ? <div className="empty">조회된 재고요청이 없습니다</div>
        : (
          <>
          <div style={{fontSize:11, color:'var(--text3)', marginBottom:8}}>매장 행 클릭 시 상품 내역 펼침 · 체크박스로 선택 후 엑셀 다운로드</div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:36}}></th>
                  <th>매장</th>
                  <th>지점</th>
                  <th className="r" style={{width:90}}>요청 건수</th>
                  <th className="r" style={{width:90}}>총 수량</th>
                  <th className="r" style={{width:90}}>대기 건수</th>
                  <th>최근 요청</th>
                  <th style={{width:90, textAlign:'center'}}></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const open = expandedKey === g.key;
                  const groupIds = g.items.map(it => it.id);
                  const groupSelected = groupIds.every(id => selectedIds.has(id));
                  const groupPartial  = !groupSelected && groupIds.some(id => selectedIds.has(id));
                  return (
                  <React.Fragment key={g.key}>
                    <tr style={{cursor:'pointer', background: open ? '#fff8e1' : 'transparent'}}
                      onClick={() => setExpandedKey(open ? null : g.key)}>
                      <td style={{textAlign:'center'}} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={groupSelected}
                          ref={el => { if (el) el.indeterminate = groupPartial; }}
                          onChange={() => toggleGroup(g)}
                          style={{cursor:'pointer', width:16, height:16}}/>
                      </td>
                      <td><span className="badge badge-dept">{g.store_name}</span></td>
                      <td><span className="badge badge-store">{g.branch_name}</span></td>
                      <td className="r" style={{fontWeight:700}}>{g.items.length}건</td>
                      <td className="r" style={{fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{g.totalQty}개</td>
                      <td className="r" style={{fontWeight:700, color: g.pendingCount > 0 ? '#e65100' : 'var(--text3)', fontFamily:'var(--mono)'}}>
                        {g.pendingCount > 0 ? `${g.pendingCount}건` : '0'}
                      </td>
                      <td className="mono" style={{fontSize:11, color:'var(--text2)'}}>
                        {g.latestAt ? new Date(g.latestAt).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-'}
                      </td>
                      <td style={{textAlign:'center'}}>
                        <button className="btn btn-s" style={{padding:'3px 10px', fontSize:11}}
                          onClick={(e) => { e.stopPropagation(); setExpandedKey(open ? null : g.key); }}>
                          {open ? '▲ 닫기' : '▼ 펼침'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} style={{background:'#fafafa', padding:'10px 14px', borderTop:'2px solid var(--accent)'}}>
                          <div style={{fontSize:12, fontWeight:700, color:'var(--text2)', marginBottom:8}}>
                            📋 {g.store_name} {g.branch_name} 재고요청 — {g.items.length}건
                          </div>
                          <div className="twrap" style={{background:'#fff', borderRadius:'var(--radius)', border:'1px solid var(--border)'}}>
                            <table>
                              <thead>
                                <tr>
                                  <th style={{width:36}}></th>
                                  <th style={{width:140}}>요청일시</th>
                                  <th>브랜드</th>
                                  <th>상품명</th>
                                  <th className="r" style={{width:70}}>수량</th>
                                  <th>메모</th>
                                  <th style={{width:90, textAlign:'center'}}>상태</th>
                                  <th style={{width:90, textAlign:'center'}}>작업</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map(r => {
                                  const isPending = r.status === 'pending';
                                  const draft = editingQty[r.id];
                                  const editing = draft !== undefined;
                                  const changed = editing && Number(draft) !== Number(r.quantity);
                                  return (
                                  <tr key={r.id} style={selectedIds.has(r.id) ? {background:'#f3e5f5'} : {}}>
                                    <td style={{textAlign:'center'}}>
                                      <input type="checkbox" checked={selectedIds.has(r.id)}
                                        onChange={() => toggleOne(r.id)}
                                        style={{cursor:'pointer', width:16, height:16}}/>
                                    </td>
                                    <td className="mono" style={{fontSize:11, whiteSpace:'nowrap'}}>
                                      {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-'}
                                    </td>
                                    <td style={{fontSize:12}}>{r.brand?.name || '-'}</td>
                                    <td style={{fontSize:12, fontWeight:600}}>
                                      {r.product?.name || '-'}
                                      {r.product?.code && <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginTop:2}}>코드: {r.product.code}</div>}
                                    </td>
                                    <td className="r">
                                      {isPending ? (
                                        <div style={{display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end'}}>
                                          <input type="number" min={0}
                                            value={editing ? draft : r.quantity}
                                            onChange={e => setEditingQty(p => ({ ...p, [r.id]: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter' && changed) saveQty(r); }}
                                            disabled={savingQty[r.id]}
                                            style={{width:60, height:28, padding:'0 6px', border:`1px solid ${changed?'var(--accent)':'var(--border)'}`, borderRadius:4, fontFamily:'var(--mono)', fontWeight:700, textAlign:'right', fontSize:12, background: changed ? '#fff3e0' : '#fff'}}/>
                                          {changed && (
                                            <button type="button" onClick={() => saveQty(r)} disabled={savingQty[r.id]}
                                              title="수량 저장"
                                              style={{height:24, padding:'0 8px', border:'1px solid var(--accent)', borderRadius:4, background:'var(--accent)', color:'#fff', fontSize:10, fontWeight:700, cursor:'pointer'}}>
                                              {savingQty[r.id] ? '…' : '저장'}
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <span style={{fontWeight:700, color: Number(r.quantity)===0?'var(--danger)':'var(--accent)', fontFamily:'var(--mono)'}}>{r.quantity}</span>
                                      )}
                                    </td>
                                    <td style={{fontSize:11, color:'var(--text2)'}}>{r.memo || '-'}</td>
                                    <td style={{textAlign:'center'}}>
                                      {isPending
                                        ? <span className="badge" style={{background:'#fff3e0', color:'#e65100', border:'1px solid #ffcc80', fontSize:11}}>대기</span>
                                        : r.status === 'fulfilled'
                                        ? <span className="badge" style={{background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', fontSize:11}}>자체처리완료</span>
                                        : r.status === 'ordered'
                                        ? <span className="badge" style={{background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', fontSize:11}}>발주진행중</span>
                                        : r.status === 'received'
                                        ? <span className="badge" style={{background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', fontSize:11}}>입고완료</span>
                                        : <span className="badge" style={{fontSize:11}}>{r.status}</span>}
                                    </td>
                                    <td style={{textAlign:'center'}}>
                                      <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                                        {isPending && isPendingMode && (
                                          <button className="btn btn-s" onClick={() => markFulfilled(r.id)} disabled={processing === r.id}
                                            style={{padding:'2px 8px', fontSize:11}}
                                            title="발주 진행 없이 자체 처리(예: 점간이동으로 해결)">
                                            {processing === r.id ? <span className="spinner"/> : '✓ 자체완료'}
                                          </button>
                                        )}
                                        {isPendingMode && (
                                          <button type="button" onClick={() => deleteRequest(r)} disabled={processing === r.id}
                                            title="요청 삭제"
                                            style={{padding:'2px 8px', fontSize:11, border:'1px solid var(--border)', borderRadius:4, background:'#fff', color:'var(--danger)', cursor:'pointer'}}>
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )})}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )})}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </>
  );
}
