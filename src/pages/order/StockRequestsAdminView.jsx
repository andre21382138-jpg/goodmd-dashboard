import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, uniq } from '../../lib/utils';

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
  const [prodSearch, setProdSearch] = useState(''); // 상품 검색(상품 중심 보기·일괄삭제)
  // pending 모드: pending만 기본, completed 모드: ordered/received 표시
  const [fStatus, setFStatus] = useState(isPendingMode ? 'pending' : 'all_completed');
  const [rows,  setRows]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null); // 그룹 펼침 키
  const [editingQty, setEditingQty]   = useState({}); // { [id]: '입력중인 값' }
  const [savingQty,  setSavingQty]    = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exporting,  setExporting]    = useState(false); // 삭제 처리 중 표시용

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('order_requests')
      .select('id, store_name, branch_name, quantity, memo, status, reject_reason, request_date, created_at, brand:brands(name), product:products(name, code, erp_code)')
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
      // 매장발주완료(발송현황) 탭 — SCM 발송요청/발송완료/입고완료
      const completedSet = ['scm_requested', 'shipped', 'received', 'ordered', 'rejected'];
      if (completedSet.includes(fStatus)) q = q.eq('status', fStatus);
      else q = q.in('status', completedSet);
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
      g.pendingCount   = g.items.filter(x => x.status === 'pending').length;
      g.scmReqCount    = g.items.filter(x => x.status === 'scm_requested').length;
      g.shippedCount   = g.items.filter(x => x.status === 'shipped').length;
      g.receivedCount  = g.items.filter(x => x.status === 'received').length;
      g.rejectedCount  = g.items.filter(x => x.status === 'rejected').length;
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


  const deleteRequest = async (r) => {
    if (!window.confirm(`이 재고요청을 삭제하시겠습니까?\n\n매장: ${r.store_name} ${r.branch_name}\n상품: ${r.product?.name || '-'}\n수량: ${r.quantity}\n\n매장에는 이 요청 이력이 사라집니다.`)) return;
    setProcessing(r.id);
    const { error } = await supabase.from('order_requests').delete().eq('id', r.id);
    if (error) toast(error.message, 'err');
    else { toast('재고요청 삭제 완료', 'inf'); fetchData(); }
    setProcessing(null);
  };

  // 매장(그룹) 단위 [발송요청] — 해당 그룹의 pending 항목을 SCM으로 전송(scm_requested)
  const [sendingScm, setSendingScm] = useState(null);
  const sendToScm = async (g) => {
    const ids = g.items.filter(it => it.status === 'pending').map(it => it.id);
    if (ids.length === 0) { toast('발송요청할 대기 항목이 없습니다', 'err'); return; }
    if (!window.confirm(`${g.store_name} ${g.branch_name}\n발주요청 ${ids.length}건을 SCM으로 발송요청하시겠습니까?`)) return;
    setSendingScm(g.key);
    try {
      const { error } = await supabase.from('order_requests').update({
        status: 'scm_requested',
        scm_requested_at: new Date().toISOString(),
        scm_requested_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      }).in('id', ids);
      if (error) throw error;
      toast(`${g.store_name} ${g.branch_name} — ${ids.length}건 SCM 발송요청 완료`, 'ok');
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast('발송요청 실패: ' + (err.message || err), 'err');
    }
    setSendingScm(null);
  };

  // 선택분 일괄 [발송요청] — 선택된 모든 매장의 pending 항목을 한 번에 SCM 전송
  const sendSelectedToScm = async () => {
    const ids = rows.filter(r => selectedIds.has(r.id) && r.status === 'pending').map(r => r.id);
    if (ids.length === 0) { toast('발송요청할 대기 항목을 선택해주세요', 'err'); return; }
    const storeCount = new Set(rows.filter(r => ids.includes(r.id)).map(r => `${r.store_name}|${r.branch_name}`)).size;
    if (!window.confirm(`선택한 ${storeCount}개 매장 / ${ids.length}건을 SCM으로 발송요청하시겠습니까?`)) return;
    setSendingScm('__bulk__');
    try {
      const { error } = await supabase.from('order_requests').update({
        status: 'scm_requested',
        scm_requested_at: new Date().toISOString(),
        scm_requested_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      }).in('id', ids);
      if (error) throw error;
      toast(`${ids.length}건 SCM 발송요청 완료`, 'ok');
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast('발송요청 실패: ' + (err.message || err), 'err');
    }
    setSendingScm(null);
  };

  // 선택한 재고요청 일괄 삭제
  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) { toast('삭제할 요청을 선택해주세요', 'err'); return; }
    if (!window.confirm(`선택한 ${ids.length}건의 재고요청을 삭제하시겠습니까?\n\n매장에는 해당 요청 이력이 사라지며, 되돌릴 수 없습니다.`)) return;
    setExporting(true);
    try {
      const { error } = await supabase.from('order_requests').delete().in('id', ids);
      if (error) throw error;
      toast(`${ids.length}건 삭제 완료`, 'ok');
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast('삭제 실패: ' + (err.message || err), 'err');
    }
    setExporting(false);
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

  // 상품 검색 — 상품 단위로 묶어 (요청한 매장·수량) 표시 + 일괄 삭제
  const productGroups = useMemo(() => {
    const kw = prodSearch.trim().toLowerCase();
    if (!kw) return [];
    const map = new Map();
    for (const r of rows) {
      const name = r.product?.name || '';
      const code = r.product?.code || '';
      if (!name.toLowerCase().includes(kw) && !String(code).toLowerCase().includes(kw)) continue;
      const key = r.product_id ?? `name:${name}`;
      if (!map.has(key)) map.set(key, { key, name, code, items: [], totalQty: 0 });
      const g = map.get(key);
      g.items.push(r);
      g.totalQty += Number(r.quantity) || 0;
    }
    const list = [...map.values()];
    for (const g of list) g.items.sort((a,b) => (a.store_name||'').localeCompare(b.store_name||''));
    list.sort((a,b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
    return list;
  }, [rows, prodSearch]);

  // 특정 상품의 (현재 조회된) 발주요청 전체 삭제
  const deleteByProduct = async (g) => {
    const ids = g.items.map(it => it.id);
    if (ids.length === 0) return;
    if (!window.confirm(`'${g.name}' 발주요청을 ${new Set(g.items.map(it=>`${it.store_name}|${it.branch_name}`)).size}개 매장 / ${ids.length}건 모두 삭제하시겠습니까?\n\n각 매장의 해당 요청이 사라지며 되돌릴 수 없습니다.`)) return;
    setExporting(true);
    try {
      const { error } = await supabase.from('order_requests').delete().in('id', ids);
      if (error) throw error;
      toast(`'${g.name}' ${ids.length}건 삭제 완료`, 'ok');
      fetchData();
    } catch (err) {
      toast('삭제 실패: ' + (err.message || err), 'err');
    }
    setExporting(false);
  };

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
          <input className="fsel" value={prodSearch} onChange={e => setProdSearch(e.target.value)}
            placeholder="🔍 상품명·코드 검색 (상품별 보기)" style={{minWidth:220}}/>
          {prodSearch && <button className="btn-ghost" onClick={() => setProdSearch('')}>✕</button>}
          {isPendingMode ? (
            <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="pending">대기</option>
              <option value="fulfilled">자체 처리완료</option>
              <option value="all">전체</option>
            </select>
          ) : (
            <select className="fsel" value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="all_completed">전체</option>
              <option value="scm_requested">SCM 발송요청</option>
              <option value="shipped">발송완료</option>
              <option value="received">입고완료</option>
              <option value="rejected">본사반려(발송불가)</option>
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
            {/* 송장업로드·엑셀다운로드는 SCM 담당 — 본사는 검토 후 [발송요청]만 */}
            {isPendingMode && selectedIds.size > 0 && (
              <>
                <button type="button" onClick={sendSelectedToScm} disabled={sendingScm === '__bulk__'}
                  title="선택한 모든 매장의 발주요청을 한 번에 SCM으로 발송요청"
                  style={{height:30, padding:'0 12px', border:'1px solid #6a1b9a', borderRadius:'var(--radius)', background:'#f3e5f5', color:'#6a1b9a', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  {sendingScm === '__bulk__' ? <span className="spinner"/> : `📤 선택 발송요청 (${selectedIds.size})`}
                </button>
                <button type="button" onClick={deleteSelected} disabled={exporting}
                  title="선택한 재고요청을 일괄 삭제"
                  style={{height:30, padding:'0 12px', border:'1px solid var(--danger)', borderRadius:'var(--radius)', background:'#ffebee', color:'var(--danger)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                  🗑 선택 삭제 ({selectedIds.size})
                </button>
              </>
            )}
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          </div>
        </div>
      </div>

      {/* 상품 검색 결과 — 상품별로 요청 매장·수량 + 일괄삭제 */}
      {prodSearch.trim() && (
        <div className="card" style={{padding:'16px 20px', marginBottom:12, border:'2px solid var(--accent)'}}>
          <div className="card-label" style={{color:'var(--accent)'}}>🔍 상품별 발주요청 — "{prodSearch.trim()}"</div>
          {productGroups.length === 0 ? <div className="empty">검색된 상품이 없습니다</div> : (
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {productGroups.map(g => (
                <div key={g.key} style={{border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden'}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'10px 14px', background:'#fff8e1', flexWrap:'wrap'}}>
                    <div style={{fontSize:13, fontWeight:700}}>
                      {g.name}
                      {g.code && <span style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)', marginLeft:8}}>{g.code}</span>}
                      <span style={{marginLeft:10, fontSize:12, color:'var(--text2)'}}>
                        {new Set(g.items.map(it=>`${it.store_name}|${it.branch_name}`)).size}개 매장 · 총 <b style={{color:'var(--accent)'}}>{g.totalQty}</b>개 · {g.items.length}건
                      </span>
                    </div>
                    {isPendingMode && (
                      <button type="button" onClick={() => deleteByProduct(g)} disabled={exporting}
                        title="이 상품의 발주요청을 모든 매장에서 일괄 삭제"
                        style={{height:30, padding:'0 12px', border:'1px solid var(--danger)', borderRadius:'var(--radius)', background:'#ffebee', color:'var(--danger)', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'}}>
                        🗑 이 상품 발주 전체 삭제
                      </button>
                    )}
                  </div>
                  <div className="twrap">
                    <table>
                      <thead>
                        <tr><th>매장</th><th>지점</th><th className="r" style={{width:90}}>수량</th><th style={{width:90, textAlign:'center'}}>상태</th><th style={{width:60, textAlign:'center'}}>삭제</th></tr>
                      </thead>
                      <tbody>
                        {g.items.map(r => (
                          <tr key={r.id}>
                            <td><span className="badge badge-dept">{r.store_name}</span></td>
                            <td><span className="badge badge-store">{r.branch_name}</span></td>
                            <td className="r" style={{fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)'}}>{r.quantity}</td>
                            <td style={{textAlign:'center'}}>
                              {r.status === 'pending'
                                ? <span className="badge" style={{background:'#fff3e0', color:'#e65100', border:'1px solid #ffcc80', fontSize:11}}>대기</span>
                                : <span className="badge" style={{fontSize:11}}>{r.status}</span>}
                            </td>
                            <td style={{textAlign:'center'}}>
                              {isPendingMode && (
                                <button type="button" onClick={() => deleteRequest(r)} disabled={processing === r.id}
                                  title="이 매장 요청만 삭제"
                                  style={{padding:'2px 8px', fontSize:11, border:'1px solid var(--border)', borderRadius:4, background:'#fff', color:'var(--danger)', cursor:'pointer'}}>✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{padding:'16px 20px'}}>
        {loading ? <div className="empty"><span className="spinner"/></div>
        : rows.length === 0 ? <div className="empty">조회된 재고요청이 없습니다</div>
        : (
          <>
          <div style={{fontSize:11, color:'var(--text3)', marginBottom:8}}>매장 행 클릭 시 상품 내역 펼침 · 수량 수정/행 삭제 후 매장별 [📤 발송요청]으로 SCM 전송</div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:36}}></th>
                  <th>매장</th>
                  <th>지점</th>
                  <th className="r" style={{width:90}}>요청 건수</th>
                  <th className="r" style={{width:90}}>총 수량</th>
                  <th style={{width:170, textAlign:'center'}}>{isPendingMode ? '대기 건수' : '상태'}</th>
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
                      {isPendingMode ? (
                        <td className="r" style={{fontWeight:700, color: g.pendingCount > 0 ? '#e65100' : 'var(--text3)', fontFamily:'var(--mono)'}}>
                          {g.pendingCount > 0 ? `${g.pendingCount}건` : '0'}
                        </td>
                      ) : (
                        <td style={{textAlign:'center'}}>
                          <div style={{display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap'}}>
                            {g.scmReqCount  > 0 && <span className="badge" style={{background:'#e3f2fd', color:'#1565C0', border:'1px solid #90caf9', fontSize:10}}>발송요청 {g.scmReqCount}</span>}
                            {g.shippedCount > 0 && <span className="badge" style={{background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', fontSize:10}}>발송완료 {g.shippedCount}</span>}
                            {g.receivedCount> 0 && <span className="badge" style={{background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', fontSize:10}}>입고완료 {g.receivedCount}</span>}
                            {g.rejectedCount> 0 && <span className="badge" style={{background:'#ffebee', color:'var(--danger)', border:'1px solid #ef9a9a', fontSize:10}}>본사반려 {g.rejectedCount}</span>}
                          </div>
                        </td>
                      )}
                      <td className="mono" style={{fontSize:11, color:'var(--text2)'}}>
                        {g.latestAt ? new Date(g.latestAt).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-'}
                      </td>
                      <td style={{textAlign:'center'}} onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex', gap:4, justifyContent:'center', alignItems:'center'}}>
                          {isPendingMode && g.pendingCount > 0 && (
                            <button type="button" onClick={() => sendToScm(g)} disabled={sendingScm === g.key}
                              title="이 매장의 발주요청을 SCM으로 발송요청"
                              style={{padding:'3px 10px', fontSize:11, fontWeight:700, border:'1px solid #6a1b9a', borderRadius:4, background:'#f3e5f5', color:'#6a1b9a', cursor:'pointer', whiteSpace:'nowrap'}}>
                              {sendingScm === g.key ? <span className="spinner"/> : `📤 발송요청 (${g.pendingCount})`}
                            </button>
                          )}
                          <button className="btn btn-s" style={{padding:'3px 10px', fontSize:11}}
                            onClick={() => setExpandedKey(open ? null : g.key)}>
                            {open ? '▲ 닫기' : '▼ 펼침'}
                          </button>
                        </div>
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
                                        : r.status === 'scm_requested'
                                        ? <span className="badge" style={{background:'#e3f2fd', color:'#1565C0', border:'1px solid #90caf9', fontSize:11}}>SCM 발송요청</span>
                                        : r.status === 'shipped'
                                        ? <span className="badge" style={{background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', fontSize:11}}>발송완료</span>
                                        : r.status === 'fulfilled'
                                        ? <span className="badge" style={{background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', fontSize:11}}>자체처리완료</span>
                                        : r.status === 'ordered'
                                        ? <span className="badge" style={{background:'#f3e5f5', color:'#6a1b9a', border:'1px solid #ce93d8', fontSize:11}}>발주진행중</span>
                                        : r.status === 'received'
                                        ? <span className="badge" style={{background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', fontSize:11}}>입고완료</span>
                                        : r.status === 'rejected'
                                        ? <span className="badge" style={{background:'#ffebee', color:'var(--danger)', border:'1px solid #ef9a9a', fontSize:11}}>본사반려</span>
                                        : <span className="badge" style={{fontSize:11}}>{r.status}</span>}
                                      {r.status === 'rejected' && r.reject_reason && (
                                        <div style={{fontSize:10, color:'var(--danger)', marginTop:3}}>사유: {r.reject_reason}</div>
                                      )}
                                      {r.tracking_number && (
                                        <div style={{fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)', marginTop:3}}>📦 {r.tracking_number}</div>
                                      )}
                                    </td>
                                    <td style={{textAlign:'center'}}>
                                      {isPendingMode && (
                                        <button type="button" onClick={() => deleteRequest(r)} disabled={processing === r.id}
                                          title="요청 삭제"
                                          style={{padding:'2px 8px', fontSize:11, border:'1px solid var(--border)', borderRadius:4, background:'#fff', color:'var(--danger)', cursor:'pointer'}}>
                                          ✕
                                        </button>
                                      )}
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
