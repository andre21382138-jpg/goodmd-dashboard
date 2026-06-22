import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast, dlBlob } from '../../lib/utils';
import { ORDER_CONSTANTS, STORE_MAP, STORE_NAMES } from '../../lib/constants';
import HQDeliveryBizView from './HQDeliveryBizView';
import BizSalesPage from '../sales/BizSalesPage';

// 31-컬럼 발주 양식 헤더 (sample: 매장발주_26.05.21_전송건.xls)
export const DELIVERY_HEADERS = [
  '발송일','송장번호','주문번호','채널','매장명','수취인명','결제금액','주문수량',
  '상품명','옵션','품명','수취인명','','주소','수취인 천화번호1','수취인 전화번호2',
  '배송메세지','상품번호','주문자명','주문자 연락처1','주문자 연락처2','수수료','수수료액','공란',
  '사방넷주문번호','주문일','주문자 ID','물류바코드(88코드)','송장전송일','ERP코드','수량'
];

async function exportDeliveryRequests(groups) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('택배요청');

  // 헤더 행
  ws.addRow(DELIVERY_HEADERS);

  // 오늘 날짜 YYYYMMDD (주문번호 prefix)
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const yymmdd = `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;

  // 그룹의 각 라인을 한 행씩 추가
  // 주문번호: 요청건에 고정 — 판매일 + 그룹 대표 sale id 기반 (재다운로드해도 동일)
  for (const g of groups) {
    const storeFull = `${g.store_name || ''}${g.branch_name || ''}`;
    const soldYmd = (g.sold_at || '').replace(/-/g, '') || ymd;
    const repId = Math.min(...g.items.map(it => Number(it.id) || 0));
    const orderNo = `${soldYmd}-${String(repId).padStart(6, '0')}`; // 그룹(주문) 단위 고정값
    for (const it of g.items) {
      const soldDate = g.sold_at ? new Date(g.sold_at) : null;
      ws.addRow([
        soldDate,                                  // 0  발송일
        '',                                        // 1  송장번호
        orderNo,                                   // 2  주문번호
        ORDER_CONSTANTS.CHANNEL,                   // 3  채널
        storeFull,                                 // 4  매장명
        g.recipient_name || '',                    // 5  수취인명
        0,                                         // 6  결제금액
        1,                                         // 7  주문수량
        '',                                        // 8  상품명
        '',                                        // 9  옵션
        it.product?.name || '',                    // 10 품명
        g.recipient_name || '',                    // 11 수취인명
        '',                                        // 12 (우편번호 자리, 빈)
        g.recipient_address || '',                 // 13 주소
        g.recipient_phone || '',                   // 14 수취인 천화번호1
        '',                                        // 15 수취인 전화번호2
        g.delivery_notes || '',                    // 16 배송메세지
        '',                                        // 17 상품번호
        storeFull,                                 // 18 주문자명 → 매장명+지점 자동 입력
        ORDER_CONSTANTS.ORDERER_PHONE,             // 19 주문자 연락처1
        ORDER_CONSTANTS.ORDERER_PHONE,             // 20 주문자 연락처2
        '',                                        // 21 수수료
        '',                                        // 22 수수료액
        `SID:${it.id}`,                            // 23 공란 — sale_id 자동 저장 (송장 매핑용, 물류팀이 건드리지 않음)
        '',                                        // 24 사방넷주문번호
        '',                                        // 25 주문일
        '',                                        // 26 주문자 ID
        '',                                        // 27 물류바코드(88코드)
        '',                                        // 28 송장전송일
        it.product?.erp_code || '',                // 29 ERP코드
        it.quantity || 0,                          // 30 수량
      ]);
    }
  }

  // 발송일 컬럼 날짜 서식
  ws.getColumn(1).numFmt = 'yyyy-mm-dd';

  // 컬럼 폭 자동
  ws.columns.forEach((col, idx) => {
    let max = 8;
    col.eachCell({ includeEmpty: false }, cell => {
      const v = cell.value == null ? '' : String(cell.value);
      if (v.length > max) max = Math.min(40, v.length + 2);
    });
    col.width = Math.max(max, 8);
  });

  const buf = await wb.xlsx.writeBuffer();
  dlBlob(buf, `택배요청_${yymmdd}_전송건.xlsx`);
  return groups.reduce((s, g) => s + g.items.length, 0);
}

function groupKey(s) {
  return `${s.sold_at}|${s.recipient_phone || ''}|${s.customer_id || ''}|${s.store_name}|${s.branch_name}`;
}

function groupSales(rows) {
  const map = new Map();
  for (const s of (rows || [])) {
    const k = groupKey(s);
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        sold_at: s.sold_at,
        store_name: s.store_name,
        branch_name: s.branch_name,
        recipient_name: s.recipient_name,
        recipient_phone: s.recipient_phone,
        recipient_address: s.recipient_address,
        delivery_notes: s.delivery_notes,
        dispatched_at: s.dispatched_at,
        items: [],
      });
    }
    map.get(k).items.push(s);
  }
  const list = [...map.values()];
  // 그룹 승인 상태 — 모든 라인이 승인되면 approved
  for (const g of list) {
    g.approved = g.items.length > 0 && g.items.every(it => it.delivery_approved_at);
  }
  return list.sort((a, b) => (b.sold_at || '').localeCompare(a.sold_at || ''));
}

export default function HQDeliveryRequestPage({ profile, view = 'customer' }) {
  // view='customer' → 고객 택배요청(매장 본사요청)만 / view='biz' → 특판 택배·용차만
  // 본사 담당자(또는 admin)는 요청 [확인] 승인 가능, SCM은 승인된 건만 처리
  const isApprover = profile?.role === 'admin' || profile?.job_title === '담당자';
  const isScm = profile?.role === 'scm';
  const [mainTab, setMainTab] = useState(view === 'biz' ? (isApprover ? 'biz_input' : 'biz_courier') : 'store'); // 'biz_input' | 'biz_courier' | 'biz_truck' | 'store'
  const [tab, setTab] = useState('pending');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(new Set()); // 발송대기 선택 그룹 key

  // 발송완료 탭 필터
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const minusDays = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [fFrom,   setFFrom]   = useState(minusDays(30));
  const [fTo,     setFTo]     = useState(todayStr());
  const [fStore,  setFStore]  = useState('');
  const [fBranch, setFBranch] = useState('');
  const branchOptions = fStore ? (STORE_MAP[fStore] || []) : [];

  const fetchData = useCallback(async () => {
    if (mainTab !== 'store') return; // 특판 탭은 별도 컴포넌트가 처리
    setLoading(true);
    let q = supabase.from('sales')
      .select(`id, sold_at, store_name, branch_name, quantity, price,
               recipient_name, recipient_phone, recipient_address, delivery_notes,
               dispatched_at, customer_id, tracking_number,
               delivery_approved_at, delivery_approved_by,
               product:products(name, code, erp_code)`)
      .eq('delivery_type', 'hq')
      .eq('delivery_status', tab);
    if (tab === 'pending') {
      q = q.order('sold_at', { ascending: false }).limit(200);
    } else {
      // 발송완료: 기간·점포·지점 필터
      if (fFrom)   q = q.gte('dispatched_at', `${fFrom}T00:00:00`);
      if (fTo)     q = q.lte('dispatched_at', `${fTo}T23:59:59`);
      if (fStore)  q = q.eq('store_name',  fStore);
      if (fBranch) q = q.eq('branch_name', fBranch);
      q = q.order('dispatched_at', { ascending: false }).limit(500);
    }
    const { data, error } = await q;
    if (error) toast(error.message, 'err');
    else setGroups(groupSales(data));
    setSelectedKeys(new Set());
    setLoading(false);
  }, [mainTab, tab, fFrom, fTo, fStore, fBranch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 송장번호 엑셀 업로드 — 공란(24번 컬럼)의 SID:<sale_id>로 매칭
  const fileInputRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);
  const handleUploadClick = () => fileInputRef.current?.click();
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
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      // 승인된 sale id만 송장 등록 허용 (본사 확인 안 된 건 차단)
      const approvedIds = new Set(groups.filter(g => g.approved).flatMap(g => g.items.map(it => it.id)));
      const updates = [];
      let totalSaleRows = 0; // SID가 들어간 (= 다운로드된) 데이터 행 수
      let notApproved = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;
        const sidCell = String(row[23] || '').trim();
        const m = sidCell.match(/SID:(\d+)/);
        if (!m) continue; // 다운로드된 데이터 행이 아님 (빈 행 등)
        totalSaleRows++;
        const tracking = String(row[1] || '').trim();
        if (!tracking) continue; // 송장번호 미입력 → 처리에서 제외
        const saleId = Number(m[1]);
        if (!approvedIds.has(saleId)) { notApproved++; continue; } // 미승인 건 차단
        updates.push({ saleId, tracking });
      }
      if (totalSaleRows === 0) {
        toast('업로드 가능한 행이 없습니다 (SID 누락)', 'err');
        return;
      }
      if (notApproved > 0 && updates.length === 0) {
        toast(`본사 확인(승인)되지 않은 요청입니다 — 담당자 확인 후 처리 가능 (${notApproved}건)`, 'err');
        return;
      }
      const noTrackingCount = totalSaleRows - updates.length - notApproved;
      if (updates.length === 0) {
        toast(`송장번호 입력된 행이 없습니다 (전체 ${totalSaleRows}건 모두 미입력)`, 'err');
        return;
      }
      // 송장번호만 매칭(등록) — 발송대기 상태 유지. 발송처리는 별도 [발송처리] 버튼으로
      let ok = 0, fail = 0, lastError = null;
      for (const u of updates) {
        const { error } = await supabase.from('sales').update({
          tracking_number: u.tracking,
        }).eq('id', u.saleId);
        if (error) lastError = error;
        if (error) fail++; else ok++;
      }
      const parts = [`송장 매칭 ${ok}건`];
      if (fail > 0) parts.push(`실패 ${fail}건`);
      if (noTrackingCount > 0) parts.push(`미입력 ${noTrackingCount}건`);
      if (notApproved > 0) parts.push(`미승인 ${notApproved}건 제외`);
      toast(`송장번호 매칭 완료 — ${parts.join(' / ')} · 발송대기 유지`, (fail > 0 || notApproved > 0) ? 'err' : 'ok');
      if (fail > 0 && lastError) {
        toast(`실패 사유: ${lastError.message || lastError}`, 'err');
      }
      // 발송대기에 머무름 (송장번호 표시됨) → 선택 후 [발송처리]로 완료
      fetchData();
    } catch (err) {
      toast('업로드 실패: ' + (err.message || err), 'err');
    }
    setUploading(false);
  };

  // ── 본사 담당자 승인 ([확인]) — SCM은 승인된 건만 처리 가능 ──
  const handleApprove = async (g, approve) => {
    const ids = g.items.map(it => it.id);
    if (approve && !window.confirm(`${g.recipient_name || ''} 요청 ${ids.length}건을 확인(승인)하시겠습니까?\n승인 후 SCM 담당자가 발송 처리할 수 있습니다.`)) return;
    if (!approve && !window.confirm('승인을 취소하시겠습니까? SCM 처리가 다시 막힙니다.')) return;
    setProcessing(g.key);
    try {
      const { error } = await supabase.from('sales').update({
        delivery_approved_at: approve ? new Date().toISOString() : null,
        delivery_approved_by: approve ? profile.id : null,
      }).in('id', ids);
      if (error) throw error;
      toast(approve ? '확인(승인) 완료' : '승인 취소', approve ? 'ok' : 'inf');
      fetchData();
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally { setProcessing(null); }
  };

  // 승인(발송요청)된 그룹만 선택 가능. 단, 본사 담당자는 삭제 위해 미요청 건도 선택 가능
  const approvedGroups = groups.filter(g => g.approved);
  const selectableGroups = isApprover ? groups : approvedGroups;
  // SCM은 본사가 [발송요청]한 건만 목록에 표시 (발송대기 탭)
  const displayGroups = (isScm && tab === 'pending') ? approvedGroups : groups;
  // 선택 토글
  const toggleSelect = (key) => {
    const g = groups.find(x => x.key === key);
    if (!isApprover && !g?.approved) { toast('본사 확인(승인)된 요청만 선택할 수 있습니다', 'inf'); return; }
    setSelectedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const toggleSelectAll = () => setSelectedKeys(prev =>
    prev.size === selectableGroups.length ? new Set() : new Set(selectableGroups.map(g => g.key))
  );

  // 본사 담당자 — 선택 요청 삭제 (재고 없음 등으로 발송 불가 시). 매장 매출에서도 사라짐
  const handleDeleteSelected = async () => {
    const target = groups.filter(g => selectedKeys.has(g.key));
    if (target.length === 0) { toast('삭제할 요청을 선택해주세요', 'err'); return; }
    const ids = target.flatMap(g => g.items.map(it => it.id));
    if (!window.confirm(`선택한 ${target.length}건(${ids.length}개 상품)을 삭제하시겠습니까?\n\n해당 매장 본사요청 매출이 영구 삭제됩니다 (중복·재고없음 등 처리용). 되돌릴 수 없습니다.`)) return;
    setProcessing('delete');
    try {
      const { error } = await supabase.from('sales').delete().in('id', ids);
      if (error) throw error;
      toast(`${target.length}건 삭제 완료`, 'inf');
      setSelectedKeys(new Set());
      fetchData();
    } catch (err) {
      toast('삭제 실패: ' + (err.message || err), 'err');
    } finally { setProcessing(null); }
  };

  // 선택 건 엑셀 다운로드 (선택 없으면 승인된 전체)
  const handleExportSelected = async () => {
    const target = selectedKeys.size > 0 ? groups.filter(g => selectedKeys.has(g.key)) : approvedGroups;
    if (target.length === 0) { toast('다운로드할 (승인된) 요청이 없습니다', 'err'); return; }
    try {
      const count = await exportDeliveryRequests(target);
      toast(`엑셀 다운로드 완료 (${count}건${selectedKeys.size>0?' · 선택분':' · 전체'})`, 'ok');
    } catch (e) {
      toast('다운로드 실패: ' + (e.message || e), 'err');
    }
  };

  // 그룹에 송장번호가 있는지
  const groupHasTracking = (g) => g.items.some(x => x.tracking_number);
  // 선택 건이 모두 송장번호를 가졌는지 (발송처리 활성 조건)
  const selectedAllTracked = selectedKeys.size > 0 &&
    groups.filter(g => selectedKeys.has(g.key)).every(groupHasTracking);

  // 선택 건 일괄 발송처리
  const handleDispatchSelected = async () => {
    const target = groups.filter(g => selectedKeys.has(g.key));
    if (target.length === 0) { toast('발송처리할 요청을 선택해주세요', 'err'); return; }
    const noTrack = target.filter(g => !groupHasTracking(g));
    if (noTrack.length > 0) {
      toast(`송장번호가 없는 요청 ${noTrack.length}건이 있습니다. 송장 업로드 후 발송처리해주세요`, 'err');
      return;
    }
    const ids = target.flatMap(g => g.items.map(it => it.id));
    if (!window.confirm(`선택한 ${target.length}건(${ids.length}개 상품)을 발송처리하시겠습니까?\n\n발송완료 탭으로 이동하며, 매장 매출조회에 "✅ 본사발송 완료"로 표시됩니다.`)) return;
    setProcessing('batch');
    try {
      const { error } = await supabase.from('sales').update({
        delivery_status: 'dispatched',
        dispatched_at: new Date().toISOString(),
        dispatched_by: profile.id,
      }).in('id', ids);
      if (error) throw error;
      toast(`${target.length}건 발송처리 완료`, 'ok');
      setTab('dispatched');
    } catch (err) {
      toast('처리 실패: ' + (err.message || err), 'err');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      {/* 특판 뷰에서만 메인 탭 노출. 발주입력은 본사만 */}
      {view === 'biz' && (
        <div style={{display:'flex', gap:8, marginBottom:14, borderBottom:'2px solid var(--border)'}}>
          {[
            ...(isApprover ? [{ key:'biz_input', label:'📝 특판 발주입력' }] : []),
            { key:'biz_courier', label:'🏭 특판 택배' },
            { key:'biz_truck',   label:'🚚 특판 용차' },
          ].map(t => (
            <button key={t.key} type="button" onClick={() => setMainTab(t.key)}
              style={{
                padding:'10px 18px', border:'none', background:'transparent',
                borderBottom: mainTab === t.key ? '3px solid var(--accent)' : '3px solid transparent',
                marginBottom:-2, fontSize:14, fontWeight:700, cursor:'pointer',
                color: mainTab === t.key ? 'var(--accent)' : 'var(--text2)',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 특판 발주입력 (본사) — 특판 매출 등록 = 발송 요청 생성 */}
      {mainTab === 'biz_input'   && isApprover && <BizSalesPage profile={profile} mode="input"/>}
      {/* 특판 발송 처리 */}
      {mainTab === 'biz_courier' && <HQDeliveryBizView kind="courier" profile={profile}/>}
      {mainTab === 'biz_truck'   && <HQDeliveryBizView kind="truck"   profile={profile}/>}

      {/* 매장 본사요청 — 기존 sub 탭 + 표 */}
      {mainTab === 'store' && (<>
      <div className="tabs">
        <button className={`tab ${tab==='pending'?'on':''}`} onClick={() => setTab('pending')}>
          📦 발송 대기
        </button>
        <button className={`tab ${tab==='dispatched'?'on':''}`} onClick={() => setTab('dispatched')}>
          ✅ 발송 완료
        </button>
      </div>

      <div className="card" style={{padding:'16px 20px'}}>
        {tab === 'dispatched' && (
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap'}}>
            <input type="date" className="fsel" value={fFrom}
              onChange={e => setFFrom(e.target.value || todayStr())}
              style={{height:32, padding:'0 8px', fontSize:12}}/>
            <span style={{fontSize:12, color:'var(--text3)'}}>~</span>
            <input type="date" className="fsel" value={fTo}
              onChange={e => setFTo(e.target.value || todayStr())}
              style={{height:32, padding:'0 8px', fontSize:12}}/>
            <button className="btn btn-s" onClick={() => { setFFrom(minusDays(30)); setFTo(todayStr()); }}>최근 30일</button>
            <button className="btn btn-s" onClick={() => { setFFrom(minusDays(90)); setFTo(todayStr()); }}>최근 3개월</button>
            <select className="fsel" value={fStore}
              onChange={e => { setFStore(e.target.value); setFBranch(''); }}
              style={{height:32, padding:'0 8px', fontSize:12}}>
              <option value="">전체 점포</option>
              {STORE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="fsel" value={fBranch}
              onChange={e => setFBranch(e.target.value)}
              disabled={!fStore}
              style={{height:32, padding:'0 8px', fontSize:12, background:!fStore?'#f0f0f0':'#fff'}}>
              <option value="">전체 지점</option>
              {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {(fStore||fBranch) && (
              <button className="btn-ghost" onClick={() => { setFStore(''); setFBranch(''); }}>✕ 매장 초기화</button>
            )}
          </div>
        )}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:8, flexWrap:'wrap'}}>
          <span className="fresult">
            {tab === 'pending'
              ? (isScm
                  ? <>발송요청 받은 건 — <b>{displayGroups.length}</b>건{selectedKeys.size > 0 && <> · 선택 <b style={{color:'var(--accent)'}}>{selectedKeys.size}</b>건</>}</>
                  : <>발송 대기 중인 고객 택배 요청 — <b>{groups.length}</b>건 · 발송요청됨 <b style={{color:'#2e7d32'}}>{approvedGroups.length}</b> / 대기 <b style={{color:'#e65100'}}>{groups.length - approvedGroups.length}</b>{selectedKeys.size > 0 && <> · 선택 <b style={{color:'var(--accent)'}}>{selectedKeys.size}</b>건</>}</>)
              : <>발송 완료 — <b>{groups.length}</b>건 <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>{fFrom} ~ {fTo}</span></>}
          </span>
          {tab === 'pending' && (
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              <button type="button" onClick={handleExportSelected} disabled={groups.length === 0}
                title="선택 건(없으면 전체)을 매장발주 양식(.xlsx)으로 다운로드"
                style={{height:30, padding:'0 12px', border:'1px solid var(--accent)', borderRadius:'var(--radius)', background:'#fff3e0', color:'var(--accent)', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                📥 엑셀 다운로드{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}
              </button>
              <input ref={fileInputRef} type="file" accept=".xls,.xlsx"
                onChange={handleUploadFile} style={{display:'none'}}/>
              <button type="button" onClick={handleUploadClick} disabled={uploading}
                title="송장번호 채워진 엑셀 업로드 → 송장번호 매칭(발송대기 유지)"
                style={{height:30, padding:'0 12px', border:'1px solid #1565C0', borderRadius:'var(--radius)', background:'#e3f2fd', color:'#1565C0', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                {uploading ? <span className="spinner"/> : '📤 송장 업로드'}
              </button>
              <button type="button" onClick={handleDispatchSelected} disabled={!selectedAllTracked || processing === 'batch'}
                title={selectedKeys.size === 0 ? '발송처리할 요청을 선택하세요' : !selectedAllTracked ? '송장 업로드 후 발송처리할 수 있습니다' : '선택 건을 발송처리 → 발송완료 탭으로'}
                style={{height:30, padding:'0 12px', border:'1px solid #2e7d32', borderRadius:'var(--radius)', background: selectedAllTracked?'#e8f5e9':'#f5f5f5', color: selectedAllTracked?'#2e7d32':'var(--text3)', fontSize:12, fontWeight:700, cursor: selectedAllTracked?'pointer':'not-allowed'}}>
                {processing === 'batch' ? <span className="spinner"/> : `✓ 발송처리${selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}`}
              </button>
              {isApprover && (
                <button type="button" onClick={handleDeleteSelected} disabled={selectedKeys.size === 0 || processing === 'delete'}
                  title="선택 요청 삭제 (재고없음·중복 등) — 매장 매출에서도 제거"
                  style={{height:30, padding:'0 12px', border:'1px solid var(--danger)', borderRadius:'var(--radius)', background: selectedKeys.size>0?'#ffebee':'#f5f5f5', color: selectedKeys.size>0?'var(--danger)':'var(--text3)', fontSize:12, fontWeight:700, cursor: selectedKeys.size>0?'pointer':'not-allowed'}}>
                  {processing === 'delete' ? <span className="spinner"/> : `🗑 선택 삭제${selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}`}
                </button>
              )}
              <button className="btn btn-s" onClick={fetchData} disabled={loading}>
                {loading ? <span className="spinner"/> : '🔄 새로고침'}
              </button>
            </div>
          )}
          {tab === 'dispatched' && (
            <button className="btn btn-s" onClick={fetchData} disabled={loading}>
              {loading ? <span className="spinner"/> : '🔄 새로고침'}
            </button>
          )}
        </div>

        {loading ? <div className="empty"><span className="spinner"/></div>
          : (tab === 'pending' ? displayGroups.length === 0 : groups.length === 0) ? <div className="empty">
              {tab === 'pending' ? (isScm ? '본사가 발송요청한 건이 없습니다' : '발송 대기 중인 요청이 없습니다') : '발송 완료 이력이 없습니다'}
            </div>
          : (
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  {tab === 'pending' && (
                    <th style={{textAlign:'center', width:36}}>
                      <input type="checkbox"
                        checked={selectableGroups.length > 0 && selectedKeys.size === selectableGroups.length}
                        ref={el => { if (el) el.indeterminate = selectedKeys.size > 0 && selectedKeys.size < selectableGroups.length; }}
                        onChange={toggleSelectAll}
                        title={isApprover ? '전체선택' : '승인된 요청 전체선택'}
                        style={{cursor:'pointer', width:15, height:15}}/>
                    </th>
                  )}
                  <th>날짜</th>
                  <th>매장</th>
                  <th>상품명</th>
                  <th className="r" style={{width:60}}>수량</th>
                  <th>받는사람</th>
                  <th>주소</th>
                  <th>연락처</th>
                  <th>요청사항</th>
                  <th style={{textAlign:'center', width:140}}>송장번호</th>
                  {tab === 'pending' && <th style={{textAlign:'center', width:130}}>발송요청</th>}
                  {tab === 'dispatched' && <th style={{textAlign:'center', width:110}}>발송일</th>}
                </tr>
              </thead>
              <tbody>
                {displayGroups.flatMap((g, gIdx) => {
                  // 그룹 시각적 구분: 짝수 그룹 흰색, 홀수 그룹 매우 옅은 노랑
                  const groupBg = gIdx % 2 === 0 ? '#fff' : '#fffdf5';
                  const rs = g.items.length;
                  const mergedStyle = { verticalAlign:'middle', background: groupBg };
                  const lineBorder = { borderBottom: '1px solid var(--border)' };
                  return g.items.map((it, iIdx) => (
                    <tr key={it.id} style={{background: (tab==='pending' && !g.approved) ? '#fafafa' : groupBg, ...(iIdx === 0 ? {borderTop:'2px solid var(--border2)'} : {})}}>
                      {iIdx === 0 && tab === 'pending' && (
                        <td rowSpan={rs} style={{textAlign:'center', ...mergedStyle, ...((!g.approved)?{background:'#fafafa'}:{})}}>
                          <input type="checkbox" checked={selectedKeys.has(g.key)}
                            disabled={!isApprover && !g.approved}
                            onChange={() => toggleSelect(g.key)}
                            title={(isApprover || g.approved) ? '' : '본사 확인(승인) 후 선택 가능'}
                            style={{cursor: (isApprover || g.approved) ? 'pointer' : 'not-allowed', width:15, height:15}}/>
                        </td>
                      )}
                      {iIdx === 0 && (
                        <td rowSpan={rs} className="mono" style={{fontSize:11, ...mergedStyle}}>{g.sold_at}</td>
                      )}
                      {iIdx === 0 && (
                        <td rowSpan={rs} style={{fontSize:11, ...mergedStyle}}>
                          <span className="badge badge-dept">{g.store_name}</span> <span className="badge badge-store">{g.branch_name}</span>
                        </td>
                      )}
                      <td style={{fontSize:12, ...lineBorder}}>{it.product?.name || '-'}</td>
                      <td className="r" style={{fontFamily:'var(--mono)', fontWeight:700, ...lineBorder}}>{it.quantity}</td>
                      {iIdx === 0 && (
                        <td rowSpan={rs} style={{fontSize:12, fontWeight:700, ...mergedStyle}}>{g.recipient_name}</td>
                      )}
                      {iIdx === 0 && (
                        <td rowSpan={rs} style={{fontSize:11, color:'var(--text2)', ...mergedStyle}}>{g.recipient_address}</td>
                      )}
                      {iIdx === 0 && (
                        <td rowSpan={rs} className="mono" style={{fontSize:11, color:'var(--text2)', ...mergedStyle}}>{g.recipient_phone}</td>
                      )}
                      {iIdx === 0 && (
                        <td rowSpan={rs} style={{fontSize:11, color:'var(--text3)', ...mergedStyle}}>{g.delivery_notes || '-'}</td>
                      )}
                      {iIdx === 0 && (() => {
                        const groupTracking = g.items.find(x => x.tracking_number)?.tracking_number;
                        return (
                          <td rowSpan={rs} style={{textAlign:'center', fontSize:11, fontFamily:'var(--mono)', ...mergedStyle}}>
                            {groupTracking ? (
                              <div style={{display:'flex', alignItems:'center', gap:6, justifyContent:'center', flexWrap:'wrap'}}>
                                <span style={{fontWeight:700, color:'var(--text)'}}>📦 {groupTracking}</span>
                                <button type="button"
                                  onClick={() => window.open(`https://tracker.delivery/#/kr.cjlogistics/${groupTracking}`, '_blank', 'noopener,noreferrer')}
                                  title="CJ대한통운 배송조회 (새 창)"
                                  style={{height:24, padding:'0 10px', border:'1px solid var(--accent)', borderRadius:4, background:'#fff3e0', color:'var(--accent)', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                                  🔍 조회
                                </button>
                              </div>
                            ) : <span style={{color:'var(--text3)'}}>-</span>}
                          </td>
                        );
                      })()}
                      {iIdx === 0 && tab === 'pending' && (
                        <td rowSpan={rs} style={{textAlign:'center', ...mergedStyle, ...((!g.approved)?{background:'#fafafa'}:{})}}>
                          {g.approved ? (
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                              <span style={{fontSize:11, fontWeight:700, color:'#2e7d32', background:'#e8f5e9', border:'1px solid #a5d6a7', padding:'2px 8px', borderRadius:4}}>✅ 발송요청됨</span>
                              {isApprover && (
                                <button type="button" onClick={() => handleApprove(g, false)} disabled={processing === g.key}
                                  style={{fontSize:10, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>요청취소</button>
                              )}
                            </div>
                          ) : isApprover ? (
                            <button type="button" onClick={() => handleApprove(g, true)} disabled={processing === g.key}
                              style={{height:30, padding:'0 14px', border:'1px solid #6a1b9a', borderRadius:'var(--radius)', background:'#6a1b9a', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer'}}>
                              {processing === g.key ? <span className="spinner"/> : '📤 발송요청'}
                            </button>
                          ) : (
                            <span style={{fontSize:11, fontWeight:700, color:'#e65100', background:'#fff3e0', border:'1px solid #ffcc80', padding:'2px 8px', borderRadius:4}}>발송요청 대기</span>
                          )}
                        </td>
                      )}
                      {iIdx === 0 && tab === 'dispatched' && (
                        <td rowSpan={rs} style={{textAlign:'center', ...mergedStyle}}>
                          {g.dispatched_at && (
                            <span style={{fontSize:11, color:'var(--success)', fontWeight:600}}>
                              {new Date(g.dispatched_at).toLocaleDateString('ko-KR')}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
